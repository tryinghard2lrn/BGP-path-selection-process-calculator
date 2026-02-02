import { BgpRoute, AnalysisResult, StepResult, Vendor, DecisionCandidate, RankedAnalysis, RankedStep } from './types';

export interface EngineOptions {
    ignoreAsPathLength?: boolean;
    alwaysCompareMed?: boolean;
}

export function compareRoutes(routes: BgpRoute[], vendor: Vendor = 'cisco', options: EngineOptions = {}): AnalysisResult {
    if (routes.length === 0) {
        return { steps: [], error: 'No routes provided' };
    }

    let candidates = [...routes];
    const steps: StepResult[] = [];

    // Helper to record a step with detailed candidates
    const recordStep = (
        name: string,
        // Function that returns the RAW value for comparison (e.g. 100 for LP)
        getValue: (r: BgpRoute) => string | number | boolean,
        // Function to determine if a value is "better" than another
        // Returns true if 'a' is fundamentally better than 'b'
        isBetter: (a: string | number | boolean, b: string | number | boolean) => boolean
    ) => {
        // 1. Calculate values for ALL input routes (for table visualization)
        const allValues = routes.map(r => ({
            route: r,
            val: getValue(r)
        }));

        // 2. Determine the "best" value permissible among current CANDIDATES (survivors)
        let bestVal: string | number | boolean | null = null;
        if (candidates.length > 0) {
            const candidateValues = candidates.map(c => ({
                route: c,
                val: getValue(c)
            }));
            bestVal = candidateValues[0].val;
            for (let i = 1; i < candidateValues.length; i++) {
                if (isBetter(candidateValues[i].val, bestVal!)) {
                    bestVal = candidateValues[i].val;
                }
            }
        }

        // 3. Filter next round candidates
        let nextCandidates = candidates;
        let reason = 'Tie';

        if (candidates.length > 1 && bestVal !== null) {
            nextCandidates = candidates.filter(c => {
                const val = getValue(c);
                return val === bestVal;
            });

            if (nextCandidates.length < candidates.length) {
                const winnerVal = bestVal;
                // Find a loser specifically from the candidate pool 
                const loser = candidates.find(c => getValue(c) !== bestVal);
                const loserVal = loser ? getValue(loser) : '?';
                reason = `${name}: ${winnerVal} preferred over ${loserVal}`;
            }
        } else if (candidates.length === 1) {
            reason = '';
        }

        // 4. Record step details for ALL routes
        const stepCandidates: DecisionCandidate[] = allValues.map(item => {
            // For visualization, a route is "best" at this step if it matches the winning value
            // AND if it is still a candidate (or would have been if it hadn't lost earlier, but sticking to simple val comp)->
            // Actually, for the table, we want to know if this specific value was a "winning value".
            const isBestValue = bestVal !== null && item.val === bestVal;
            return {
                routeId: item.route.id,
                value: item.val,
                isBest: isBestValue
            };
        });

        steps.push({
            stepName: name,
            candidates: stepCandidates,
            reason
        });

        // 5. Update candidates
        candidates = nextCandidates;
    };

    // --- STEPS --- (Renamed per user request)

    // 1. Weight 
    recordStep('Weight',
        r => r.weight,
        (a, b) => (a as number) > (b as number)
    );

    // 2. Local Pref
    recordStep('Local Preference',
        r => r.localPref,
        (a, b) => (a as number) > (b as number)
    );

    // 3. Locally Originated
    recordStep('Locally Originated',
        r => r.nextHop === '0.0.0.0',
        (a, b) => (a === true && b === false)
    );

    // 4. AS Path Length
    if (!options.ignoreAsPathLength) {
        recordStep('AS Path Length',
            r => r.asPathLength,
            (a, b) => (a as number) < (b as number)
        );
    }

    // 5. Origin Code
    const originScore = (o: string) => o === 'IGP' ? 0 : o === 'EGP' ? 1 : 2;
    recordStep('Origin Code',
        r => originScore(r.origin),
        (a, b) => (a as number) < (b as number)
    );

    // 6. MED (Renamed)
    recordStep('MED (BGP Attribute)',
        r => r.med,
        (a, b) => (a as number) < (b as number)
    );

    // 7. eBGP over iBGP
    recordStep('eBGP over iBGP',
        r => r.isIbgp ? 'iBGP' : 'eBGP',
        (a, b) => a === 'eBGP' && b === 'iBGP'
    );

    // 8. IGP Metric (Renamed)
    recordStep('IGP Cost (Internal)',
        r => r.igpMetric,
        (a, b) => (a as number) < (b as number)
    );

    // 9. Router ID
    recordStep('Router ID',
        r => r.routerId,
        (a, b) => {
            return (a as string).localeCompare((b as string), undefined, { numeric: true }) < 0;
        }
    );

    // 10. Peer IP
    recordStep('Peer IP',
        r => r.peerIp,
        (a, b) => {
            return (a as string).localeCompare((b as string), undefined, { numeric: true }) < 0;
        }
    );

    return {
        winner: candidates[0],
        steps,
    };
}

export function analyzeAndRank(routes: BgpRoute[], vendor: Vendor = 'cisco', options: EngineOptions = {}): RankedAnalysis {
    const pool = [...routes];
    const ranking: RankedStep[] = [];
    let rank = 1;

    while (pool.length > 0) {
        // Run analysis on current pool
        const res = compareRoutes(pool, vendor, options);
        if (!res.winner) break;

        // Determine specific reason this winner beat the OTHERS in the pool
        // The reason is effectively the *last* non-tie step in the analysis chain?
        // Or simply the step where candidates reduced to 1?
        // The analysis steps array contains 'reason' - the last one that isn't 'Tie' explains the final elimination.

        const decidingStep = res.steps.filter(s => s.reason && s.reason !== 'Tie').pop();
        const reason = decidingStep ? decidingStep.reason : 'Only candidate remaining';

        ranking.push({
            rank: rank,
            route: res.winner,
            reason: reason,
            subAnalysis: res
        });

        // Prepare for next iteration
        const idx = pool.findIndex(r => r.id === res.winner!.id);
        if (idx !== -1) pool.splice(idx, 1);
        rank++;
    }

    return { ranking };
}

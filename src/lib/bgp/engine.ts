import { BgpRoute, AnalysisResult, StepResult, Vendor, DecisionCandidate, RankedAnalysis } from './types';

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
        // Function that returns the RAW value for comparison
        getValue: (r: BgpRoute) => string | number | boolean,
        // Function to determine if a value is "better" than another
        // Returns true if 'a' is fundamentally better than 'b'
        isBetter: (a: string | number | boolean, b: string | number | boolean) => boolean
    ) => {
        // 1. Calculate values for ALL input routes (for table visualization)
        // We use 'routes' (global scope from func args) to ensure we get data for eliminated paths too
        const allValues = routes.map(r => ({
            route: r,
            val: getValue(r)
        }));

        // 2. Determine the "best" value permissible among current CANDIDATES (survivors)
        // If candidates is empty (shouldn't happen) or 1, we still calculate relative best for consistent highlighting
        // But strictly, we only care about candidates for the decision.

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
        // If we have >1 candidates, we filter them. If we have 1, it stays 1.
        let nextCandidates = candidates;
        let reason = 'Tie';

        if (candidates.length > 1 && bestVal !== null) {
            nextCandidates = candidates.filter(c => {
                const val = getValue(c);
                return val === bestVal;
            });

            // Generate reason if drops happened
            if (nextCandidates.length < candidates.length) {
                // Find a loser specifically from the candidate pool for accurate reason
                const winnerVal = bestVal;
                // A loser is someone in 'candidates' who didn't match 'bestVal'
                const loser = candidates.find(c => getValue(c) !== bestVal);
                const loserVal = loser ? getValue(loser) : '?';

                reason = `${name}: ${winnerVal} preferred over ${loserVal}`;
            }
        } else if (candidates.length === 1) {
            // Already won previous round
            reason = ''; // No decision made here
        }

        // 4. Record step details for ALL routes
        // For visualization:
        // - isBest: Matches the 'bestVal' (so it would have survived if it were alive)
        //           OR matches the value of the actual winner?
        //           Let's say isBest = matches bestVal.

        const stepCandidates: DecisionCandidate[] = allValues.map(item => {
            // Safe fallback if bestVal is null (no candidates? impossible in normal flow)
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

    // --- STEPS ---

    // 1. Weight (High is better)
    recordStep('Weight',
        r => r.weight,
        (a, b) => (a as number) > (b as number)
    );

    // 2. Local Pref (High is better)
    recordStep('Local Preference',
        r => r.localPref,
        (a, b) => (a as number) > (b as number)
    );

    // 3. Locally Originated (NextHop 0.0.0.0 is best)
    recordStep('Locally Originated',
        r => r.nextHop === '0.0.0.0',
        (a, b) => (a === true && b === false)
    );

    // 4. AS Path Length (Low is better)
    // Even if ignored for decision, we might want to show it? 
    // If ignored, standard practice is it effectively acts as a Tie (all equal).
    // Let's handle 'ignoreAsPathLength' by mocking equality in 'isBetter' or strictly skipping?
    // User wants to toggle. If ignored, maybe better to SKIP the step entirely in the table?
    // Or show it but say "Ignored"? 
    // Let's skip recording if ignored, as per previous implementation logic.
    if (!options.ignoreAsPathLength) {
        recordStep('AS Path Length',
            r => r.asPathLength,
            (a, b) => (a as number) < (b as number)
        );
    }

    // 5. Origin Code (Low is better)
    const originScore = (o: string) => o === 'IGP' ? 0 : o === 'EGP' ? 1 : 2;
    recordStep('Origin Code',
        r => originScore(r.origin),
        (a, b) => (a as number) < (b as number)
    );

    // 6. MED (Low is better)
    recordStep('MED',
        r => r.med,
        (a, b) => (a as number) < (b as number)
    );

    // 7. eBGP over iBGP
    // false (eBGP) > true (iBGP)
    recordStep('eBGP over iBGP',
        r => r.isIbgp ? 'iBGP' : 'eBGP',
        (a, b) => a === 'eBGP' && b === 'iBGP'
    );

    // 8. IGP Metric (Low is better)
    recordStep('IGP Metric',
        r => r.igpMetric,
        (a, b) => (a as number) < (b as number)
    );

    // 9. Router ID (Low is better)
    recordStep('Router ID',
        r => r.routerId,
        (a, b) => {
            return (a as string).localeCompare((b as string), undefined, { numeric: true }) < 0;
        }
    );

    // 10. Peer IP (Low is better)
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
    const primary = compareRoutes(routes, vendor, options);
    const pool = [...routes];
    const ranked: BgpRoute[] = [];

    while (pool.length > 0) {
        const res = compareRoutes(pool, vendor, options);
        if (!res.winner) break;
        ranked.push(res.winner);
        const idx = pool.findIndex(r => r.id === res.winner!.id);
        if (idx !== -1) pool.splice(idx, 1);
    }

    return {
        primaryAnalysis: primary,
        rankedRoutes: ranked
    };
}

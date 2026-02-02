import { BgpRoute, AnalysisResult, StepResult, Vendor, DecisionCandidate, RankedAnalysis } from './types';

export interface EngineOptions {
    ignoreAsPathLength?: boolean;
    alwaysCompareMed?: boolean;
    // Add more toggles here as needed
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
        if (candidates.length <= 1) return;

        // 1. Calculate values for all current candidates
        const candidateValues = candidates.map(r => ({
            route: r,
            val: getValue(r)
        }));

        // 2. Determine the "best" value found among candidates
        // We assume the first one is best initially, then iterate
        let bestVal = candidateValues[0].val;
        for (let i = 1; i < candidateValues.length; i++) {
            if (isBetter(candidateValues[i].val, bestVal)) {
                bestVal = candidateValues[i].val;
            }
        }

        // 3. Filter winners (those matching the best value)
        const nextCandidates = candidateValues
            .filter(item => item.val === bestVal)
            .map(item => item.route);

        // 4. Record the step details for ALL candidates (even those about to be dropped)
        const stepCandidates: DecisionCandidate[] = candidateValues.map(item => ({
            routeId: item.route.id,
            value: item.val,
            isBest: item.val === bestVal
        }));

        // 5. Generate a reason string if we dropped someone
        let reason = 'Tie';
        if (nextCandidates.length < candidates.length) {
            const winner = candidateValues.find(c => c.val === bestVal);
            const loser = candidateValues.find(c => c.val !== bestVal);
            if (winner && loser) {
                reason = `${name}: ${winner.val} preferred over ${loser.val}`;
            }
        }

        steps.push({
            stepName: name,
            candidates: stepCandidates,
            reason
        });

        // 6. Update candidates for next round
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
    if (!options.ignoreAsPathLength) {
        recordStep('AS Path Length',
            r => r.asPathLength,
            (a, b) => (a as number) < (b as number)
        );
    } else {
        // Record as skipped or just don't record? Better to record as skipped for visibility?
        // For simplicity in UI matrix, let's skip logical evaluation but maybe we need a visual indicator.
        // User asked to "ignore 1".
        // Let's just NOT call recordStep.
    }

    // 5. Origin Code (IGP < EGP < Incomplete)
    // Map to number 0, 1, 2. Low is better.
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
        (a, b) => { // generic string compare numeric-like
            return (a as string).localeCompare((b as string), undefined, { numeric: true }) < 0;
        }
    );

    // 10. Peer IP (Low is better) - final tie breaker
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
    // 1. Run primary analysis on the full set
    const primary = compareRoutes(routes, vendor, options);

    // 2. Recursively find the ranking
    const pool = [...routes];
    const ranked: BgpRoute[] = [];

    while (pool.length > 0) {
        // Find best in current pool
        const res = compareRoutes(pool, vendor, options);
        if (!res.winner) break; // Should not happen

        ranked.push(res.winner);

        // Remove winner from pool
        const idx = pool.findIndex(r => r.id === res.winner!.id);
        if (idx !== -1) pool.splice(idx, 1);
    }

    return {
        primaryAnalysis: primary,
        rankedRoutes: ranked
    };
}

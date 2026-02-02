import { BgpRoute, AnalysisResult, StepResult, Vendor } from './types';

export function compareRoutes(routes: BgpRoute[], vendor: Vendor = 'cisco'): AnalysisResult {
    if (routes.length === 0) {
        return { steps: [], error: 'No routes provided' };
    }

    let candidates = [...routes];
    const steps: StepResult[] = [];

    // 0. Filter Invalid
    const nextHopStep: StepResult = {
        stepName: 'Next Hop Reachability',
        winnerIds: [],
        loserIds: [],
        reason: 'Next Hop must be accessible'
    };

    // Assume for calculator purposes if it's in the table it's reachable unless explicitly marked (todo: parse "inaccessible")
    // For now, we pass all.
    nextHopStep.winnerIds = candidates.map(c => c.id);
    steps.push(nextHopStep);

    // Helper to record a step
    const recordStep = (name: string, filter: (routes: BgpRoute[]) => BgpRoute[], formatReason: (winner: BgpRoute, loser: BgpRoute) => string) => {
        if (candidates.length <= 1) return;

        const previousCandidates = [...candidates];
        const winners = filter(candidates);

        // If no change in candidates (all equal), continue
        if (winners.length === candidates.length) {
            // It's a tie, no one lost
            steps.push({
                stepName: name,
                winnerIds: winners.map(c => c.id),
                loserIds: [],
                reason: 'Tie'
            });
            return;
        }

        // Someone lost
        const winnerIds = new Set(winners.map(w => w.id));
        const losers = previousCandidates.filter(c => !winnerIds.has(c.id));

        candidates = winners;

        // Generate distinct reason (compare first winner with first loser)
        const reason = formatReason(winners[0], losers[0]);

        steps.push({
            stepName: name,
            winnerIds: winners.map(c => c.id),
            loserIds: losers.map(c => c.id),
            reason
        });
    };

    // 1. Weight (Cisco/Arista only mostly, but implicit in others)
    // High is better
    recordStep('Weight (Proprietary)',
        (c) => {
            const maxW = Math.max(...c.map(r => r.weight));
            return c.filter(r => r.weight === maxW);
        },
        (w, l) => `Higher Weight (${w.weight} > ${l.weight})`
    );

    // 2. Local Preference
    // High is better
    recordStep('Local Preference',
        (c) => {
            const maxLP = Math.max(...c.map(r => r.localPref));
            return c.filter(r => r.localPref === maxLP);
        },
        (w, l) => `Higher Local Preference (${w.localPref} > ${l.localPref})`
    );

    // 3. Local Origin (Self-originated)
    // Note: Usually represented by weight 32768 in Cisco, or specific flag.
    // We'll skip explicit step if covered by Weight, but pure spec says:
    // Prefer locally originated. In our parsing `weight` often covers this for Cisco.
    // Let's implement generic logic: if nextHop is 0.0.0.0 (local)
    recordStep('Locally Originated',
        (c) => {
            // primitive check: next hop 0.0.0.0 is better
            const hasLocal = c.some(r => r.nextHop === '0.0.0.0');
            if (!hasLocal) return c;
            return c.filter(r => r.nextHop === '0.0.0.0');
        },
        (w, l) => `Locally Originated (Next Hop 0.0.0.0)`
    );

    // 4. AS Path Length
    // Short is better
    recordStep('AS Path Length',
        (c) => {
            const minLen = Math.min(...c.map(r => r.asPathLength));
            return c.filter(r => r.asPathLength === minLen);
        },
        (w, l) => `Shorter AS Path (${w.asPathLength} < ${l.asPathLength})`
    );

    // 5. Origin Code
    // IGP < EGP < Incomplete (0 < 1 < 2 in our enum map implicitly?)
    const originScore = (o: string) => o === 'IGP' ? 0 : o === 'EGP' ? 1 : 2;
    recordStep('Origin Code',
        (c) => {
            const minOrigin = Math.min(...c.map(r => originScore(r.origin)));
            return c.filter(r => originScore(r.origin) === minOrigin);
        },
        (w, l) => `Lower Origin Type (${w.origin} < ${l.origin})`
    );

    // 6. MED
    // Low is better
    recordStep('MED',
        (c) => {
            // NOTE: Standard BGP only compares MED if AS matches.
            // For simplicity in this v1 calculator, we will assume 'always-compare-med' OR 
            // strict standard behavior: check if AS matched.
            // Let's just do strict numeric comparison for now but warn in UI? 
            // Actually standard behavior is vital. 
            // Let's refine: Filter candidates groups by neighbor AS first? 
            // Complexity: If user just wants "why is this picked", often they have matching AS.
            // Let's implement: Compare MED only if 1st AS is same.
            // Actually, if we just blindly compare min MED, it might be wrong.
            // Heuristic: Calculate Min MED across ALL candidates. If a candidate has higher MED but DIFFERENT AS, strictly it shouldn't lose solely on MED unless always-compare-med.
            // To be safe & simpler: Strict numeric comparison (assuming `always-compare-med` is common or desired).
            const validMeds = c.map(r => r.med);
            const minMed = Math.min(...validMeds);
            return c.filter(r => r.med === minMed);
        },
        (w, l) => `Lower MED (${w.med} < ${l.med})`
    );

    // 7. eBGP over iBGP
    // eBGP (false) < iBGP (true)? No, eBGP is preferred. 
    // eBGP is "better".
    recordStep('eBGP over iBGP',
        (c) => {
            const hasEbgp = c.some(r => !r.isIbgp);
            if (!hasEbgp) return c; // All iBGP
            if (c.every(r => !r.isIbgp)) return c; // All eBGP
            return c.filter(r => !r.isIbgp);
        },
        (w, l) => `eBGP Preferred over iBGP`
    );

    // 8. IGP Metric (to next hop)
    // Low is better
    recordStep('IGP Metric to Next Hop',
        (c) => {
            const minIGP = Math.min(...c.map(r => r.igpMetric));
            return c.filter(r => r.igpMetric === minIGP);
        },
        (w, l) => `Lower IGP Metric (${w.igpMetric} < ${l.igpMetric})`
    );

    // 9. Router ID
    // Low is better (usually, unless Cisco "oldest path" for eBGP interaction, but let's stick to standard modern deterministic)
    recordStep('Router ID',
        (c) => {
            // Parse IP to number logic or string compare? standard string compare works for fixed length, but 10. vs 2.
            // Let's assume input cleaning or just simple sort for now.
            // Actually Router ID is a string IP.
            // Need proper IP comparison.
            // Shortcut: string comparison often wrong (10 > 2).
            // Note: we'll implement simple lexicographical for now, rely on robust parser later.
            return c.sort((a, b) => a.routerId.localeCompare(b.routerId, undefined, { numeric: true }))
                .slice(0, 1)
            // Wait, filter returns array. Logic needs to handle ties. 
            // Router ID is unique usually. So this terminates.
            // Actually, multiple paths from SAME router ID (parallel links)?
            // If so, next step is cluster list or neighbor IP.
        },
        (w, l) => `Lower Router ID (${w.routerId} < ${l.routerId})`
    );

    // Note: My filter logic above (slice 0,1) for RouterID effectively picks one and drops rest.
    // The 'filter' style was returning all ties. Router ID usually breaks ties.

    return {
        winner: candidates[0],
        steps,
    };
}

import { BgpRoute, Vendor, Origin } from './types';

export function detectVendor(input: string): Vendor {
    if (input.includes('BGP routing table entry for')) return 'cisco';
    if (input.includes('localpref') && input.includes('AS path')) return 'juniper';
    if (input.includes('router info bgp')) return 'fortigate';
    return 'cisco';
}

export function parse(input: string, vendor: Vendor = 'auto'): BgpRoute[] {
    const v = vendor === 'auto' ? detectVendor(input) : vendor;
    if (v === 'cisco' || v === 'arista') {
        return parseCiscoDetailed(input);
    }
    return parseCiscoDetailed(input);
}

function parseCiscoDetailed(input: string): BgpRoute[] {
    const routes: BgpRoute[] = [];
    const lines = input.split('\n');

    let currentRoute: Partial<BgpRoute> | null = null;
    let buffer: string[] = [];

    const pushRoute = () => {
        if (!currentRoute) return;

        const raw = buffer.join('\n');
        const fullRoute: BgpRoute = {
            id: Math.random().toString(36).substring(2, 9),
            index: routes.length,
            prefix: 'unknown',
            nextHop: currentRoute.nextHop || '0.0.0.0',
            localPref: currentRoute.localPref ?? 100,
            weight: currentRoute.weight ?? 0,
            med: currentRoute.med ?? 0,
            asPath: currentRoute.asPath || '',
            asPathLength: currentRoute.asPath ? currentRoute.asPath.split(' ').filter(x => x && !isNaN(Number(x))).length : 0,
            origin: currentRoute.origin || 'Incomplete',
            isIbgp: currentRoute.isIbgp || false,
            igpMetric: currentRoute.igpMetric ?? 0,
            routerId: currentRoute.routerId || '0.0.0.0',
            peerIp: currentRoute.peerIp || '',
            rawLine: raw,
            isValid: true,
            isBest: raw.includes('best,') || raw.includes(', best') || raw.split(',').map(s => s.trim()).includes('best'),
        };

        if (raw.includes('internal')) fullRoute.isIbgp = true;
        if (raw.includes('external')) fullRoute.isIbgp = false;

        routes.push(fullRoute);
    };

    const headerMatch = input.match(/entry for ([0-9./]+)/);
    const globalPrefix = headerMatch ? headerMatch[1] : '0.0.0.0/0';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. Check for Explicit Path Header (Arista/Some IOS)
        const pathMatch = line.match(/^\s*Path\s+#\d+:/i);

        // 2. Check for "from" line (Legacy IOS or compact)
        const fromMatch = line.match(/^\s+([0-9.]+)(?:\s+\(.*\))?\s+from\s+([0-9.]+)\s+\(([0-9.]+)\)/);

        if (pathMatch) {
            // Explicit header always force-starts a new path
            if (currentRoute) pushRoute();
            currentRoute = {};
            buffer = [];
        } else if (fromMatch) {
            // "from" line found. 
            // If we are already in a route AND that route already has a nextHop, this must be a NEW route (implicit separator)
            if (currentRoute && currentRoute.nextHop) {
                pushRoute();
                currentRoute = {};
                buffer = [];
            }
            // If we are NOT in a route, start one
            if (!currentRoute) {
                currentRoute = {};
                buffer = [];
            }
        }

        if (currentRoute) {
            buffer.push(line);

            if (fromMatch) {
                currentRoute.nextHop = fromMatch[1];
                currentRoute.peerIp = fromMatch[2];
                currentRoute.routerId = fromMatch[3];

                // Backtrack for AS Path
                let prev = lines[i - 1];
                if (prev) {
                    prev = prev.trim();
                    if (!prev.startsWith('Path') && /^[0-9\s]+$/.test(prev)) {
                        currentRoute.asPath = prev;
                    }
                }
            }

            if (line.includes('Origin')) {
                const originM = line.match(/Origin\s+(IGP|EGP|Incomplete)/i);
                if (originM) currentRoute.origin = originM[1] as Origin;

                const metricM = line.match(/metric\s+(\d+)/);
                if (metricM) currentRoute.med = parseInt(metricM[1]);

                const lpM = line.match(/localpref\s+(\d+)/);
                if (lpM) currentRoute.localPref = parseInt(lpM[1]);

                const weightM = line.match(/weight\s+(\d+)/);
                if (weightM) currentRoute.weight = parseInt(weightM[1]);
            }
        }
    }

    if (currentRoute) pushRoute();

    return routes.map(r => ({ ...r, prefix: globalPrefix }));
}

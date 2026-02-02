import { BgpRoute, Vendor, Origin } from './types';

export function detectVendor(input: string): Vendor {
    if (input.includes('BGP routing table entry for')) return 'cisco'; // Standard IOS/Arista often matches this or similar
    if (input.includes('localpref') && input.includes('AS path')) return 'juniper'; // Junos typical casing
    if (input.includes('router info bgp')) return 'fortigate';
    return 'cisco'; // Default fallback
}

export function parse(input: string, vendor: Vendor = 'auto'): BgpRoute[] {
    const v = vendor === 'auto' ? detectVendor(input) : vendor;
    // For now, mapping everyone to a generic parser or specific if confident
    if (v === 'cisco' || v === 'arista') {
        return parseCiscoDetailed(input);
    }
    return parseCiscoDetailed(input); // Fallback
}

// Simple Parser for "show ip bgp x.x.x.x" detailed output
function parseCiscoDetailed(input: string): BgpRoute[] {
    const routes: BgpRoute[] = [];
    const lines = input.split('\n');

    // Heuristic: Split by "  Path" or just look for blocks starting with AS Path or Next Hop logic
    // Typically Cisco detail output has blocks of paths.
    // We'll iterate line by line and find "blocks".

    // Identifying a start of a path:
    // Usually the line containing the AS path comes first, OR the next hop line.
    // "  65001 65002"
    // "    192.168.1.1 from ..."

    // Implementation: Accumulate lines into chunks based on indentation or markers.
    // Let's look for the line "    <IP> from <IP> (<RouterID>)"

    let currentRoute: Partial<BgpRoute> | null = null;
    let buffer: string[] = []; // buffer lines for current route

    // Function to finalize a route
    const pushRoute = () => {
        if (!currentRoute) return;

        const raw = buffer.join('\n');
        const fullRoute: BgpRoute = {
            id: Math.random().toString(36).substring(2, 9),
            index: routes.length,
            prefix: 'unknown', // Need to grab from header
            nextHop: currentRoute.nextHop || '0.0.0.0',
            localPref: currentRoute.localPref ?? 100, // Default 100
            weight: currentRoute.weight ?? 0,
            med: currentRoute.med ?? 0,
            asPath: currentRoute.asPath || '',
            asPathLength: currentRoute.asPath?.split(' ').filter(x => x).length || 0,
            origin: currentRoute.origin || 'Incomplete',
            isIbgp: currentRoute.isIbgp || false, // Default ebgp? Check flags.
            igpMetric: currentRoute.igpMetric ?? 0,
            routerId: currentRoute.routerId || '0.0.0.0',
            peerIp: currentRoute.peerIp || '',
            rawLine: raw,
            isValid: true, // assume true unless 'inaccessible' found
            isBest: raw.includes('best'),
        };

        // Correction: Valid/External flags parsing
        if (raw.includes('internal')) fullRoute.isIbgp = true;
        if (raw.includes('external')) fullRoute.isIbgp = false;

        routes.push(fullRoute);
    };

    // Header parsing (first line often has prefix)
    // "BGP routing table entry for 10.0.0.0/24, version 2"
    const headerMatch = input.match(/entry for ([0-9./]+)/);
    const globalPrefix = headerMatch ? headerMatch[1] : '0.0.0.0/0';

    // Chunking Logic
    // We scan for the line that looks like "    1.2.3.4 from ..." which is the distinct center of a block
    // But AS path is often line before.
    // Regex for the "from" line: /^\s+([0-9.]+)\s+from\s+([0-9.]+)\s+\(([0-9.]+)\)/

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for "from" line which is a strong anchor
        const fromMatch = line.match(/\s+([0-9.]+)\s+from\s+([0-9.]+)\s+\(([0-9.]+)\)/);

        if (fromMatch) {
            if (currentRoute) pushRoute(); // Find start of new route -> push old

            currentRoute = {};
            buffer = [];

            // Capture details
            currentRoute.nextHop = fromMatch[1];
            currentRoute.peerIp = fromMatch[2];
            currentRoute.routerId = fromMatch[3];

            // Look backward for AS Path?
            // Usually line before "from" is AS path regex: /^\s+([0-9 ]+)$/
            // Loop back 1-2 lines in `lines` array?
            // Or just assume AS Path is previously parsed?
            // Being stateful inside this loop is hard.
            // Better approach: State Machine.

            // Let's assume the previous line was AS Path if it matched digits
            const prev = lines[i - 1];
            if (prev && /^\s*([0-9 ]+)\s*$/.test(prev)) {
                currentRoute.asPath = prev.trim();
                buffer.unshift(prev); // Add to buffer
            } else {
                currentRoute.asPath = ''; // Local?
            }
        }

        if (currentRoute) {
            buffer.push(line);

            // Parse attributes in current block
            // "Origin IGP, metric 0, localpref 100, valid, external, best"
            if (line.includes('Origin')) {
                const originM = line.match(/Origin\s+(IGP|EGP|Incomplete)/i);
                if (originM) currentRoute.origin = originM[1] as Origin;

                const metricM = line.match(/metric\s+(\d+)/);
                if (metricM) currentRoute.med = parseInt(metricM[1]); // Metric in output usually means MED

                const lpM = line.match(/localpref\s+(\d+)/);
                if (lpM) currentRoute.localPref = parseInt(lpM[1]);

                const weightM = line.match(/weight\s+(\d+)/); // Sometimes on separate line?
                if (weightM) currentRoute.weight = parseInt(weightM[1]);
            }

            // Check for standalone "weight 32768" line
            // Or "metric 10"
        }
    }

    if (currentRoute) pushRoute(); // Push last

    return routes.map(r => ({ ...r, prefix: globalPrefix }));
}

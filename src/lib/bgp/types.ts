export type Vendor = 'auto' | 'cisco' | 'arista' | 'juniper' | 'fortigate';

export type Origin = 'IGP' | 'EGP' | 'Incomplete';

export interface BgpRoute {
    id: string; // Unique ID for UI rendering
    index: number; // Original index in the list
    prefix: string;
    nextHop: string;
    localPref: number;
    weight: number;
    med: number;
    asPath: string; // "65001 65002"
    asPathLength: number;
    origin: Origin;
    isIbgp: boolean; // true if iBGP, false if eBGP
    igpMetric: number;
    routerId: string;
    peerIp: string;

    // Attributes specific to parsing/display
    rawLine: string; // The main line summarizing this route
    isValid: boolean; // Accessible next hop?
    isBest: boolean; // Did the CLI mark it as best? (for verification)
}

export interface StepResult {
    stepName: string;
    winnerIds: string[]; // IDs of routes that survived this step
    loserIds: string[]; // IDs of routes eliminated this step
    reason: string; // e.g., "Higher Local Preference (200 vs 100)"
}

export interface AnalysisResult {
    winner?: BgpRoute;
    steps: StepResult[];
    error?: string;
}

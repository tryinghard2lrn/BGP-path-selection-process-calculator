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

export interface DecisionCandidate {
    routeId: string;
    value: string | number | boolean;
    isBest: boolean; // Did it survive this step?
}

export interface StepResult {
    stepName: string;
    candidates: DecisionCandidate[];
    reason: string;
}

export interface AnalysisResult {
    winner?: BgpRoute;
    steps: StepResult[];
    error?: string;
}


export interface RankedStep {
    rank: number;
    route: BgpRoute;
    reason: string; // concise reason for this specific win
    subAnalysis: AnalysisResult; // context of this win
}

export interface RankedAnalysis {
    ranking: RankedStep[];
}

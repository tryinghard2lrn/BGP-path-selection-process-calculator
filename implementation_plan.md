# Interactive Simulation & Detailed Ranking Plan

## Goals
1.  **Interactive Matrix**: Allow users to edit BGP attributes (Local Pref, MED, AS Path, etc.) directly in the result table to simulate "What If" scenarios.
2.  **Ranking Explanations**: Explicitly state why the runner-up beat the 3rd place, etc.
3.  **Label Clarity**: Rename "MED" to "MED (BGP Attribute)" and "IGP Metric" to "IGP Cost".

## Architecture Changes

### 1. Engine (`src/lib/bgp/engine.ts`)
*   Update `RankedAnalysis` to store a *list* of results, not just one primary analysis.
*   `rankedRoutes` should carry context: `[{ route: BgpRoute, reasonForWinning: string }]`.
    *   Example: Route B is #2. Why? Because when compared against C, D, E, it won on "Router ID".

### 2. State Management (`src/components/BgpCalculator.tsx`)
*   Introduce `overrides` state: `Record<string, Partial<BgpRoute>>`.
*   Key = `route.id`.
*   Effect: `effectiveRoutes` = `routes.map(r => ({ ...r, ...overrides[r.id] }))`.
*   Pass `effectiveRoutes` to `analyzeAndRank`.

### 3. UI Components
*   **Editable Cells**: Convert static text cells to `<input>` or a custom EditableCell component.
    *   Handle number vs string parsing.
*   **Ranking Badges**: Add tooltips or subtitles to 2nd/3rd badges: "Beat Path #X on Local Preference".
*   **Column Reordering**: (Optional but good) Sort columns by Rank (1st, 2nd, 3rd) so the logic flow is clearer? User didn't ask, but might help. I'll stick to fixed columns for now to preserve input context.

## Data Structures

```typescript
// types.ts
export interface RankedStep {
    rank: number;
    route: BgpRoute;
    reason: string; // "Won against 2 remaining candidates on Local Pref"
    subAnalysis: AnalysisResult; // The specific battle for this rank
}

export interface RankedAnalysis {
    ranking: RankedStep[]; 
}
```

## Step-by-Step Implementation
1.  **Modify `types.ts`**: Update `RankedAnalysis`.
2.  **Modify `engine.ts`**: Update `analyzeAndRank` to capture sub-analysis for each recursion level.
3.  **Modify `BgpCalculator.tsx`**:
    *   Implement `useEffect` for merging overrides.
    *   Render inputs.
    *   Display per-rank reasons.

# BGP Path Selection Calculator - Implementation Blueprint

## Stack Choice
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (using `shadcn/ui` components if possible, or raw Tailwind for speed)
- **Testing:** Jest + React Testing Library (Critical for verifying BGP logic)
- **Deployment:** Vercel

## Architecture
The application will consist of a pure logic layer (parsing + selection) and a reactive UI.

### 1. Core Logic (`src/lib/bgp`)
- **`BgpRoute` Interface:** Standardized object holding all potential BGP attributes (prefix, nextHop, localPref, med, asPath, weight, origin, etc.).
- **`Parser` Strategy:**
  - `detectVendor(input: string): Vendor`
  - `parseCisco(input: string): BgpRoute[]`
  - `parseArista(input: string): BgpRoute[]`
  - `parseJuniper(input: string): BgpRoute[]`
  - `parseFortigate(input: string): BgpRoute[]`
- **`SelectionEngine`:**
  - `compareRoutes(backend: Vendor, routes: BgpRoute[]): AnalysisResult`
  - Returns the "Winner" and a list of "Losers" with the exact reason/step they failed (e.g., "Step 3: Lower Local Preference").

### 2. UI Components
- **InputArea:** Large text area for pasting raw CLI output.
- **Controls:** Dropdown for Vendor (Default: Auto-detect).
- **ResultDisplay:**
  - **Winner Card:** Prominent display of the best path.
  - **Decision Log:** Step-by-step breakdown of why the winner won (e.g., "Tie on Weight -> Tie on Local Pref -> Won on AS Path Length").
  - **Loser Table:** Greyed out candidates showing where they dropped out.

## Init Command
```bash
# Initialize Next.js project non-interactively
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-git
# Install testing dependencies
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom ts-node
# Install UI helpers
npm install lucide-react clsx tailwind-merge
```

## Test Command
```bash
npm test
```

## Implementation Plan
1.  **Scaffold:** Run init commands.
2.  **Config:** Setup Jest for TypeScript.
3.  **Parsers:** Implement regex-based parsers for the 4 vendors.
4.  **Engine:** Implement the "Decision Chain" logic (Weight -> LocPref -> AS Path -> ...).
5.  **UI:** Build the interaction layer.
6.  **Verify:** Feed real `show ip bgp` outputs from research phase into the tool.

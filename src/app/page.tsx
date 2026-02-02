import BgpCalculator from '@/components/BgpCalculator';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              BGP Path Selection <span className="text-blue-600">Calculator</span>
            </h1>
            <p className="text-slate-500 mt-2 text-lg">
              Visualize the decision process. Paste your <code>show ip bgp</code> comparison.
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-600">
              v1.0 • Antigravity
            </span>
          </div>
        </header>

        <BgpCalculator />

      </div>
    </main>
  );
}

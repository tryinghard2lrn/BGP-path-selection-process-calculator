'use client';
import React, { useState, useEffect } from 'react';
import { parse } from '@/lib/bgp/parsers';
import { compareRoutes } from '@/lib/bgp/engine';
import { AnalysisResult, BgpRoute } from '@/lib/bgp/types';
import { CheckCircle, Info, Activity, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export default function BgpCalculator() {
    const [input, setInput] = useState('');
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [routes, setRoutes] = useState<BgpRoute[]>([]);

    useEffect(() => {
        if (!input.trim()) {
            setResult(null);
            return;
        }
        try {
            const parsedRoutes = parse(input);
            setRoutes(parsedRoutes);
            const res = compareRoutes(parsedRoutes); // Assuming generic or auto-detect logic is inside engine/parsers
            setResult(res);
        } catch (e) {
            console.error(e);
        }
    }, [input]);

    // Helper to extract the value for a specific route in a specific step
    // Returns { value, status } where status = 'survived' | 'eliminated' | 'previously-eliminated'
    const getCellData = (stepIndex: number, routeId: string) => {
        if (!result) return { value: '-', status: 'previously-eliminated' };

        const step = result.steps[stepIndex];
        const candidate = step.candidates.find(c => c.routeId === routeId);

        if (candidate) {
            return {
                value: String(candidate.value),
                status: candidate.isBest ? 'survived' : 'eliminated'
            };
        }

        // If not in candidates, it was eliminated in a previous step
        return { value: '', status: 'previously-eliminated' };
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
            {/* Left Input Pane */}
            <div className="flex flex-col gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Paste BGP Command Output
                    </label>
                    <div className="bg-slate-50 p-3 rounded-md mb-2 text-xs text-slate-500 border border-slate-200">
                        Supported: Cisco IOS/NX-OS, Arista EOS Details <br />
                        Example: <code>show ip bgp 1.2.3.4</code> (Detailed View)
                    </div>
                    <textarea
                        className="w-full h-96 p-4 font-mono text-xs bg-slate-900 text-slate-50 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="BGP routing table entry for ..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    />
                </div>
            </div>

            {/* Right Result Pane */}
            <div className="flex flex-col gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[500px]">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Activity className="text-blue-600" />
                        Path Analysis
                    </h2>

                    {!result ? (
                        <div className="text-center text-slate-400 mt-20">
                            <Info className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>Paste output to begin analysis</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8">

                            {/* Winner Card */}
                            {result.winner && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="bg-emerald-200 text-emerald-800 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                                                Best Path Selected
                                            </span>
                                            <h3 className="text-lg font-mono font-bold text-emerald-900 mt-2">
                                                via {result.winner.nextHop} (Path #{result.winner.index + 1})
                                            </h3>
                                        </div>
                                        <CheckCircle className="text-emerald-500 w-8 h-8" />
                                    </div>
                                </div>
                            )}

                            {/* Comparison Table */}
                            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 whitespace-nowrap min-w-[140px]">Metric / Step</th>
                                            {routes.map((r, i) => (
                                                <th key={r.id} className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                                                    <div className={clsx(
                                                        "font-bold text-sm mb-1",
                                                        r.index === result.winner?.index ? "text-emerald-600" : "text-slate-700"
                                                    )}>
                                                        Path #{r.index + 1}
                                                    </div>
                                                    <div className="text-slate-500">{r.nextHop}</div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {result.steps.map((step, stepIdx) => (
                                            <tr key={stepIdx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-slate-600">
                                                    {step.stepName}
                                                    {step.reason !== 'Tie' && (
                                                        <div className="text-xs text-blue-500 font-normal mt-0.5 max-w-[150px] leading-tight">
                                                            {step.reason}
                                                        </div>
                                                    )}
                                                </td>
                                                {routes.map(r => {
                                                    const { value, status } = getCellData(stepIdx, r.id);
                                                    return (
                                                        <td key={r.id} className="px-4 py-3 border-l border-slate-50">
                                                            <div className={clsx(
                                                                "font-mono rounded px-2 py-1 inline-block",
                                                                status === 'survived' && "bg-emerald-50 text-emerald-700 font-bold",
                                                                status === 'eliminated' && "bg-red-50 text-red-700 line-through decoration-red-400 opacity-70",
                                                                status === 'previously-eliminated' && "text-slate-300"
                                                            )}>
                                                                {value || '—'}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

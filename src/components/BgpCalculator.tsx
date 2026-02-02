'use client';
import React, { useState, useEffect } from 'react';
import { parse } from '@/lib/bgp/parsers';
import { analyzeAndRank } from '@/lib/bgp/engine';
import { AnalysisResult, BgpRoute, RankedAnalysis } from '@/lib/bgp/types';
import { CheckCircle, Info, Activity, XCircle, Check, ArrowRight, ShieldAlert, Award } from 'lucide-react';
import clsx from 'clsx';

export default function BgpCalculator() {
    const [input, setInput] = useState('');
    const [analysis, setAnalysis] = useState<RankedAnalysis | null>(null);
    const [routes, setRoutes] = useState<BgpRoute[]>([]);

    useEffect(() => {
        if (!input.trim()) {
            setAnalysis(null);
            return;
        }
        try {
            const parsedRoutes = parse(input);
            setRoutes(parsedRoutes);
            // Use new rank analyzer
            const res = analyzeAndRank(parsedRoutes);
            setAnalysis(res);
        } catch (e) {
            console.error(e);
        }
    }, [input]);

    const getRank = (routeId: string) => {
        if (!analysis) return -1;
        return analysis.rankedRoutes.findIndex(r => r.id === routeId) + 1;
    };

    const getCellData = (stepIndex: number, routeId: string, result: AnalysisResult) => {
        const step = result.steps[stepIndex];
        const candidate = step.candidates.find(c => c.routeId === routeId);

        if (candidate) {
            return {
                value: String(candidate.value),
                status: candidate.isBest ? 'survived' : 'eliminated'
            };
        }
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

                    {!analysis ? (
                        <div className="text-center text-slate-400 mt-20">
                            <Info className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>Paste output to begin analysis</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8">

                            {/* Winner Card */}
                            {analysis.rankedRoutes[0] && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="bg-emerald-200 text-emerald-800 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                                                Best Path Selected
                                            </span>
                                            <h3 className="text-lg font-mono font-bold text-emerald-900 mt-2">
                                                via {analysis.rankedRoutes[0].nextHop} (Path #{analysis.rankedRoutes[0].index + 1})
                                            </h3>
                                        </div>
                                        <CheckCircle className="text-emerald-500 w-8 h-8" />
                                    </div>
                                </div>
                            )}

                            {/* AS Path Visualization (Idea 4) */}
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">AS Graph Visualization</h3>
                                <div className="space-y-4">
                                    {routes.map((r) => {
                                        const asList = r.asPath ? r.asPath.split(' ') : [];
                                        return (
                                            <div key={r.id} className="flex flex-col gap-1">
                                                <div className="text-xs font-mono font-bold text-slate-600 mb-1">
                                                    Path #{r.index + 1} ({r.nextHop})
                                                    {r.id === analysis.rankedRoutes[0].id && (
                                                        <span className="ml-2 text-emerald-600 bg-emerald-100 px-1.5 rounded text-[10px]">WINNER</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 text-sm font-mono">

                                                    {/* Local Router */}
                                                    <div className="bg-slate-200 text-slate-700 px-2 py-1 rounded border border-slate-300">
                                                        Local
                                                    </div>
                                                    <ArrowRight className="w-3 h-3 text-slate-400" />

                                                    {/* Next Hop */}
                                                    <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">
                                                        {r.nextHop}
                                                    </div>

                                                    {/* AS Path Nodes */}
                                                    {asList.map((as, idx) => (
                                                        <React.Fragment key={idx}>
                                                            <ArrowRight className="w-3 h-3 text-slate-400" />
                                                            <div className="bg-white text-slate-800 px-2 py-1 rounded border border-slate-300 shadow-sm">
                                                                AS {as}
                                                            </div>
                                                        </React.Fragment>
                                                    ))}

                                                    {/* Origin */}
                                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                                    <div className="text-slate-500 italic text-xs border border-transparent px-1">
                                                        ({r.origin})
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Comparison Table */}
                            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 whitespace-nowrap min-w-[140px]">Metric / Step</th>
                                            {routes.map((r, i) => {
                                                const rank = getRank(r.id);
                                                return (
                                                    <th key={r.id} className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                                                        <div className={clsx(
                                                            "font-bold text-sm mb-1 flex items-center gap-1",
                                                            rank === 1 ? "text-emerald-600" : "text-slate-700"
                                                        )}>
                                                            Path #{r.index + 1}
                                                            {/* Ranking Badge */}
                                                            {rank === 1 && <Award className="w-4 h-4 text-emerald-500" />}
                                                            {rank === 2 && <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full">2nd</span>}
                                                            {rank === 3 && <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full">3rd</span>}
                                                        </div>
                                                        <div className="text-slate-500">{r.nextHop}</div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {analysis.primaryAnalysis.steps.map((step, stepIdx) => (
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
                                                    const { value, status } = getCellData(stepIdx, r.id, analysis.primaryAnalysis);
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

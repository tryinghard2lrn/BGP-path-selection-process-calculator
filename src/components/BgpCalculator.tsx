'use client';
import React, { useState, useEffect } from 'react';
import { parse } from '@/lib/bgp/parsers';
import { compareRoutes } from '@/lib/bgp/engine';
import { AnalysisResult, BgpRoute } from '@/lib/bgp/types';
import { CheckCircle, Info, Activity, XCircle, Check } from 'lucide-react';
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
            const res = compareRoutes(parsedRoutes);
            setResult(res);
        } catch (e) {
            console.error(e);
            // Fail gracefully
        }
    }, [input]);

    const getRouteName = (id: string) => {
        const r = routes.find(x => x.id === id);
        return r ? `Path #${r.index + 1}` : id;
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
                        <div className="flex flex-col gap-6">

                            {/* Winner Card */}
                            {result.winner && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <span className="bg-emerald-200 text-emerald-800 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                                                Best Path Selected
                                            </span>
                                            <h3 className="text-lg font-mono font-bold text-emerald-900 mt-2">
                                                Path #{result.winner.index + 1} via {result.winner.nextHop}
                                            </h3>
                                            <div className="text-sm text-emerald-700">
                                                Neighbor: {result.winner.peerIp || 'N/A'} (Router ID: {result.winner.routerId})
                                            </div>
                                        </div>
                                        <CheckCircle className="text-emerald-500 w-8 h-8" />
                                    </div>

                                    {/* Winning Stats */}
                                    <div className="grid grid-cols-2 gap-y-2 text-sm text-emerald-800/80 font-mono">
                                        <div>Local Pref: {result.winner.localPref}</div>
                                        <div>Weight: {result.winner.weight}</div>
                                        <div>AS Path: {result.winner.asPath} ({result.winner.asPathLength})</div>
                                        <div>MED: {result.winner.med}</div>
                                        <div>Origin: {result.winner.origin}</div>
                                        <div>Type: {result.winner.isIbgp ? 'iBGP' : 'eBGP'}</div>
                                    </div>
                                </div>
                            )}

                            {/* Detailed Decision Matrix */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Decision Breakdown</h3>
                                <div className="space-y-4">
                                    {result.steps.map((step, idx) => (
                                        <div key={idx} className="border border-slate-100 rounded-lg overflow-hidden">
                                            {/* Step Header */}
                                            <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                                                <span className="font-semibold text-slate-700 text-sm">
                                                    {idx + 1}. {step.stepName}
                                                </span>
                                                {step.reason !== 'Tie' && (
                                                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                        {step.reason}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Candidates List */}
                                            <div className="divide-y divide-slate-50">
                                                {step.candidates.map((cand) => (
                                                    <div key={cand.routeId} className={clsx(
                                                        "flex items-center justify-between px-4 py-2 text-sm",
                                                        cand.isBest ? "bg-white" : "bg-slate-50/50 opacity-60"
                                                    )}>
                                                        <div className="flex items-center gap-2">
                                                            {cand.isBest ? (
                                                                <Check className="w-4 h-4 text-emerald-500" />
                                                            ) : (
                                                                <XCircle className="w-4 h-4 text-red-400" />
                                                            )}
                                                            <span className={clsx("font-mono", cand.isBest ? "text-slate-800" : "text-slate-500")}>
                                                                {getRouteName(cand.routeId)}
                                                            </span>
                                                        </div>
                                                        <div className="font-mono font-medium">
                                                            {String(cand.value)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

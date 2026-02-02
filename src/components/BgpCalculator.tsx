'use client';
import React, { useState, useEffect } from 'react';
import { parse } from '@/lib/bgp/parsers';
import { compareRoutes } from '@/lib/bgp/engine';
import { AnalysisResult, BgpRoute } from '@/lib/bgp/types';
import { AlertCircle, CheckCircle, Info, ChevronDown, ChevronRight, Activity } from 'lucide-react';

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
                                                Next Hop: {result.winner.nextHop}
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
                                        <div>AS Path Len: {result.winner.asPathLength}</div>
                                        <div>MED: {result.winner.med}</div>
                                        <div>Origin: {result.winner.origin}</div>
                                    </div>
                                </div>
                            )}

                            {/* Decision Log */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Decision Logic</h3>
                                <div className="space-y-3">
                                    {result.steps.map((step, idx) => (
                                        <div key={idx} className="relative pl-6 border-l-2 border-slate-200">
                                            {/* Step Marker */}
                                            <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ${step.loserIds.length > 0 ? 'bg-blue-500' : 'bg-slate-300'}`} />

                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="text-sm font-medium text-slate-900">{step.stepName}</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">{step.reason}</div>
                                                </div>
                                                {step.loserIds.length > 0 && (
                                                    <div className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">
                                                        -{step.loserIds.length} Routes Dropped
                                                    </div>
                                                )}
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

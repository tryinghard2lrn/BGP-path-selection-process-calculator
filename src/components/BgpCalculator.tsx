'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { parse } from '@/lib/bgp/parsers';
import { analyzeAndRank, EngineOptions } from '@/lib/bgp/engine';
import { AnalysisResult, BgpRoute, RankedAnalysis, RankedStep } from '@/lib/bgp/types';
import { CheckCircle, Info, Activity, XCircle, Check, ArrowRight, ShieldAlert, Award, Settings2, HelpCircle } from 'lucide-react';
import clsx from 'clsx';

// Components for editing
const EditableCell = ({
    value,
    onChange,
    type = 'text',
    disabled = false
}: {
    value: string | number | boolean;
    onChange: (val: string | number | boolean) => void;
    type?: 'text' | 'number' | 'boolean';
    disabled?: boolean;
}) => {
    const [localVal, setLocalVal] = useState(String(value));

    // Update local state when prop changes
    useEffect(() => {
        setLocalVal(String(value));
    }, [value]);

    const handleBlur = () => {
        if (type === 'number') {
            const num = parseInt(localVal);
            onChange(isNaN(num) ? 0 : num);
        } else if (type === 'boolean') {
            // Usually dropdown for boolean
        } else {
            onChange(localVal);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBlur();
            (e.target as HTMLInputElement).blur();
        }
    };

    if (type === 'boolean') {
        return (
            <select
                value={String(value)}
                onChange={(e) => onChange(e.target.value === 'true')}
                disabled={disabled}
                className="bg-transparent border-none text-xs font-mono focus:ring-0 cursor-pointer w-full text-center"
            >
                <option value="true">Yes</option>
                <option value="false">No</option>
            </select>
        );
    }

    return (
        <input
            type="text"
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-white rounded px-1 py-0.5 text-center font-mono text-xs transition-colors"
        />
    );
};

export default function BgpCalculator() {
    const [input, setInput] = useState('');

    // Original parsed routes
    const [baseRoutes, setBaseRoutes] = useState<BgpRoute[]>([]);

    // User overrides: Map<RouteID, Partial<BgpRoute>>
    const [overrides, setOverrides] = useState<Record<string, Partial<BgpRoute>>>({});

    // Final effective routes (Base + Overrides)
    const effectiveRoutes = useMemo(() => {
        return baseRoutes.map(r => ({
            ...r,
            ...(overrides[r.id] || {})
        }));
    }, [baseRoutes, overrides]);

    const [analysis, setAnalysis] = useState<RankedAnalysis | null>(null);

    // We removed 'ignoreAsPathLength' toggle in favor of direct editing, 
    // but we can keep options structure if needed later.
    const [options, setOptions] = useState<EngineOptions>({});

    useEffect(() => {
        if (!input.trim()) {
            setBaseRoutes([]);
            setOverrides({}); // Reset overrides when input clears? Or keep? Reset seems safer.
            return;
        }
        try {
            const parsed = parse(input);
            setBaseRoutes(parsed);

            // Preserve overrides if route IDs align? 
            // Route IDs are random based on order, so reloading creates new IDs.
            // Reset overrides on new parse to avoid zombie state.
            setOverrides({});
        } catch (e) {
            console.error(e);
        }
    }, [input]);

    useEffect(() => {
        if (effectiveRoutes.length === 0) {
            setAnalysis(null);
            return;
        }
        const res = analyzeAndRank(effectiveRoutes, 'auto', options);
        setAnalysis(res);
    }, [effectiveRoutes, options]);

    // Update specific field for a route
    const handleUpdate = (routeId: string, field: keyof BgpRoute, val: any) => {
        setOverrides(prev => ({
            ...prev,
            [routeId]: {
                ...(prev[routeId] || {}),
                [field]: val
            }
        }));
    };

    // Helper to find ranking info for a route
    const getRankInfo = (routeId: string) => {
        if (!analysis) return null;
        return analysis.ranking.find(step => step.route.id === routeId);
    };

    // Helper to get cell data from the sub-analysis of the HIGHEST visible rank context
    // Actually, simple table approach: 
    // The "Comparison Table" usually shows the "Battle for 1st Place".
    // But now we have 2nd place, 3rd place logic. 
    // If we show the "1st Place Analysis", it explains why #1 Won.
    // It implies why #2 lost (in that battle).
    // What if we show the Battle for #1?
    // And users can click "View Battle for 2nd" tab? 
    // OR we just show the metric values (effective) and highlight the winner of the *current* 1st place battle.
    // The user wants "recalculates". So if I change #2's LP to 300, #2 becomes #1.
    // So we ALWAYS show the battle for #1.
    // And we explain ranking via separate badges/text.

    const primaryAnalysis = analysis?.ranking[0]?.subAnalysis; // Battle for 1st

    const getCellData = (stepIndex: number, routeId: string) => {
        if (!primaryAnalysis) return { value: '', status: 'unknown' };

        const step = primaryAnalysis.steps[stepIndex];
        const candidate = step.candidates.find(c => c.routeId === routeId);

        if (candidate) {
            return {
                value: candidate.value, // Raw value
                status: candidate.isBest ? 'survived' : 'eliminated'
            };
        }
        // If not in candidate list, it was eliminated in a previous step?
        // Wait, our new engine returns ALL candidates every step.
        return { value: '', status: 'unknown' };
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
            {/* Input Pane */}
            <div className="flex flex-col gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Paste BGP Command Output
                    </label>
                    <textarea
                        className="w-full h-96 p-4 font-mono text-xs bg-slate-900 text-slate-50 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="show ip bgp 1.1.1.1 ..."
                    />
                </div>
            </div>

            {/* Results Pane */}
            <div className="flex flex-col gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[500px]">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Activity className="text-blue-600" />
                            Simulation Matrix
                        </h2>
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                            Values are editable
                        </span>
                    </div>

                    {!analysis ? (
                        <div className="text-center text-slate-400 mt-20">
                            <Info className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>Paste output to begin analysis</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8">

                            {/* Ranking Summary Cards */}
                            <div className="grid grid-cols-1 gap-4">
                                {analysis.ranking.map((step) => (
                                    <div key={step.route.id}
                                        className={clsx(
                                            "border rounded-lg p-4 transition-all",
                                            step.rank === 1
                                                ? "bg-emerald-50 border-emerald-200 ring-1 ring-emerald-100"
                                                : "bg-white border-slate-200 hover:border-slate-300"
                                        )}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={clsx(
                                                        "text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                                                        step.rank === 1 ? "bg-emerald-200 text-emerald-800" : "bg-slate-100 text-slate-600"
                                                    )}>
                                                        #{step.rank} Place
                                                    </span>
                                                    <span className="font-mono text-sm font-bold text-slate-700">
                                                        Next Hop: {step.route.nextHop} (Path #{step.route.index + 1})
                                                    </span>
                                                </div>

                                                {step.rank === 1 ? (
                                                    <p className="text-emerald-700 text-sm mt-1 font-medium">
                                                        Strict Winner.
                                                    </p>
                                                ) : (
                                                    <p className="text-slate-500 text-xs mt-1">
                                                        <span className="font-semibold text-slate-700">Why #2?</span> {step.reason}
                                                    </p>
                                                )}
                                            </div>
                                            {step.rank === 1 && <CheckCircle className="text-emerald-500 w-6 h-6" />}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Main Matrix */}
                            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 whitespace-nowrap w-48">Decision Step</th>
                                            {effectiveRoutes.map((r) => {
                                                const info = getRankInfo(r.id);
                                                return (
                                                    <th key={r.id} className="px-2 py-3 min-w-[120px]">
                                                        <div className="flex flex-col items-center">
                                                            <div className={clsx(
                                                                "font-bold text-xs px-2 py-1 rounded-full mb-1",
                                                                info?.rank === 1 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                                            )}>
                                                                #{info?.rank || '?'}
                                                            </div>
                                                            <div className="font-mono text-xs text-slate-600">{r.nextHop}</div>
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {/* Dynamic Rows mapping to step names */}
                                        {[
                                            { label: 'Weight', key: 'weight', type: 'number' },
                                            { label: 'Local Preference', key: 'localPref', type: 'number' },
                                            { label: 'Locally Originated', key: 'nextHop', type: 'boolean' }, // Mock logic for display? logic checks 0.0.0.0
                                            { label: 'AS Path Length', key: 'asPathLength', type: 'number' },
                                            { label: 'Origin Code', key: 'origin', type: 'text' }, // IGP/EGP
                                            { label: 'MED (BGP Attribute)', key: 'med', type: 'number' },
                                            { label: 'eBGP over iBGP', key: 'isIbgp', type: 'boolean' }, // Inverted logic display? 
                                            { label: 'IGP Cost (Internal)', key: 'igpMetric', type: 'number' },
                                            { label: 'Router ID', key: 'routerId', type: 'text' },
                                            { label: 'Peer IP', key: 'peerIp', type: 'text' },
                                        ].map((row, idx) => {
                                            // Find the corresponding step in analysis to highlight winner/loser status
                                            // We have to match by name or index. 
                                            // engine.ts steps: Weight, Local Preference, Locally Originated... 
                                            // The naming matches "label" mostly.
                                            // actually check analysis step name.
                                            const stepData = primaryAnalysis?.steps.find(s => s.stepName === row.label);

                                            return (
                                                <tr key={row.key} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-2 font-medium text-slate-600 text-xs uppercase tracking-wide">
                                                        {row.label}
                                                        {stepData && stepData.reason !== 'Tie' && (
                                                            <div className="text-[10px] text-blue-500 normal-case font-normal leading-tight mt-0.5">
                                                                {stepData.reason}
                                                            </div>
                                                        )}
                                                    </td>
                                                    {effectiveRoutes.map((r) => {
                                                        const { status } = getCellData(analysis!.ranking[0].subAnalysis.steps.findIndex(s => s.stepName === row.label), r.id);
                                                        // Override logic: status determines Color, Input edits Value

                                                        // Special handling for boolean/enum displays if needed
                                                        // isIbgp: true -> "iBGP", false -> "eBGP"
                                                        // Locally Originated: nextHop === '0.0.0.0'

                                                        let displayType = row.type as 'text' | 'number' | 'boolean';
                                                        let editKey = row.key as keyof BgpRoute;

                                                        return (
                                                            <td key={r.id} className={clsx(
                                                                "px-2 py-1 border-l border-slate-50",
                                                                status === 'survived' ? "bg-emerald-50/50" : "bg-transparent"
                                                            )}>
                                                                <div className={clsx(
                                                                    "rounded w-full",
                                                                    status === 'eliminated' && "opacity-50 line-through decoration-red-300"
                                                                )}>
                                                                    <EditableCell
                                                                        value={r[editKey] as any}
                                                                        type={displayType}
                                                                        onChange={(val) => handleUpdate(r.id, editKey, val)}
                                                                    />
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* AS Path Visualization */}
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">AS Graph Visualization</h3>
                                <div className="space-y-4">
                                    {effectiveRoutes.map((r) => {
                                        const asList = r.asPath ? r.asPath.split(' ').filter(Boolean) : [];
                                        const rank = getRankInfo(r.id)?.rank;
                                        return (
                                            <div key={r.id} className="flex flex-col gap-1">
                                                <div className="text-xs font-mono font-bold text-slate-600 mb-1 flex items-center gap-2">
                                                    <span>Path #{r.index + 1} ({r.nextHop})</span>
                                                    {rank === 1 && <span className="bg-emerald-100 text-emerald-700 px-1.5 rounded text-[10px]">WINNER</span>}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 text-sm font-mono">
                                                    <div className="bg-slate-200 text-slate-700 px-2 py-1 rounded border border-slate-300">Local</div>
                                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                                    <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">{r.nextHop}</div>
                                                    {asList.map((as, idx) => (
                                                        <React.Fragment key={idx}>
                                                            <ArrowRight className="w-3 h-3 text-slate-400" />
                                                            <div className="bg-white text-slate-800 px-2 py-1 rounded border border-slate-300 shadow-sm">AS {as}</div>
                                                        </React.Fragment>
                                                    ))}
                                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                                    <div className="text-slate-500 italic text-xs border border-transparent px-1">({r.origin})</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

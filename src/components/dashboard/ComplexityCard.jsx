// src/components/dashboard/ComplexityCard.jsx
import React from 'react';
import { ShieldAlert, Cpu, AlertTriangle, CheckCircle2, Box, RefreshCcw, Bug, ArrowRight } from 'lucide-react';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';

export default function ComplexityCard({
  securityIssues = [],
  antiPatterns = [],
  circularDependencies = [],
  pythonAST = { classes: [], functions: [] },
  totalPythonFiles = 0
}) {
  const classes = pythonAST?.classes || [];
  const functions = pythonAST?.functions || [];

  // Sort functions by complexity descending
  const complexFunctions = [...functions]
    .sort((a, b) => (b.complexity || 0) - (a.complexity || 0))
    .slice(0, 10);

  const getSeverityBadge = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return <Badge color="red">High Risk</Badge>;
      case 'medium':
        return <Badge color="yellow">Medium Risk</Badge>;
      case 'low':
        return <Badge color="cyan">Low Risk</Badge>;
      default:
        return <Badge color="gray">{severity || 'Info'}</Badge>;
    }
  };

  const getComplexityBadge = (score) => {
    if (score >= 8) return <Badge color="red" className="font-mono">Score: {score} (High)</Badge>;
    if (score >= 4) return <Badge color="yellow" className="font-mono">Score: {score} (Moderate)</Badge>;
    return <Badge color="green" className="font-mono">Score: {score} (Simple)</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* ── Circular Dependency Warnings (if any) ── */}
      {circularDependencies.length > 0 && (
        <Card glow className="border-red-500/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCcw className="w-5 h-5 text-red-500 animate-spin" style={{ animationDuration: '6s' }} />
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white text-base">
                    Circular Dependency Cycles Detected
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Import loops that can cause module initialization deadlocks or runtime crashes
                  </p>
                </div>
              </div>
              <Badge color="red">{circularDependencies.length} Cycles Found</Badge>
            </div>
          </CardHeader>
          <CardBody className="!px-4 !py-4 space-y-2">
            {circularDependencies.map((cycle, i) => (
              <div
                key={i}
                className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-1.5 flex-wrap font-bold text-red-700 dark:text-red-300">
                  <span className="text-red-500 font-normal">Cycle #{i + 1}:</span>
                  {cycle.chain.map((mod, mi) => (
                    <React.Fragment key={mi}>
                      <span>{mod}</span>
                      {mi < cycle.chain.length - 1 && <ArrowRight className="w-3 h-3 text-red-400 inline shrink-0" />}
                    </React.Fragment>
                  ))}
                </div>
                <Badge color="red">{cycle.length} files in loop</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* ── Anti-Pattern & Code Smell Scanner ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-violet-500 dark:text-violet-400" />
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white text-base">
                  AST Anti-Patterns & Code Smells
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Mutable default arguments, wildcard imports, broad exceptions, and async blocking calls
                </p>
              </div>
            </div>
            <Badge color={antiPatterns.length > 0 ? "yellow" : "green"}>
              {antiPatterns.length} Smells Detected
            </Badge>
          </div>
        </CardHeader>
        <CardBody className="!px-4 !py-4">
          {antiPatterns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No AST Anti-Patterns Detected
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Clean function signatures, safe exception handling, and clean import namespaces.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {antiPatterns.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      {item.type}
                    </span>
                    {getSeverityBadge(item.severity)}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {item.message}
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
                    <span>{item.file}:{item.line}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {item.snippet}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Security & Risk Findings ── */}
      <Card glow>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500 dark:text-amber-400" />
              <h2 className="font-semibold text-slate-900 dark:text-white text-base">
                Static Security & Risk Scanner
              </h2>
            </div>
            <Badge color={securityIssues.length > 0 ? "yellow" : "green"}>
              {securityIssues.length} Findings
            </Badge>
          </div>
        </CardHeader>
        <CardBody className="!px-4 !py-4">
          {securityIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No Hardcoded Secrets or Insecure Functions Detected
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Checked for API keys, eval() usages, raw SQL strings, and dangerous CORS configurations.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {securityIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1.5 transition-colors hover:border-amber-500/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      {issue.rule}
                    </span>
                    {getSeverityBadge(issue.severity)}
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    <span>{issue.file}{issue.line ? `:${issue.line}` : ''}</span>
                  </div>
                  {issue.snippet && (
                    <pre className="mt-1 p-2 rounded bg-slate-100 dark:bg-slate-950 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto border border-slate-200 dark:border-slate-800">
                      {issue.snippet}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Cyclomatic Complexity & AST Analysis ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Function Complexity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-violet-500 dark:text-violet-400" />
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                  Cyclomatic Complexity (AST)
                </h3>
              </div>
              <Badge color="violet">{functions.length} functions</Badge>
            </div>
          </CardHeader>
          <CardBody className="!px-4 !py-4">
            {complexFunctions.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                No Python AST function nodes analyzed in this project.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {complexFunctions.map((fn, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs"
                  >
                    <div className="space-y-0.5 font-mono">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {fn.name}({fn.args ? fn.args.join(', ') : ''})
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                        {fn.file}:{fn.line}
                      </div>
                    </div>
                    {getComplexityBadge(fn.complexity)}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Python Class Hierarchies */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                  Class Hierarchies & OOP Structure
                </h3>
              </div>
              <Badge color="cyan">{classes.length} classes</Badge>
            </div>
          </CardHeader>
          <CardBody className="!px-4 !py-4">
            {classes.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                No object-oriented Python classes found in scanned source files.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {classes.map((cls, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-slate-900 dark:text-white">class {cls.name}</span>
                      {cls.bases && cls.bases.length > 0 && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          extends ({cls.bases.join(', ')})
                        </span>
                      )}
                    </div>
                    {cls.methods && cls.methods.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {cls.methods.map((m, mi) => (
                          <span key={mi} className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                            def {m}()
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

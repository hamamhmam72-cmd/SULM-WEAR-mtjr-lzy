import { useGetAdminSystemHealth, getGetAdminSystemHealthQueryKey } from "@workspace/api-client-react";
import { Activity, Server, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";

export function AdminSystemHealth() {
  const { data: health, isLoading, isError, refetch, isFetching } = useGetAdminSystemHealth({
    query: { queryKey: getGetAdminSystemHealthQueryKey(), refetchInterval: 30000 }
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !health) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle size={24} className="text-destructive" />
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[.18em]">System health unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">The diagnostic service could not be reached. No system status was changed.</p>
        </div>
        <button type="button" disabled={isFetching} onClick={() => void refetch()} className="border border-border px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-muted disabled:opacity-50">
          {isFetching ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center border-b border-border px-6">
        <h2 className="text-sm font-bold uppercase tracking-[.18em]">System Health</h2>
      </header>

      <div className="flex-1 overflow-auto bg-background p-6">
        <div className="mx-auto max-w-4xl space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-border bg-card p-6 rounded-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-sm ${health.status === 'healthy' ? 'bg-accent/20 text-accent' : 'bg-destructive/20 text-destructive'}`}>
                  <Activity size={20} />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-widest">Global Status</h3>
              </div>
              <p className="text-2xl font-bold capitalize">{health.status}</p>
            </div>
            <div className="border border-border bg-card p-6 rounded-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-sm bg-muted text-muted-foreground"><ShieldCheck size={20} /></div>
                <h3 className="text-xs font-bold uppercase tracking-widest">Checks Passed</h3>
              </div>
              <p className="text-2xl font-bold">{health.checks.filter(c => c.status === 'healthy').length} / {health.checks.length}</p>
            </div>
            <div className="border border-border bg-card p-6 rounded-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-sm bg-muted text-muted-foreground"><Server size={20} /></div>
                <h3 className="text-xs font-bold uppercase tracking-widest">Avg Response</h3>
              </div>
              <p className="text-2xl font-mono">{health.routeMetrics.reduce((sum, r) => sum + r.averageMs, 0) / (health.routeMetrics.length || 1) | 0}ms</p>
            </div>
          </div>

          <div className="border border-border rounded-sm bg-card overflow-hidden">
            <div className="border-b border-border px-6 py-4 bg-muted/30">
              <h3 className="text-xs font-bold uppercase tracking-widest">Integrity Checks</h3>
            </div>
            <div className="divide-y divide-border">
              {health.checks.map(check => (
                <div key={check.key} className="flex items-center justify-between p-4 px-6">
                  <div className="flex items-center gap-4">
                    {check.status === 'healthy' ? <ShieldCheck size={18} className="text-accent" /> : <AlertTriangle size={18} className="text-destructive" />}
                    <div>
                      <p className="text-sm font-semibold capitalize">{check.key.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground mt-1">{check.message}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{new Date(check.checkedAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border rounded-sm bg-card overflow-hidden">
            <div className="border-b border-border px-6 py-4 bg-muted/30">
              <h3 className="text-xs font-bold uppercase tracking-widest">Route Metrics</h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-muted border-b border-border uppercase text-[10px] tracking-widest text-muted-foreground">
                <tr>
                  <th className="p-4 px-6">Route</th>
                  <th className="p-4">Requests</th>
                  <th className="p-4">Errors</th>
                  <th className="p-4 text-right px-6">Avg Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {health.routeMetrics.map(metric => (
                  <tr key={metric.route} className="hover:bg-muted/50">
                    <td className="p-4 px-6 font-mono font-medium">{metric.route}</td>
                    <td className="p-4 font-mono">{metric.requests}</td>
                    <td className="p-4 font-mono">
                      <span className={metric.errors > 0 ? 'text-destructive' : 'text-muted-foreground'}>{metric.errors}</span>
                    </td>
                    <td className="p-4 text-right px-6 font-mono">{metric.averageMs.toFixed(1)}ms</td>
                  </tr>
                ))}
                {health.routeMetrics.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No metrics recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}

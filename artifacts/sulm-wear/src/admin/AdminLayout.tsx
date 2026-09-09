import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { useGetAdminSession } from "@workspace/api-client-react";
import { getGetAdminSessionQueryKey } from "@workspace/api-client-react";
import { Package, Grid, Activity, LogOut, Loader2 } from "lucide-react";
import { useEffect } from "react";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  
  const { data: session, isLoading, isError } = useGetAdminSession({
    query: { queryKey: getGetAdminSessionQueryKey() }
  });

  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => {
      if (localStorage.getItem('sulm-theme') !== 'dark') {
        document.documentElement.classList.remove('dark');
      }
    };
  }, []);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  if (isError || !session || session.role !== 'catalog_admin') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center px-4">
        <h1 className="display text-3xl font-bold">Access Restricted</h1>
        <p className="mt-2 text-muted-foreground">You do not have permission to view this area.</p>
        <button onClick={() => signOut({ redirectUrl: '/' })} className="mt-6 border-b border-foreground pb-1 text-[10px] font-bold uppercase tracking-[.17em] hover:text-accent">Sign Out</button>
      </div>
    );
  }

  const nav = [
    { name: "Orders", path: "/admin/orders", icon: Package },
    { name: "Catalog", path: "/admin/catalog", icon: Grid },
    { name: "System Health", path: "/admin/health", icon: Activity },
  ];

  return (
    <div className="flex min-h-[100dvh] w-full flex-col lg:flex-row bg-background text-foreground selection:bg-accent selection:text-background relative z-10">
      <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-card flex flex-col justify-between">
        <div>
          <div className="flex h-16 items-center px-6 border-b border-border">
            <Link href="/admin" className="display font-extrabold tracking-[.18em] text-sm">SULM / ADMIN</Link>
          </div>
          <nav className="flex flex-col gap-1 p-4">
            {nav.map(item => {
              const active = location.startsWith(item.path);
              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`flex items-center gap-3 px-3 py-2 text-xs font-semibold uppercase tracking-[.12em] transition-colors rounded-sm ${active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                >
                  <item.icon size={16} />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-border">
          <div className="mb-4 px-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Session</p>
            <p className="text-xs mt-1 truncate">{session.email}</p>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: '/' })}
            className="flex w-full items-center gap-3 px-3 py-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors rounded-sm"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden flex flex-col min-w-0 bg-background">
        {children}
      </main>
    </div>
  );
}

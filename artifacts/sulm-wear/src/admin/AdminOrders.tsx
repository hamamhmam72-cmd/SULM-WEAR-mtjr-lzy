import { useEffect, useState } from "react";
import { 
  useGetAdminOrders, getGetAdminOrdersQueryKey, 
  useBatchUpdateOrderStatus, BatchOrderStatusInputStatus, BatchOrderStatusResult,
  GetAdminOrdersPaymentMethod 
} from "@workspace/api-client-react";
import { Search, Printer, Loader2, LayoutGrid, List, CheckSquare, XCircle, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";

export function AdminOrders() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [status, setStatus] = useState<string>('');
  const [courier, setCourier] = useState<string>('');
  const [zone, setZone] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<GetAdminOrdersPaymentMethod | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  
  const queryParams = { 
    status: status || undefined, 
    search: search || undefined,
    courier: courier || undefined,
    zone: zone || undefined,
    paymentMethod: (paymentMethod || undefined) as GetAdminOrdersPaymentMethod | undefined
    ,page,
    limit: 50
  };

  const { data: orderPage, isLoading, isError } = useGetAdminOrders(
    queryParams,
    { query: { queryKey: getGetAdminOrdersQueryKey(queryParams), refetchInterval: 15_000, refetchOnWindowFocus: true } }
  );
  const orders = orderPage?.orders;
  useEffect(() => {
    setSelected(new Set());
    setPage(1);
  }, [status, courier, zone, paymentMethod, search]);

  const batchUpdate = useBatchUpdateOrderStatus();
  const [pickListResult, setPickListResult] = useState<BatchOrderStatusResult | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  const [batchCourier, setBatchCourier] = useState('');
  const [batchZone, setBatchZone] = useState('');
  
  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  
  const toggleAll = () => {
    if (!orders) return;
    if (selected.size === orders.length) setSelected(new Set());
    else setSelected(new Set(orders.map(o => o.id)));
  };

  const handleBatchStatus = (newStatus: BatchOrderStatusInputStatus) => {
    const visibleOrderIds = Array.from(selected).filter((id) => orders?.some((order) => order.id === id));
    if (visibleOrderIds.length === 0) return;
    setBatchError(null);
    batchUpdate.mutate(
      { data: { 
          orderIds: visibleOrderIds,
          status: newStatus, 
          courier: batchCourier || null, 
          zone: batchZone || null 
        } 
      },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getGetAdminOrdersQueryKey() });
          setSelected(new Set());
          setBatchCourier('');
          setBatchZone('');
          if (res.updatedOrders && res.updatedOrders.length > 0) {
            setPickListResult(res);
          }
        },
        onError: (err: any) => {
          setBatchError(err?.error || "Failed to update orders.");
        }
      }
    );
  };

  const money = (val: number) => `${val.toFixed(2)} JOD`;

  return (
    <div className="admin-orders-root flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
        <h2 className="text-sm font-bold uppercase tracking-[.18em]">Orders</h2>
        <div className="flex items-center gap-2">
           <span className="hidden text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
             {orderPage ? `${orderPage.total} orders · ${orderPage.page}/${orderPage.totalPages}` : "Loading"}
           </span>
           <button aria-label="Previous order page" disabled={!orderPage || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="border border-border px-2 py-1 text-xs disabled:opacity-30">←</button>
           <button aria-label="Next order page" disabled={!orderPage || page >= orderPage.totalPages} onClick={() => setPage((value) => value + 1)} className="border border-border px-2 py-1 text-xs disabled:opacity-30">→</button>
           <div className="flex bg-muted p-1 rounded-sm">
             <button aria-label="Table View" onClick={() => setView('table')} className={`p-1.5 rounded-sm ${view === 'table' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><List size={16} /></button>
             <button aria-label="Kanban View" onClick={() => setView('kanban')} className={`p-1.5 rounded-sm ${view === 'kanban' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><LayoutGrid size={16} /></button>
           </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 border-b border-border p-6 bg-card/50">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              aria-label="Search orders"
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search orders, customers..." 
              className="h-9 w-full border border-border bg-background pl-9 pr-3 text-xs outline-none focus:border-accent rounded-sm"
            />
          </div>
          <select 
            aria-label="Filter by status"
            value={status} onChange={e => setStatus(e.target.value)}
            className="h-9 border border-border bg-background px-3 text-xs outline-none focus:border-accent rounded-sm"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="packed">Packed</option>
            <option value="ready_to_ship">Ready to Ship</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="returned">Returned</option>
            <option value="canceled">Canceled</option>
          </select>
          <input 
            aria-label="Filter by courier"
            value={courier} onChange={e => setCourier(e.target.value)}
            placeholder="Courier" 
            className="h-9 w-28 border border-border bg-background px-3 text-xs outline-none focus:border-accent rounded-sm"
          />
          <input 
            aria-label="Filter by zone"
            value={zone} onChange={e => setZone(e.target.value)}
            placeholder="Zone" 
            className="h-9 w-28 border border-border bg-background px-3 text-xs outline-none focus:border-accent rounded-sm"
          />
          <select 
            aria-label="Filter by payment method"
            value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as GetAdminOrdersPaymentMethod)}
            className="h-9 border border-border bg-background px-3 text-xs outline-none focus:border-accent rounded-sm"
          >
            <option value="">All Payments</option>
            <option value="cod">COD</option>
            <option value="prepaid">Prepaid</option>
          </select>
        </div>
        
        {batchError && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm">
            <AlertCircle size={16} /> {batchError}
            <button aria-label="Dismiss error" onClick={() => setBatchError(null)} className="ml-auto"><XCircle size={16} /></button>
          </div>
        )}

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-4 bg-muted/50 p-2 border border-border rounded-sm">
            <span className="text-xs font-semibold px-2">{selected.size} selected</span>
            <div className="h-4 w-px bg-border hidden sm:block"></div>
            
            <input 
              aria-label="Set batch courier"
              value={batchCourier} onChange={e => setBatchCourier(e.target.value)}
              placeholder="Set Courier..." 
              className="h-8 w-32 border border-border bg-background px-2 text-xs outline-none focus:border-accent rounded-sm"
            />
            <input 
              aria-label="Set batch zone"
              value={batchZone} onChange={e => setBatchZone(e.target.value)}
              placeholder="Set Zone..." 
              className="h-8 w-32 border border-border bg-background px-2 text-xs outline-none focus:border-accent rounded-sm"
            />

            <select 
              aria-label="Change status for selected orders"
              className="h-8 border border-border bg-background px-2 text-xs outline-none rounded-sm"
              onChange={(e) => {
                if (e.target.value) {
                  handleBatchStatus(e.target.value as BatchOrderStatusInputStatus);
                  e.target.value = "";
                }
              }}
              defaultValue=""
              disabled={batchUpdate.isPending}
            >
              <option value="" disabled>Change Status...</option>
              <option value="confirmed">Mark Confirmed</option>
              <option value="processing">Mark Processing</option>
              <option value="packed">Mark Packed</option>
              <option value="ready_to_ship">Mark Ready to Ship</option>
              <option value="shipped">Mark Shipped</option>
              <option value="delivered">Mark Delivered</option>
              <option value="returned">Mark Returned</option>
              <option value="canceled">Mark Canceled</option>
            </select>
            {batchUpdate.isPending && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-background p-6">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : isError ? (
          <div className="flex justify-center py-12 text-sm text-destructive"><AlertCircle className="mr-2" size={16} /> Error loading orders.</div>
        ) : view === 'table' ? (
          <div className="border border-border rounded-sm bg-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 w-10"><input aria-label="Select all orders" type="checkbox" onChange={toggleAll} checked={orders?.length ? selected.size === orders.length : false} /></th>
                  <th className="p-3">Order</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Logistics</th>
                  <th className="p-3">Items</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders?.map(order => (
                  <tr key={order.id} className={`hover:bg-muted/50 ${selected.has(order.id) ? 'bg-muted/30' : ''}`}>
                    <td className="p-3"><input aria-label={`Select order ${order.orderNumber}`} type="checkbox" checked={selected.has(order.id)} onChange={() => toggleSelect(order.id)} /></td>
                    <td className="p-3 font-mono font-medium">{order.orderNumber}</td>
                    <td className="p-3">
                      <div className="font-semibold">{order.customerName}</div>
                      <div className="text-muted-foreground">{order.city}</div>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center rounded-sm bg-foreground/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground">
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-[10px] text-muted-foreground uppercase tracking-widest">
                      {order.courier || '—'} / {order.zone || '—'}
                    </td>
                    <td className="p-3 text-muted-foreground">{order.items.reduce((sum, i) => sum + i.quantity, 0)} items</td>
                    <td className="p-3 text-right font-mono font-medium">{money(order.total)}</td>
                  </tr>
                ))}
                {!orders?.length && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No orders found matching filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-full gap-4 overflow-x-auto pb-4 items-start">
            {['new', 'confirmed', 'processing', 'packed', 'ready_to_ship', 'shipped', 'delivered', 'canceled', 'returned'].map(colStatus => {
              const colOrders = orders?.filter(o => o.status === colStatus) || [];
              return (
                <div key={colStatus} className="flex max-h-full w-72 flex-col gap-3 rounded-sm border border-border bg-card p-3 shrink-0">
                  <div className="flex items-center justify-between shrink-0">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{colStatus.replace('_', ' ')}</h3>
                    <span className="bg-muted px-1.5 py-0.5 text-[10px] font-mono rounded-sm">{colOrders.length}</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
                    {colOrders.map(order => (
                      <div key={order.id} className="cursor-pointer border border-border bg-background p-3 rounded-sm hover:border-foreground transition-colors" onClick={() => toggleSelect(order.id)}>
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-mono text-xs font-bold">{order.orderNumber}</span>
                          {selected.has(order.id) && <CheckSquare size={14} className="text-accent" />}
                        </div>
                        <div className="text-xs font-semibold">{order.customerName}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">{order.city}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{order.items.length} items</span>
                          <span className="font-mono text-xs">{money(order.total)}</span>
                        </div>
                      </div>
                    ))}
                    {colOrders.length === 0 && (
                      <div className="text-center p-4 text-xs text-muted-foreground border border-dashed border-border rounded-sm">Empty</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pickListResult && (
        <>
          <Dialog.Root open={true} onOpenChange={(o) => !o && setPickListResult(null)}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] no-print" />
              <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 border border-border bg-background p-6 shadow-xl z-[100] no-print flex flex-col max-h-[90vh]">
                <Dialog.Title className="text-lg font-bold uppercase tracking-widest mb-4">Fulfillment Packet Ready</Dialog.Title>
                <div className="flex-1 overflow-auto border border-border rounded-sm mb-6">
                  <div className="bg-muted px-4 py-2 border-b border-border">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pick List Overview</p>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border uppercase text-[10px] tracking-widest text-muted-foreground">
                      <tr>
                        <th className="p-3">Product</th>
                        <th className="p-3">Size</th>
                        <th className="p-3 text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pickListResult.pickList.map((item, i) => (
                        <tr key={i}>
                          <td className="p-3 font-semibold">{item.productName}</td>
                          <td className="p-3">{item.size}</td>
                          <td className="p-3 text-right font-mono">{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center gap-3 shrink-0">
                  <p className="text-xs text-muted-foreground">Includes {pickListResult.updatedOrders.length} packing slips and labels.</p>
                  <div className="flex gap-3">
                    <button className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground" onClick={() => setPickListResult(null)}>Close</button>
                    <button className="bg-foreground text-background px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-accent flex items-center gap-2 rounded-sm" onClick={() => window.print()}><Printer size={14} /> Print Packet</button>
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          {/* Hidden print payload, visible only during print */}
          <div className="hidden print-only text-black bg-white" style={{ display: 'none' }}>
            {/* Consolidated Pick List */}
            <div className="print-break-after p-8">
              <h1 className="text-2xl font-bold uppercase tracking-widest mb-2 border-b-2 border-black pb-4">Consolidated Pick List</h1>
              <table className="w-full text-left text-sm mt-6">
                <thead>
                  <tr className="border-b border-black">
                    <th className="py-2">SKU / Product</th>
                    <th className="py-2">Size</th>
                    <th className="py-2 text-right">Quantity</th>
                    <th className="py-2 text-right">Picked</th>
                  </tr>
                </thead>
                <tbody>
                  {pickListResult.pickList.map((item, i) => (
                    <tr key={i} className="border-b border-gray-300">
                      <td className="py-3 font-semibold">{item.productName}</td>
                      <td className="py-3">{item.size}</td>
                      <td className="py-3 text-right font-mono font-bold text-lg">{item.quantity}</td>
                      <td className="py-3 text-right"><div className="inline-block w-6 h-6 border-2 border-gray-400"></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Packing Slips & Labels */}
            {pickListResult.updatedOrders.map(order => (
              <div key={order.id} className="print-break-after">
                {/* Packing Slip */}
                <div className="p-8 h-[50vh] flex flex-col border-b-2 border-dashed border-gray-400">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="text-xl font-bold tracking-widest">SULM WEAR</h2>
                      <p className="text-xs uppercase tracking-widest text-gray-500 mt-1">Packing Slip</p>
                    </div>
                    <div className="text-right">
                      <h3 className="font-mono text-xl font-bold">{order.orderNumber}</h3>
                      <p className="text-xs uppercase tracking-widest mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="mb-8 grid grid-cols-2 gap-8 text-sm">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Ship To</p>
                      <p className="font-semibold">{order.customerName}</p>
                      <p>{order.address}</p>
                      <p>{order.city}</p>
                      <p>{order.phone}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Details</p>
                      <p>Payment: <strong className="uppercase">{order.paymentMethod}</strong></p>
                      <p>Courier: <strong>{order.courier || '—'}</strong></p>
                      <p>Zone: <strong>{order.zone || '—'}</strong></p>
                    </div>
                  </div>
                  <table className="w-full text-left text-sm mb-auto">
                    <thead>
                      <tr className="border-b border-black">
                        <th className="py-2">Item</th>
                        <th className="py-2">Size</th>
                        <th className="py-2 text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item, i) => (
                        <tr key={i} className="border-b border-gray-200">
                          <td className="py-2">{item.productName}</td>
                          <td className="py-2">{item.size}</td>
                          <td className="py-2 text-right font-mono">{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="pt-4 text-center text-xs text-gray-500 uppercase tracking-widest">
                    Thank you for choosing SULM WEAR.
                  </div>
                </div>

                {/* Shipping Label Placeholder */}
                <div className="p-8 h-[50vh] flex flex-col justify-center items-center">
                  <div className="border-4 border-black w-full max-w-lg h-64 p-6 flex flex-col">
                    <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest">Courier: {order.courier || '—'}</p>
                        <p className="text-xs font-bold uppercase tracking-widest">Zone: {order.zone || '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black uppercase">{order.paymentMethod === 'cod' ? 'COD' : 'PREPAID'}</p>
                        {order.paymentMethod === 'cod' && <p className="font-mono font-bold">{order.total.toFixed(2)} JOD</p>}
                      </div>
                    </div>
                    <div className="text-xl font-bold">{order.customerName}</div>
                    <div className="text-lg">{order.phone}</div>
                    <div className="text-lg mt-2">{order.city}</div>
                    <div className="text-base mt-1 line-clamp-2">{order.address}</div>
                    <div className="mt-auto text-right font-mono text-sm">{order.orderNumber}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

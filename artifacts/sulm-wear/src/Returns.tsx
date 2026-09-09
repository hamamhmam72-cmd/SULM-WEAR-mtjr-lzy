import { useState, FormEvent } from 'react';
import { useCreateReturnRequest, useLookupReturnRequests } from '@workspace/api-client-react';
import { ArrowRight, Search, PackageCheck } from 'lucide-react';

export function Returns() {
  const lookup = useLookupReturnRequests();
  const request = useCreateReturnRequest();

  const [mode, setMode] = useState<'request' | 'lookup'>('request');

  const [lookupForm, setLookupForm] = useState({ orderNumber: '', phone: '' });
  const [requestForm, setRequestForm] = useState({ orderNumber: '', phone: '', type: 'return' as 'return' | 'exchange', productSlug: '', reason: '', requestedSize: '' });

  const handleLookup = (e: FormEvent) => {
    e.preventDefault();
    lookup.mutate({ data: lookupForm });
  };

  const handleRequest = (e: FormEvent) => {
    e.preventDefault();
    request.mutate({ data: { ...requestForm, requestedSize: requestForm.type === 'exchange' ? requestForm.requestedSize : null } });
  };

  return (
    <main className="mx-auto max-w-[1080px] px-5 py-16 sm:px-8 lg:py-24">
      <div className="grid gap-14 lg:grid-cols-[.85fr_1.15fr]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-accent">Returns & Exchanges / 05</p>
          <h1 className="display mt-5 text-6xl font-bold leading-[.86] tracking-[-.075em] sm:text-8xl">Make it<br />right.</h1>
          <p className="mt-8 max-w-sm text-sm leading-7 text-muted-foreground">Easy exchanges within 7 days. Ensure pieces are unworn and in original condition.</p>
          
          <div className="mt-12 flex items-center gap-4">
            <button onClick={() => { setMode('request'); request.reset(); }} className={`border-b pb-1 text-[10px] font-bold uppercase tracking-[.17em] ${mode === 'request' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`} data-testid="button-mode-request">New Request</button>
            <button onClick={() => { setMode('lookup'); lookup.reset(); }} className={`border-b pb-1 text-[10px] font-bold uppercase tracking-[.17em] ${mode === 'lookup' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`} data-testid="button-mode-lookup">Check Status</button>
          </div>
        </div>
        <div>
          {mode === 'request' ? (
            request.isSuccess ? (
              <div className="border border-border bg-card p-6 sm:p-9 text-center slide-in" data-testid="status-return-success">
                <PackageCheck size={32} className="mx-auto text-accent mb-5" />
                <p className="text-[10px] font-bold uppercase tracking-[.2em] text-accent">{request.data.requestNumber}</p>
                <h2 className="display mt-4 text-3xl font-semibold">Request received.</h2>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">We will review your {request.data.type} request for {request.data.productSlug} and contact you soon.</p>
                <button onClick={() => request.reset()} className="mt-8 border-b border-foreground pb-1 text-[10px] font-bold uppercase tracking-[.17em]">Submit another</button>
              </div>
            ) : (
              <form onSubmit={handleRequest} className="border border-border bg-card p-6 sm:p-9 slide-in">
                <div className="grid gap-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <label className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                      Order number
                      <input required minLength={6} value={requestForm.orderNumber} onChange={(e) => setRequestForm({ ...requestForm, orderNumber: e.target.value })} placeholder="SULM-0000" className="mt-2 h-12 w-full border-b border-border bg-transparent text-sm uppercase outline-none focus:border-accent" data-testid="input-return-order" />
                    </label>
                    <label className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                      Phone number
                      <input required minLength={8} value={requestForm.phone} onChange={(e) => setRequestForm({ ...requestForm, phone: e.target.value })} placeholder="+962 7..." className="mt-2 h-12 w-full border-b border-border bg-transparent text-sm outline-none focus:border-accent" data-testid="input-return-phone" />
                    </label>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-5">
                    <label className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                      Request Type
                      <select value={requestForm.type} onChange={(e) => setRequestForm({ ...requestForm, type: e.target.value as 'return' | 'exchange' })} className="mt-2 h-12 w-full border-b border-border bg-transparent text-sm outline-none focus:border-accent appearance-none" data-testid="select-return-type">
                        <option value="return">Return</option>
                        <option value="exchange">Exchange</option>
                      </select>
                    </label>
                    <label className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                      Product ID (Slug)
                      <input required value={requestForm.productSlug} onChange={(e) => setRequestForm({ ...requestForm, productSlug: e.target.value })} placeholder="e.g. object-001" className="mt-2 h-12 w-full border-b border-border bg-transparent text-sm outline-none focus:border-accent" data-testid="input-return-product" />
                    </label>
                  </div>

                  {requestForm.type === 'exchange' && (
                    <label className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground slide-in">
                      Requested Size
                      <input required value={requestForm.requestedSize} onChange={(e) => setRequestForm({ ...requestForm, requestedSize: e.target.value })} placeholder="e.g. L" className="mt-2 h-12 w-full border-b border-border bg-transparent text-sm outline-none focus:border-accent" data-testid="input-return-size" />
                    </label>
                  )}

                  <label className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                    Reason
                    <textarea required minLength={5} value={requestForm.reason} onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })} rows={3} className="mt-2 w-full resize-none border-b border-border bg-transparent py-3 text-sm outline-none focus:border-accent" data-testid="input-return-reason" />
                  </label>

                  <button className="mt-4 flex h-13 w-full items-center justify-center gap-3 bg-foreground text-[11px] font-bold uppercase tracking-[.18em] text-background hover:bg-accent disabled:opacity-50" disabled={request.isPending} data-testid="button-submit-return">
                    {request.isPending ? 'Submitting...' : 'Submit Request'} <ArrowRight size={15} />
                  </button>
                  {request.isError && <p className="mt-4 text-sm text-destructive" data-testid="status-return-error">Could not submit request. Verify order details.</p>}
                </div>
              </form>
            )
          ) : (
            <div className="slide-in">
              <form onSubmit={handleLookup} className="border border-border bg-card p-6 sm:p-9">
                <div className="grid sm:grid-cols-2 gap-5">
                  <label className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                    Order number
                    <input required minLength={6} value={lookupForm.orderNumber} onChange={(e) => setLookupForm({ ...lookupForm, orderNumber: e.target.value })} placeholder="SULM-0000" className="mt-2 h-12 w-full border-b border-border bg-transparent text-sm uppercase outline-none focus:border-accent" data-testid="input-lookup-return-order" />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                    Phone number
                    <input required minLength={8} value={lookupForm.phone} onChange={(e) => setLookupForm({ ...lookupForm, phone: e.target.value })} placeholder="+962 7..." className="mt-2 h-12 w-full border-b border-border bg-transparent text-sm outline-none focus:border-accent" data-testid="input-lookup-return-phone" />
                  </label>
                </div>
                <button className="mt-8 flex h-13 w-full items-center justify-center gap-3 bg-foreground text-[11px] font-bold uppercase tracking-[.18em] text-background hover:bg-accent disabled:opacity-50" disabled={lookup.isPending} data-testid="button-lookup-return">
                  {lookup.isPending ? 'Looking up...' : 'Find Requests'} <Search size={15} />
                </button>
                {lookup.isError && <p className="mt-4 text-sm text-destructive" data-testid="status-lookup-return-error">Could not find any requests.</p>}
              </form>

              {lookup.isSuccess && (
                <div className="mt-8 grid gap-4 slide-in" data-testid="status-lookup-return-result">
                  {lookup.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No return or exchange requests found.</p>
                  ) : (
                    lookup.data.map(req => (
                      <div key={req.id} className="border border-border bg-card p-5">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-[.15em] bg-muted px-2 py-1">{req.status}</span>
                            <p className="mt-3 text-sm font-semibold">{req.type === 'return' ? 'Return' : 'Exchange'} / {req.productSlug}</p>
                          </div>
                          <p className="text-[10px] font-mono text-muted-foreground">{req.requestNumber}</p>
                        </div>
                        {req.requestedSize && <p className="text-xs text-muted-foreground">Requested Size: {req.requestedSize}</p>}
                        <p className="mt-2 text-xs text-muted-foreground truncate">Reason: {req.reason}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

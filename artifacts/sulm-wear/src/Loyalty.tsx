import { useState, FormEvent } from 'react';
import { useLookupLoyalty, useRedeemLoyaltyPoints, useCreateLoyaltyReview } from '@workspace/api-client-react';
import { ArrowRight, Star, Wallet, Check, Award } from 'lucide-react';

export function Loyalty() {
  const lookup = useLookupLoyalty();
  const redeem = useRedeemLoyaltyPoints();
  const review = useCreateLoyaltyReview();

  const [phone, setPhone] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [pointsToRedeem, setPointsToRedeem] = useState('');
  const [reviewForm, setReviewForm] = useState({ phone: '', orderNumber: '', productSlug: '', rating: 5, review: '' });

  const profile = lookup.data;

  const handleLookup = (e: FormEvent) => {
    e.preventDefault();
    lookup.mutate({ data: { phone, orderNumber } });
  };

  const handleRedeem = (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const pts = parseInt(pointsToRedeem, 10);
    if (pts >= 100 && pts <= 1000) {
      redeem.mutate({ data: { verificationToken: profile.verificationToken, points: pts } }, {
        onSuccess: () => {
          setPointsToRedeem('');
          lookup.mutate({ data: { phone, orderNumber } });
        }
      });
    }
  };

  const handleReview = (e: FormEvent) => {
    e.preventDefault();
    review.mutate({ data: { phone: reviewForm.phone || phone, orderNumber: reviewForm.orderNumber, productSlug: reviewForm.productSlug, rating: reviewForm.rating, review: reviewForm.review } });
  };

  return (
    <main className="mx-auto max-w-[1080px] px-5 py-16 sm:px-8 lg:py-24">
      <div className="grid gap-14 lg:grid-cols-[.85fr_1.15fr]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-accent">The Atelier / 00</p>
          <h1 className="display mt-5 text-6xl font-bold leading-[.86] tracking-[-.075em] sm:text-8xl">Your<br />Status.</h1>
          <p className="mt-8 max-w-sm text-sm leading-7 text-muted-foreground">Access your private loyalty details, convert points to wallet credit, and earn more by reviewing your verified purchases.</p>
        </div>
        <div>
          {!profile ? (
            <form onSubmit={handleLookup} className="border border-border bg-card p-6 sm:p-9">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                  Order number
                  <input required minLength={6} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="SULM-0000" className="mt-2 h-12 w-full border-b border-border bg-transparent text-sm uppercase outline-none focus:border-accent" data-testid="input-loyalty-order" />
                </label>
                <label className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                  Phone number
                  <input required minLength={8} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+962 7..." className="mt-2 h-12 w-full border-b border-border bg-transparent text-sm outline-none focus:border-accent" data-testid="input-loyalty-phone" />
                </label>
              </div>
              <button className="mt-9 flex h-13 w-full items-center justify-center gap-3 bg-foreground text-[11px] font-bold uppercase tracking-[.18em] text-background hover:bg-accent disabled:opacity-50" disabled={lookup.isPending} data-testid="button-lookup-loyalty">
                {lookup.isPending ? 'Accessing...' : 'View Status'} <ArrowRight size={15} />
              </button>
              {lookup.isError && <p className="mt-4 text-sm text-destructive" data-testid="status-loyalty-error">Could not find a profile for this number.</p>}
            </form>
          ) : (
            <div className="space-y-8 slide-in" data-testid="status-loyalty-result">
              <div className="border border-border bg-card p-6 sm:p-9">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.2em] text-accent">{profile.tier} Tier</p>
                    <h2 className="mt-2 font-mono text-xl">{profile.maskedPhone}</h2>
                  </div>
                  <Award size={23} strokeWidth={1.2} className="text-accent" />
                </div>
                <div className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4 text-sm">
                  <p><span className="block text-[10px] uppercase tracking-[.14em] text-muted-foreground">Points</span><span className="font-mono text-lg">{profile.points}</span></p>
                  <p><span className="block text-[10px] uppercase tracking-[.14em] text-muted-foreground">Wallet</span><span className="font-mono text-lg text-accent">{profile.walletCredit.toFixed(2)} JOD</span></p>
                  <p><span className="block text-[10px] uppercase tracking-[.14em] text-muted-foreground">Pending</span><span className="font-mono text-lg">{profile.pendingPoints}</span></p>
                </div>
                {profile.nextTierAt && (
                  <p className="mt-5 text-xs text-muted-foreground">You are {profile.nextTierAt - profile.points} points away from the next tier.</p>
                )}
              </div>

              <div className="border border-border bg-card p-6 sm:p-9">
                <p className="text-[10px] font-bold uppercase tracking-[.2em] text-accent mb-5">Redeem Points</p>
                <form onSubmit={handleRedeem}>
                  <label className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                    Points to convert (Min 100)
                    <input required type="number" min={100} max={Math.min(1000, profile.points)} value={pointsToRedeem} onChange={(e) => setPointsToRedeem(e.target.value)} className="mt-2 h-12 w-full border-b border-border bg-transparent text-sm outline-none focus:border-accent" data-testid="input-redeem-points" />
                  </label>
                  <button className="mt-6 flex h-13 w-full items-center justify-center gap-3 bg-foreground text-[11px] font-bold uppercase tracking-[.18em] text-background hover:bg-accent disabled:opacity-50" disabled={redeem.isPending || profile.points < 100} data-testid="button-redeem-points">
                    {redeem.isPending ? 'Converting...' : 'Convert to Wallet Credit'} <Wallet size={15} />
                  </button>
                  {redeem.isSuccess && <p className="mt-4 text-sm text-green-600" data-testid="status-redeem-success">Successfully added {redeem.data.creditAdded} JOD to your wallet.</p>}
                  {redeem.isError && <p className="mt-4 text-sm text-destructive" data-testid="status-redeem-error">Could not redeem points.</p>}
                </form>
              </div>

              <div className="border border-border bg-card p-6 sm:p-9">
                <p className="text-[10px] font-bold uppercase tracking-[.2em] text-accent mb-5">Leave a Review</p>
                <p className="text-sm text-muted-foreground mb-6">Earn points by reviewing verified past purchases.</p>
                {review.isSuccess ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center" data-testid="status-review-success">
                    <Check size={28} className="text-accent mb-4" />
                    <p className="text-sm font-semibold">Review submitted!</p>
                    <p className="text-xs text-muted-foreground mt-2">You earned {review.data.pointsEarned} points.</p>
                    <button type="button" onClick={() => review.reset()} className="mt-5 border-b border-foreground pb-1 text-[10px] font-bold uppercase tracking-[.17em]">Write another</button>
                  </div>
                ) : (
                  <form onSubmit={handleReview} className="grid gap-5">
                    <label className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                      Order number
                      <input required value={reviewForm.orderNumber} onChange={(e) => setReviewForm({ ...reviewForm, orderNumber: e.target.value })} placeholder="SULM-0000" className="mt-2 h-12 w-full border-b border-border bg-transparent text-sm uppercase outline-none focus:border-accent" data-testid="input-review-order" />
                    </label>
                    <label className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                      Product ID (Slug)
                      <input required value={reviewForm.productSlug} onChange={(e) => setReviewForm({ ...reviewForm, productSlug: e.target.value })} placeholder="e.g. object-001" className="mt-2 h-12 w-full border-b border-border bg-transparent text-sm outline-none focus:border-accent" data-testid="input-review-product" />
                    </label>
                    <label className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                      Rating (1-5)
                      <input required type="number" min={1} max={5} value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: parseInt(e.target.value, 10) })} className="mt-2 h-12 w-full border-b border-border bg-transparent text-sm outline-none focus:border-accent" data-testid="input-review-rating" />
                    </label>
                    <label className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">
                      Your thoughts
                      <textarea required minLength={15} value={reviewForm.review} onChange={(e) => setReviewForm({ ...reviewForm, review: e.target.value })} rows={3} className="mt-2 w-full resize-none border-b border-border bg-transparent py-3 text-sm outline-none focus:border-accent" data-testid="input-review-text" />
                    </label>
                    <button className="mt-4 flex h-13 w-full items-center justify-center gap-3 bg-foreground text-[11px] font-bold uppercase tracking-[.18em] text-background hover:bg-accent disabled:opacity-50" disabled={review.isPending} data-testid="button-submit-review">
                      {review.isPending ? 'Submitting...' : 'Submit Review'} <Star size={15} />
                    </button>
                    {review.isError && <p className="mt-4 text-sm text-destructive" data-testid="status-review-error">Could not verify purchase or submit review.</p>}
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

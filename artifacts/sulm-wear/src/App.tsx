import { createContext, type CSSProperties, type FormEvent, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Instagram,
  Menu,
  Minus,
  Moon,
  PackageCheck,
  Phone,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  Sun,
  Truck,
  X,
} from 'lucide-react';
import {
  getGetProductQueryKey,
  getGetProductsQueryKey,
  getGetStorefrontSummaryQueryKey,
  getLookupOrderQueryKey,
  useCreateOrder,
  useGetProduct,
  useGetProducts,
  useGetStorefrontSummary,
  useLookupOrder,
  useLookupLoyalty,
  useQuoteBundle,
  useSubscribeCartReminder,
  useGetCartReminder,
  useMarkCartReminderDelivered,
  useUnsubscribeCartReminder,
  type Order,
  type Product,
} from '@workspace/api-client-react';
import { getGetCartReminderQueryKey } from "@workspace/api-client-react";
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Link, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { AdminLayout } from './admin/AdminLayout';
import { AdminOrders } from './admin/AdminOrders';
import { AdminCatalog } from './admin/AdminCatalog';
import { AdminSystemHealth } from './admin/AdminSystemHealth';
import { Loyalty } from './Loyalty';
import { Returns } from './Returns';
import '@/index.css';

const queryClient = new QueryClient();
const PHONE = '+962 7 8667 7153';
const INSTAGRAM = 'https://www.instagram.com/sulm_wear?stkn=MTRlend5dHM3emxkeQ==';
type Locale = 'en' | 'ar';

const translations = {
  en: {
    shop: 'Shop',
    standard: 'The SULM standard',
    track: 'Track',
    returns: 'Returns',
    atelier: 'Atelier',
    bag: 'Bag',
    featured: 'Featured',
    addToBag: 'Add to bag',
    edition: 'Edition 01 / Amman',
    heroTitle: 'Less noise.',
    heroTitleAccent: 'More form.',
    heroBody: 'A considered wardrobe for the space between plans. Quietly sharp, built for the way Jordan moves now.',
    heroAction: 'Explore the collection',
    moveWithIntent: 'Move with intent',
    dailyUniform: 'The daily uniform',
    allPieces: 'All pieces',
    search: 'Search the edit',
    noProducts: 'Nothing here yet.',
    resetFilters: 'Reset filters',
    navigate: 'Navigate',
    shopAll: 'Shop all',
    ourStandard: 'Our standard',
    trackOrder: 'Track your order',
    connect: 'Connect',
    whatsapp: 'WhatsApp us',
    noteFromAmman: 'A note from Amman',
    footerLine: 'Good clothes should disappear into your day.',
    switchToArabic: 'العربية',
    switchToEnglish: 'English',
    lightMode: 'Switch to light mode',
    darkMode: 'Switch to dark mode',
    openMenu: 'Open menu',
    closeBag: 'Close bag',
    productOffRail: 'This piece is off the rail.',
    productMoved: 'The product may have moved on, or the link is not quite right.',
    backToEdit: 'Back to the edit',
    color: 'Color',
    selectSize: 'Select size',
    remaining: 'remaining',
    chooseSize: 'Choose a size to continue',
    addSelected: 'Add selected piece',
    delivery: 'Delivery across Jordan in 2–4 days',
    exchanges: 'Easy exchanges within 7 days',
    smartFit: 'Smart fit / quick guide',
    findStartingPoint: 'Find your starting point',
    height: 'Height (cm)',
    weight: 'Weight (kg)',
    calculateFit: 'Calculate fit',
    startingPoint: 'Your starting point',
    looserSilhouette: 'Prefer a looser silhouette? Go one size up.',
    productStory: 'The product story',
    yourBag: 'Your bag',
    pieces: 'pieces',
    piece: 'piece',
    consideredStart: 'A considered start',
    bagQuiet: 'Your bag is quiet.',
    bagQuietBody: 'Start with one piece you will reach for tomorrow.',
    exploreEdit: 'Explore the edit',
    saveBag: 'Save your bag for later',
    whatsappNumber: 'WhatsApp number',
    save: 'Save',
    reminderConsent: 'I agree to receive a reminder message.',
    reminderSaved: "We'll remind you about this bag.",
    cancel: 'Cancel',
    bundleSavings: 'Bundle savings',
    estimatedTotal: 'Estimated total',
    checkout: 'Proceed to checkout',
    finishThought: 'Finish the thought / 03',
    yourDetails: 'Your details.',
    deliverCare: 'We deliver with care across Jordan. Cash on delivery is available.',
    nothingCheckout: 'Nothing to check out.',
    bagWaiting: 'Your bag is waiting for the first piece.',
    returnEdit: 'Return to the edit',
    whereNow: 'Where is it now?',
    trackIntro: 'Enter the order number from your confirmation and the phone number used at checkout.',
    needHelp: 'Need help?',
    orderNumber: 'Order number',
    phoneNumber: 'Phone number',
    findOrder: 'Find my order',
    lookingUp: 'Looking it up…',
    orderNotFound: 'We could not find that order.',
    checkDetails: 'Check the number and phone, then try again.',
    orderFound: 'Order found',
    deliveringTo: 'Delivering to',
    total: 'Total',
    orderConfirmed: 'Order confirmed',
    goodChoice: 'Good choice.',
    continueShopping: 'Continue shopping',
    notThisOne: 'Not this one.',
    pageMoved: 'The page moved on. The edit is still here.',
    returnHome: 'Return home',
  },
  ar: {
    shop: 'المتجر',
    standard: 'معيار سولم',
    track: 'تتبع',
    returns: 'الإرجاع',
    atelier: 'أتيليه',
    bag: 'الحقيبة',
    featured: 'مميز',
    addToBag: 'أضف إلى الحقيبة',
    edition: 'الإصدار 01 / عمّان',
    heroTitle: 'ضجيج أقل.',
    heroTitleAccent: 'حضور أكثر.',
    heroBody: 'خزانة مدروسة للمساحة بين خططك. قطع هادئة وحادة، مصممة لإيقاع الأردن اليوم.',
    heroAction: 'استكشف المجموعة',
    moveWithIntent: 'تحرك بقصد',
    dailyUniform: 'الزي اليومي',
    allPieces: 'كل القطع',
    search: 'ابحث في المجموعة',
    noProducts: 'لا توجد قطع هنا بعد.',
    resetFilters: 'إعادة ضبط الفلاتر',
    navigate: 'تصفح',
    shopAll: 'كل المنتجات',
    ourStandard: 'معيارنا',
    trackOrder: 'تتبع طلبك',
    connect: 'تواصل معنا',
    whatsapp: 'تواصل عبر واتساب',
    noteFromAmman: 'رسالة من عمّان',
    footerLine: 'الملابس الجيدة تختفي في تفاصيل يومك.',
    switchToArabic: 'العربية',
    switchToEnglish: 'English',
    lightMode: 'التبديل إلى الوضع الفاتح',
    darkMode: 'التبديل إلى الوضع الداكن',
    openMenu: 'فتح القائمة',
    closeBag: 'إغلاق الحقيبة',
    productOffRail: 'هذه القطعة غير متاحة حالياً.',
    productMoved: 'ربما انتقل المنتج أو أن الرابط غير صحيح.',
    backToEdit: 'العودة إلى المجموعة',
    color: 'اللون',
    selectSize: 'اختر المقاس',
    remaining: 'متبقي',
    chooseSize: 'اختر مقاساً للمتابعة',
    addSelected: 'أضف القطعة المختارة',
    delivery: 'التوصيل داخل الأردن خلال 2–4 أيام',
    exchanges: 'استبدال سهل خلال 7 أيام',
    smartFit: 'مقاسك الذكي / دليل سريع',
    findStartingPoint: 'اعرف مقاسك المبدئي',
    height: 'الطول (سم)',
    weight: 'الوزن (كغ)',
    calculateFit: 'احسب المقاس',
    startingPoint: 'مقاسك المبدئي',
    looserSilhouette: 'تفضل قصة أوسع؟ اختر مقاساً أكبر.',
    productStory: 'قصة القطعة',
    yourBag: 'حقيبتك',
    pieces: 'قطع',
    piece: 'قطعة',
    consideredStart: 'بداية مدروسة',
    bagQuiet: 'حقيبتك فارغة.',
    bagQuietBody: 'ابدأ بقطعة واحدة ستعود إليها غداً.',
    exploreEdit: 'استكشف المجموعة',
    saveBag: 'احفظ حقيبتك لوقت لاحق',
    whatsappNumber: 'رقم واتساب',
    save: 'حفظ',
    reminderConsent: 'أوافق على استلام رسالة تذكير.',
    reminderSaved: 'سنذكّرك بهذه الحقيبة.',
    cancel: 'إلغاء',
    bundleSavings: 'خصم المجموعة',
    estimatedTotal: 'الإجمالي المتوقع',
    checkout: 'المتابعة إلى الدفع',
    finishThought: 'أكمل طلبك / 03',
    yourDetails: 'بياناتك.',
    deliverCare: 'نوصل بعناية إلى جميع أنحاء الأردن. الدفع عند الاستلام متاح.',
    nothingCheckout: 'لا توجد منتجات للدفع.',
    bagWaiting: 'حقيبتك بانتظار القطعة الأولى.',
    returnEdit: 'العودة إلى المجموعة',
    whereNow: 'أين وصل طلبك؟',
    trackIntro: 'أدخل رقم الطلب من رسالة التأكيد ورقم الهاتف المستخدم عند الدفع.',
    needHelp: 'تحتاج مساعدة؟',
    orderNumber: 'رقم الطلب',
    phoneNumber: 'رقم الهاتف',
    findOrder: 'ابحث عن طلبي',
    lookingUp: 'جارٍ البحث…',
    orderNotFound: 'لم نتمكن من العثور على هذا الطلب.',
    checkDetails: 'تحقق من الرقم والهاتف ثم حاول مرة أخرى.',
    orderFound: 'تم العثور على الطلب',
    deliveringTo: 'التوصيل إلى',
    total: 'الإجمالي',
    orderConfirmed: 'تم تأكيد الطلب',
    goodChoice: 'اختيار موفق.',
    continueShopping: 'متابعة التسوق',
    notThisOne: 'ليست هذه الصفحة.',
    pageMoved: 'ربما انتقلت الصفحة، لكن المجموعة ما زالت هنا.',
    returnHome: 'العودة للرئيسية',
  },
} as const;

type TranslationKey = keyof typeof translations.en;
type LanguageContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: TranslationKey) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const requestedLocale = new URLSearchParams(window.location.search).get('lang');
    if (requestedLocale === 'ar' || requestedLocale === 'en') return requestedLocale;
    return (localStorage.getItem('sulm-locale') as Locale) || 'en';
  });
  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    localStorage.setItem('sulm-locale', nextLocale);
  };
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('sulm-locale', locale);
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t: (key: TranslationKey) => translations[locale][key] }), [locale]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/images/sulm-logo.jpg`,
  },
  variables: {
    colorPrimary: "hsl(220 15% 12%)",
    colorForeground: "hsl(220 15% 12%)",
    colorMutedForeground: "hsl(220 8% 39%)",
    colorDanger: "hsl(0 54% 43%)",
    colorBackground: "hsl(42 30% 97%)",
    colorInput: "hsl(42 28% 94%)",
    colorInputForeground: "hsl(220 15% 12%)",
    colorNeutral: "hsl(38 10% 78%)",
    fontFamily: "var(--app-font-sans)",
    borderRadius: "0.15rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-card border-border rounded-sm w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-bold font-sans",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground",
    formFieldLabel: "text-foreground font-bold uppercase tracking-widest text-[10px]",
    footerActionLink: "text-accent hover:text-foreground",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-accent",
    formFieldSuccessText: "text-accent",
    alertText: "text-destructive",
    logoBox: "",
    logoImage: "w-12 h-12 object-cover mx-auto mix-blend-multiply opacity-80",
    socialButtonsBlockButton: "border-border hover:bg-muted",
    formButtonPrimary: "bg-foreground text-background hover:bg-accent rounded-sm",
    formFieldInput: "bg-background border-border text-foreground rounded-sm",
    footerAction: "",
    dividerLine: "bg-border",
    alert: "bg-destructive/10 text-destructive border-destructive/20",
    otpCodeFieldInput: "bg-background border-border text-foreground rounded-sm",
    formFieldRow: "",
    main: "",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener]);

  return null;
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 relative z-50">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        forceRedirectUrl={`${basePath}/admin/catalog`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 relative z-50">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function Navigate({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(to, { replace: true }); }, [to, setLocation]);
  return null;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <AdminLayout>{children}</AdminLayout>
      </Show>
      <Show when="signed-out">
        <Navigate to="/sign-in" />
      </Show>
    </>
  );
}

function HomeRedirect({ onAdd }: { onAdd: (product: Product) => void }) {
  return (
    <>
      <Show when="signed-in">
        <Navigate to="/admin" />
      </Show>
      <Show when="signed-out">
        <Home onAdd={onAdd} />
      </Show>
    </>
  );
}

type CartItem = { product: Product; variant: import("@workspace/api-client-react").StorefrontVariant; quantity: number };

const money = (value: number) => `${value.toFixed(2)} JOD`;

function ProductVisual({ product, large = false }: { product: Product; large?: boolean }) {
  return (
    <div
      className={`image-wash relative overflow-hidden ${large ? 'h-full min-h-[390px] lg:min-h-[650px]' : 'aspect-[4/5]'}`}
      style={{ '--wash': product.accent } as CSSProperties}
    >
      <div className="absolute inset-0 opacity-35 hero-grid" />
      <div className="absolute inset-x-[12%] bottom-[10%] top-[12%] border border-white/20" />
      <img
        src={product.image}
        alt={product.name}
        className="product-card-image absolute inset-0 h-full w-full object-cover mix-blend-multiply opacity-90 dark:mix-blend-screen dark:opacity-75"
        onError={(event) => { event.currentTarget.style.display = 'none'; }}
        data-testid={`img-product-${product.id}`}
      />
      <div className="absolute left-4 top-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em] text-white/80">
        <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
        SULM / {product.category}
      </div>
      <span className="absolute bottom-4 right-4 font-mono text-[10px] tracking-widest text-white/75">
        {String(product.id).padStart(2, '0')} — 24
      </span>
    </div>
  );
}

function Header({ cartCount, onCart, onMenu }: { cartCount: number; onCart: () => void; onMenu: () => void }) {
  const [location] = useLocation();
  const { locale, setLocale, t } = useLanguage();
  const [dark, setDark] = useState(() => localStorage.getItem('sulm-theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('sulm-theme', dark ? 'dark' : 'light');
  }, [dark]);
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-8">
          <button className="outline-focus lg:hidden" onClick={onMenu} aria-label={t('openMenu')} data-testid="button-open-menu">
            <Menu size={21} strokeWidth={1.5} />
          </button>
          <Link href="/" className="group flex items-center gap-3 outline-focus" data-testid="link-logo">
            <span className="grid h-8 w-8 place-items-center rounded-full border border-foreground/60 text-[11px] font-bold tracking-[-.08em]">S.</span>
            <span className="display text-[15px] font-extrabold tracking-[.18em]">SULM WEAR</span>
          </Link>
          <nav className="hidden items-center gap-7 text-[11px] font-bold uppercase tracking-[.16em] lg:flex">
            <a href="#shop" className={`outline-focus transition-colors hover:text-accent ${location === '/' ? 'text-foreground' : 'text-muted-foreground'}`} data-testid="link-shop">{t('shop')}</a>
            <a href="#story" className="text-muted-foreground outline-focus transition-colors hover:text-foreground" data-testid="link-story">{t('standard')}</a>
            <Link href="/track-order" className="text-muted-foreground outline-focus transition-colors hover:text-foreground" data-testid="link-track-order">{t('track')}</Link><Link href="/returns" className="text-muted-foreground outline-focus transition-colors hover:text-foreground" data-testid="link-returns">{t('returns')}</Link><Link href="/loyalty" className="text-muted-foreground outline-focus transition-colors hover:text-foreground" data-testid="link-loyalty">{t('atelier')}</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button
            className="outline-focus min-h-9 border-b border-foreground/40 px-1 text-[10px] font-bold uppercase tracking-[.12em] transition-colors hover:border-accent hover:text-accent"
            onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
            aria-label={locale === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
            data-testid="button-toggle-language"
          >
            {locale === 'en' ? t('switchToArabic') : t('switchToEnglish')}
          </button>
          <button
            className="outline-focus text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setDark(!dark)}
            aria-label={dark ? t('lightMode') : t('darkMode')}
            data-testid="button-toggle-theme"
          >
            {dark ? <Sun size={17} strokeWidth={1.5} /> : <Moon size={17} strokeWidth={1.5} />}
          </button>
          <button className="group flex items-center gap-2 outline-focus" onClick={onCart} data-testid="button-open-cart">
            <ShoppingBag size={19} strokeWidth={1.5} />
            <span className="hidden text-[11px] font-bold uppercase tracking-[.14em] sm:inline">{t('bag')}</span>
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1 text-[10px] font-bold text-background" data-testid="text-cart-count">{cartCount}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-border/70 bg-card">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.3fr_1fr_1fr_1.1fr] lg:px-12">
        <div>
          <div className="mb-5 flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full border border-foreground/60 text-[11px] font-bold">S.</span><span className="font-bold tracking-[.18em]">SULM WEAR</span></div>
          <p className="max-w-xs text-sm leading-7 text-muted-foreground">{t('heroBody')}</p>
        </div>
        <div>
          <p className="mb-5 text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">{t('navigate')}</p>
          <div className="grid gap-3 text-sm"><a href="#shop" className="hover:text-accent" data-testid="footer-link-shop">{t('shopAll')}</a><a href="#story" className="hover:text-accent" data-testid="footer-link-story">{t('ourStandard')}</a><Link href="/track-order" className="hover:text-accent" data-testid="footer-link-track">{t('trackOrder')}</Link></div>
        </div>
        <div>
          <p className="mb-5 text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">{t('connect')}</p>
          <div className="grid gap-3 text-sm"><a href={`tel:${PHONE.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-accent" data-testid="link-footer-phone"><Phone size={14} />{PHONE}</a><a href={INSTAGRAM} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-accent" data-testid="link-footer-instagram"><Instagram size={14} />@sulm_wear</a><a href={`https://wa.me/${PHONE.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="hover:text-accent" data-testid="link-footer-whatsapp">{t('whatsapp')}</a></div>
        </div>
        <div className="border-l border-border pl-6 lg:border-l">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">{t('noteFromAmman')}</p>
          <p className="display text-2xl font-semibold leading-tight">{t('footerLine')}</p>
          <p className="mt-5 text-[11px] uppercase tracking-[.16em] text-muted-foreground">© {new Date().getFullYear()} SULM WEAR</p>
        </div>
      </div>
    </footer>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (product: Product) => void }) {
  const { locale, t } = useLanguage();
  const displayName = locale === 'ar' ? product.nameAr : product.name;
  return (
    <article className="product-card group slide-in" data-testid={`card-product-${product.id}`}>
      <div className="relative">
        <Link href={`/product/${product.slug}`} className="block outline-focus" data-testid={`link-product-${product.id}`}>
          <ProductVisual product={product} />
        </Link>
        {product.featured && <span className="absolute right-3 top-3 bg-background/85 px-2 py-1 text-[9px] font-bold uppercase tracking-[.17em] backdrop-blur-sm">{t('featured')}</span>}
        <button
          className="absolute bottom-3 right-3 flex translate-y-2 items-center gap-2 bg-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-background opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100 focus:translate-y-0 focus:opacity-100"
          onClick={() => onAdd(product)}
          disabled={product.stock < 1}
          data-testid={`button-add-product-${product.id}`}
        >
          <Plus size={13} /> {t('addToBag')}
        </button>
      </div>
      <div className="flex items-start justify-between gap-4 py-4">
        <div><Link href={`/product/${product.slug}`} className="outline-focus text-sm font-semibold hover:text-accent" data-testid={`link-product-name-${product.id}`}>{displayName}</Link>{locale === 'en' && <p className="font-arabic mt-1 text-[11px] text-muted-foreground" dir="rtl">{product.nameAr}</p>}</div>
        <div className="text-right"><p className="font-mono text-xs" data-testid={`text-price-${product.id}`}>{money(product.price)}</p>{product.compareAtPrice && <p className="font-mono text-[10px] text-muted-foreground line-through">{money(product.compareAtPrice)}</p>}</div>
      </div>
    </article>
  );
}

function SkeletonGrid() {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div className="animate-pulse" key={item}><div className="aspect-[4/5] bg-muted" /><div className="mt-4 h-4 w-2/3 bg-muted" /><div className="mt-2 h-3 w-1/3 bg-muted" /></div>)}</div>;
}

function Home({ onAdd }: { onAdd: (product: Product) => void }) {
  const { t } = useLanguage();
  const summaryQuery = useGetStorefrontSummary({ query: { queryKey: getGetStorefrontSummaryQueryKey() } });
  const productsQuery = useGetProducts(undefined, { query: { queryKey: getGetProductsQueryKey() } });
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const products = productsQuery.data ?? [];
  const categories = ['all', ...Array.from(new Set(products.map((product) => product.category)))];
  const filtered = useMemo(() => products.filter((product) => {
    const matchesCategory = category === 'all' || product.category === category;
    const term = search.trim().toLowerCase();
    return matchesCategory && (!term || `${product.name} ${product.nameAr} ${product.category}`.toLowerCase().includes(term));
  }), [category, products, search]);

  return (
    <main>
      <section className="relative overflow-hidden border-b border-border/70">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-70" />
        <div className="mx-auto grid min-h-[660px] max-w-[1440px] items-end gap-12 px-5 pb-16 pt-16 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:px-12 lg:pb-24 lg:pt-24">
          <div className="relative z-10 fade-up">
            <p className="mb-7 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.25em] text-accent"><span className="h-px w-9 bg-accent" />{t('edition')}</p>
            <h1 className="display max-w-4xl text-[clamp(4rem,10vw,9.6rem)] font-extrabold uppercase leading-[.83] tracking-[-.085em]">{t('heroTitle')}<br /><span className="metal-word">{t('heroTitleAccent')}</span></h1>
            <div className="mt-10 max-w-md">
              <p className="text-base leading-7 text-muted-foreground">{t('heroBody')}</p>
            </div>
            <a href="#shop" className="mt-9 inline-flex items-center gap-3 border-b border-foreground pb-2 text-[11px] font-bold uppercase tracking-[.18em] transition-colors hover:border-accent hover:text-accent" data-testid="link-hero-shop">{t('heroAction')} <ArrowDownRight size={16} /></a>
          </div>
          <div className="relative hidden min-h-[490px] items-end justify-end lg:flex fade-up fade-up-delay-2">
            <div className="absolute right-[13%] top-[5%] h-[330px] w-[72%] border border-foreground/20" />
            <div className="absolute bottom-0 right-0 h-[435px] w-[76%] image-wash overflow-hidden" style={{ '--wash': '#84949b' } as CSSProperties}>
              <img src="/images/sulm-logo.jpg" alt="" className="absolute inset-0 h-full w-full object-cover mix-blend-overlay opacity-60 dark:opacity-40" />
              <div className="hero-grid absolute inset-0 opacity-40" />
              <div className="absolute inset-x-[14%] top-[9%] border-t border-white/40" />
              <div className="absolute bottom-[9%] left-[14%] text-[10px] font-bold uppercase tracking-[.24em] text-white/90">{t('moveWithIntent')}</div>
              <div className="absolute bottom-[9%] right-[11%] h-16 w-px bg-white/50" />
            </div>
            <p className="absolute bottom-3 left-0 max-w-[160px] text-[10px] font-bold uppercase leading-5 tracking-[.18em] text-muted-foreground">Object / 001<br />{t('dailyUniform')}</p>
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 bg-card">
        <div className="mx-auto grid max-w-[1440px] divide-y divide-border/70 px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8 lg:px-12">
          <div className="flex items-center gap-4 py-6 sm:px-8 sm:first:pl-0"><span className="font-mono text-2xl text-accent">{summaryQuery.isLoading ? '—' : summaryQuery.data?.productCount ?? '—'}</span><span className="text-[10px] font-bold uppercase tracking-[.17em] text-muted-foreground">pieces in<br />the edit</span></div>
          <div className="flex items-center gap-4 py-6 sm:px-8"><span className="font-mono text-2xl text-accent">{summaryQuery.isLoading ? '—' : summaryQuery.data?.customerCount ?? '—'}</span><span className="text-[10px] font-bold uppercase tracking-[.17em] text-muted-foreground">people in<br />the circle</span></div>
          <div className="flex items-center gap-4 py-6 sm:px-8 sm:last:pr-0"><Truck size={22} strokeWidth={1} className="text-accent" /><span className="text-[10px] font-bold uppercase tracking-[.17em] text-muted-foreground">{summaryQuery.data?.shippingPromise ?? 'Fast delivery across Jordan'}</span></div>
        </div>
      </section>

      <section id="shop" className="mx-auto max-w-[1440px] scroll-mt-20 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div><p className="mb-4 text-[10px] font-bold uppercase tracking-[.23em] text-accent">The collection / 01</p><h2 className="display text-5xl font-bold tracking-[-.06em] sm:text-6xl">The daily edit</h2><p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">Designed to work hard without looking like it. Build your rotation one deliberate piece at a time.</p></div>
          <div className="flex flex-col items-start gap-3 md:items-end"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground rtl:left-auto rtl:right-3" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('search')} aria-label={t('search')} className="h-9 w-48 border-b border-border bg-transparent pl-8 text-xs outline-none placeholder:text-muted-foreground focus:border-accent rtl:pl-0 rtl:pr-8" data-testid="input-search-products" /></div><div className="flex flex-wrap gap-2">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`border px-3 py-2 text-[10px] font-bold uppercase tracking-[.1em] transition-colors ${category === item ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'}`} data-testid={`button-category-${item.toLowerCase().replace(/\s/g, '-')}`}>{item === 'all' ? t('allPieces') : item}</button>)}</div></div>
        </div>
        {productsQuery.isLoading ? <SkeletonGrid /> : productsQuery.isError ? <StateBlock title="The edit is taking a moment." body="We could not load the collection. Check your connection and try again." action="Retry" onAction={() => productsQuery.refetch()} /> : filtered.length === 0 ? <StateBlock title={t('noProducts')} body={t('noProducts')} action={t('resetFilters')} onAction={() => { setSearch(''); setCategory('all'); }} /> : <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">{filtered.map((product) => <ProductCard key={product.id} product={product} onAdd={onAdd} />)}</div>}
      </section>

      <section className="border-y border-border/70 bg-card">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.7fr_1.3fr] lg:gap-20 lg:px-12 lg:py-24">
          <div className="flex flex-col justify-between">
            <div><p className="mb-4 text-[10px] font-bold uppercase tracking-[.23em] text-accent">Shop the look / 02</p><h2 className="display max-w-xs text-5xl font-bold leading-[.9] tracking-[-.065em]">One sharp idea. Three ways in.</h2><p className="mt-5 max-w-xs text-sm leading-7 text-muted-foreground">A small system of pieces that share a point of view, not a uniform.</p></div>
            <Link href={products.find((product) => product.featured)?.slug ? `/product/${products.find((product) => product.featured)?.slug}` : '#shop'} className="mt-10 inline-flex w-fit items-center gap-2 border-b border-foreground pb-2 text-[10px] font-bold uppercase tracking-[.17em] hover:border-accent hover:text-accent" data-testid="link-shop-the-look">Open the lead piece <ArrowRight size={14} /></Link>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">{(products.filter((product) => product.featured).slice(0, 3).length ? products.filter((product) => product.featured).slice(0, 3) : products.slice(0, 3)).map((product, index) => <Link href={`/product/${product.slug}`} key={product.id} className={`group block outline-focus ${index === 1 ? 'mt-10 sm:mt-16' : index === 2 ? 'mt-5 sm:mt-9' : ''}`} data-testid={`link-look-product-${product.id}`}><ProductVisual product={product} /><p className="mt-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground group-hover:text-foreground">{product.name}</p></Link>)}</div>
        </div>
      </section>

      <section id="story" className="border-y border-border/70 bg-card scroll-mt-20">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:gap-28 lg:px-12 lg:py-28">
          <div><p className="mb-4 text-[10px] font-bold uppercase tracking-[.23em] text-accent">The SULM standard</p><h2 className="display max-w-sm text-5xl font-bold leading-[.92] tracking-[-.065em] sm:text-6xl">Wear it until it feels like yours.</h2><p className="font-arabic mt-6 text-sm text-muted-foreground" dir="rtl">نصنع القطع التي تصبح جزءاً من يومك.</p></div>
          <div className="grid gap-10 sm:grid-cols-2"><div className="border-t border-border pt-5"><span className="font-mono text-xs text-accent">01</span><h3 className="mt-7 text-lg font-semibold">Material with a memory</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">Weight, hand-feel, and the way a fabric changes after a hundred wears. We choose for the long middle, not the first impression.</p></div><div className="border-t border-border pt-5"><span className="font-mono text-xs text-accent">02</span><h3 className="mt-7 text-lg font-semibold">Fit, without guessing</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">Every piece comes with a practical fit note. Use the calculator on the product page, then make the call that feels right.</p></div><div className="border-t border-border pt-5 sm:col-span-2"><span className="font-mono text-xs text-accent">03</span><h3 className="mt-7 text-lg font-semibold">Made for Jordanian days</h3><p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">From bright Amman afternoons to late dinners in Jabal Al-Weibdeh, this is clothing that keeps its composure while you move.</p></div></div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="grid overflow-hidden border border-border/80 bg-foreground text-background lg:grid-cols-[1fr_1.1fr]">
          <div className="relative min-h-[350px] overflow-hidden p-8 sm:p-12"><div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-background/20" /><div className="absolute -bottom-28 left-10 h-80 w-80 rounded-full border border-background/10" /><p className="relative text-[10px] font-bold uppercase tracking-[.22em] text-background/60">The circle / 00</p><p className="relative mt-24 max-w-xs text-4xl font-semibold leading-[.95] tracking-[-.06em] sm:text-5xl">For the people who notice the difference.</p></div>
          <div className="flex flex-col justify-between p-8 sm:p-12"><div><Sparkles size={20} strokeWidth={1.2} className="mb-7 text-accent" /><p className="max-w-md text-xl leading-8 text-background/85">Join SULM Notes for early access, fit drops, and the occasional note from Amman. No noise. Just useful things.</p></div><button className="mt-12 flex w-fit items-center gap-3 border-b border-background/60 pb-2 text-[10px] font-bold uppercase tracking-[.18em] transition-colors hover:border-accent hover:text-accent" onClick={() => window.alert('You are on the list. We will be in touch.')} data-testid="button-join-circle">Join the circle <ArrowRight size={15} /></button></div>
        </div>
      </section>
    </main>
  );
}

function StateBlock({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  return <div className="flex min-h-[260px] flex-col items-center justify-center border border-dashed border-border px-6 text-center"><CircleHelp size={24} strokeWidth={1} className="mb-5 text-accent" /><h3 className="display text-2xl font-semibold">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p><button onClick={onAction} className="mt-6 border-b border-foreground pb-1 text-[10px] font-bold uppercase tracking-[.17em] hover:border-accent hover:text-accent" data-testid="button-state-action">{action}</button></div>;
}

function ProductPage({ onAdd }: { onAdd: (product: Product, variant?: import("@workspace/api-client-react").StorefrontVariant) => void }) {
  const { locale, t } = useLanguage();
  const { slug = '' } = useParams<{ slug: string }>();
  const query = useGetProduct(slug, { query: { queryKey: getGetProductQueryKey(slug) } });
  
  const product = query.data;
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [fit, setFit] = useState('');

  const availableColors = useMemo(() => {
    if (!product) return [];
    const colors = new Map<string, string>();
    product.variants.forEach(v => {
      if (!colors.has(v.colorName)) colors.set(v.colorName, v.colorHex);
    });
    return Array.from(colors.entries()).map(([name, hex]) => ({ name, hex }));
  }, [product]);

  const sizesForColor = useMemo(() => {
    if (!product || !selectedColor) return [];
    return product.variants.filter(v => v.colorName === selectedColor);
  }, [product, selectedColor]);

  useEffect(() => {
    if (availableColors.length > 0 && !availableColors.some(c => c.name === selectedColor)) {
      setSelectedColor(availableColors[0].name);
    }
  }, [availableColors, selectedColor]);

  useEffect(() => {
    if (sizesForColor.length > 0 && !sizesForColor.some(v => v.size === selectedSize)) {
      const firstInStock = sizesForColor.find(v => v.stock > 0);
      setSelectedSize(firstInStock ? firstInStock.size : sizesForColor[0].size);
    }
  }, [sizesForColor, selectedSize]);

  const selectedVariant = sizesForColor.find(v => v.size === selectedSize);
  const effectivePrice = selectedVariant?.price ?? product?.price ?? 0;
  const effectiveCompareAt = selectedVariant?.compareAtPrice ?? product?.compareAtPrice;

  const calculateFit = () => {
    const h = Number(height); const w = Number(weight);
    if (!h || !w) return;
    const bmi = w / ((h / 100) ** 2);
    const index = bmi < 20 ? 0 : bmi < 24 ? 1 : bmi < 28 ? 2 : 3;
    setFit(product?.sizes[Math.min(index, (product?.sizes.length ?? 1) - 1)] ?? 'M');
  };

  if (query.isLoading) return <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12"><SkeletonGrid /></div>;
  if (query.isError || !product) return <div className="mx-auto max-w-[680px] px-5 py-32 text-center sm:px-8"><StateBlock title={t('productOffRail')} body={t('productMoved')} action={t('backToEdit')} onAction={() => window.history.back()} /></div>;
  
  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-muted-foreground hover:text-foreground" data-testid="link-back-shop"><ArrowLeft size={14} className="rtl:rotate-180" /> {t('backToEdit')}</Link>
      <div className="grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:h-[calc(100vh-9rem)]"><ProductVisual product={product} large /></div>
        <div className="flex flex-col justify-center py-3">
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-accent">{product.category} / {String(product.id).padStart(2, '0')}</p>
          <h1 className="display mt-5 text-5xl font-bold leading-[.9] tracking-[-.07em] sm:text-7xl" data-testid="text-product-title">{locale === 'ar' ? product.nameAr : product.name}</h1>
          {locale === 'en' && <p className="font-arabic mt-4 text-sm text-muted-foreground" dir="rtl">{product.nameAr}</p>}
          <div className="mt-7 flex items-baseline gap-3"><span className="font-mono text-lg" data-testid="text-product-price">{money(effectivePrice)}</span>{effectiveCompareAt && <span className="font-mono text-sm text-muted-foreground line-through">{money(effectiveCompareAt)}</span>}</div>
          <div className="my-9 h-px bg-border" />
          <p className="max-w-lg text-sm leading-7 text-muted-foreground">{locale === 'ar' ? product.descriptionAr : product.description}</p>
          
          <div className="mt-9">
            <div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.17em]">Color / {selectedColor}</span></div>
            <div className="flex flex-wrap gap-3">
              {availableColors.map(c => (
                <button key={c.name} onClick={() => setSelectedColor(c.name)} className={`h-10 w-10 rounded-full border-2 transition-all ${selectedColor === c.name ? 'border-foreground' : 'border-transparent hover:scale-110'}`} aria-label={`Select color ${c.name}`} data-testid={`button-color-${c.name.toLowerCase().replace(/\s/g, '-')}`}>
                  <span className="block h-full w-full rounded-full border border-black/10 dark:border-white/10" style={{ backgroundColor: c.hex }} />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-9">
            <div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.17em]">Select size</span>{selectedVariant && <span className="font-mono text-[10px] text-muted-foreground">{selectedVariant.stock} remaining</span>}</div>
            <div className="grid grid-cols-4 gap-2">
              {sizesForColor.map((v) => (
                <button key={v.size} onClick={() => setSelectedSize(v.size)} disabled={v.stock < 1} className={`h-12 border text-xs font-semibold transition-colors ${selectedSize === v.size ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground'} ${v.stock < 1 ? 'opacity-40 cursor-not-allowed' : ''}`} data-testid={`button-size-${v.size}`}>{v.size}</button>
              ))}
            </div>
          </div>

          {selectedVariant && (selectedVariant.chestMm || selectedVariant.lengthMm || selectedVariant.shouldersMm || selectedVariant.sleevesMm || selectedVariant.sku) && (
            <div className="mt-5 flex flex-wrap gap-4 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {selectedVariant.sku && <span>SKU: {selectedVariant.sku}</span>}
              {selectedVariant.chestMm != null && <span>Chest {selectedVariant.chestMm}</span>}
              {selectedVariant.lengthMm != null && <span>Length {selectedVariant.lengthMm}</span>}
              {selectedVariant.shouldersMm != null && <span>Shoulders {selectedVariant.shouldersMm}</span>}
              {selectedVariant.sleevesMm != null && <span>Sleeves {selectedVariant.sleevesMm}</span>}
            </div>
          )}

          <button disabled={!selectedVariant || selectedVariant.stock < 1} onClick={() => selectedVariant && onAdd(product, selectedVariant)} className="mt-5 flex h-14 items-center justify-center gap-3 bg-foreground text-[11px] font-bold uppercase tracking-[.18em] text-background transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-add-to-bag">{!selectedVariant || selectedVariant.stock < 1 ? t('chooseSize') : t('addToBag')} <ArrowRight size={16} className="rtl:rotate-180" /></button>
          
          <div className="mt-10 grid gap-4 border-y border-border py-5 text-sm"><p className="flex items-center gap-3"><Truck size={17} strokeWidth={1.2} className="text-accent" /> {t('delivery')}</p><p className="flex items-center gap-3"><RotateCcw size={17} strokeWidth={1.2} className="text-accent" /> {t('exchanges')}</p></div>
          <div className="mt-10 border border-border/80 p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-accent">Smart fit / quick guide</p><h2 className="mt-2 text-base font-semibold">Find your starting point</h2></div><CircleHelp size={18} strokeWidth={1.2} className="text-muted-foreground" /></div><div className="mt-5 grid grid-cols-2 gap-3"><label className="text-[10px] font-bold uppercase tracking-[.13em] text-muted-foreground">Height (cm)<input value={height} onChange={(event) => setHeight(event.target.value)} type="number" placeholder="174" className="mt-2 h-10 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-accent" data-testid="input-fit-height" /></label><label className="text-[10px] font-bold uppercase tracking-[.13em] text-muted-foreground">Weight (kg)<input value={weight} onChange={(event) => setWeight(event.target.value)} type="number" placeholder="72" className="mt-2 h-10 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-accent" data-testid="input-fit-weight" /></label></div><button onClick={calculateFit} className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] hover:text-accent" data-testid="button-calculate-fit">Calculate fit <ChevronRight size={14} /></button>{fit && <p className="mt-4 border-t border-border pt-4 text-sm">Your starting point: <strong className="text-accent">{fit}</strong>. Prefer a looser silhouette? Go one size up.</p>}</div>
          <details className="group border-b border-border py-5"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">The product story <ChevronDown size={16} className="transition-transform group-open:rotate-180" /></summary><p className="mt-4 text-sm leading-7 text-muted-foreground">{product.story}</p></details>
        </div>
      </div>
    </main>
  );
}



function CartDrawer({ items, open, onClose, onChange }: { items: CartItem[]; open: boolean; onClose: () => void; onChange: (items: CartItem[]) => void }) {
  const quote = useQuoteBundle();
  useEffect(() => {
    if (open && items.length > 0) {
      quote.mutate({ data: { items: items.map(item => ({ productSlug: item.product.slug, variantId: item.variant.id, size: item.variant.size, quantity: item.quantity })) } });
    }
  }, [open, items.map(i => i.product.slug + i.variant.size + i.quantity).join(',')]);

  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [reminderToken, setReminderToken] = useState(() => localStorage.getItem('sulm-cart-reminder') || '');
  useEffect(() => {
    const syncReminder = () => setReminderToken(localStorage.getItem('sulm-cart-reminder') || '');
    window.addEventListener('sulm-cart-reminder-change', syncReminder);
    return () => window.removeEventListener('sulm-cart-reminder-change', syncReminder);
  }, []);
  
  const subscribe = useSubscribeCartReminder();
  const unsubscribe = useUnsubscribeCartReminder();
  
  const handleRemind = (e: FormEvent) => {
    e.preventDefault();
    if (!phone || !consent) return;
    subscribe.mutate({ data: { phone, consent: true, channel: 'in_app', items: items.map(item => ({ productSlug: item.product.slug, variantId: item.variant.id, size: item.variant.size, quantity: item.quantity })) } }, {
      onSuccess: (data) => {
        setReminderToken(data.reminderToken);
        localStorage.setItem('sulm-cart-reminder', data.reminderToken);
        window.dispatchEvent(new Event('sulm-cart-reminder-change'));
      }
    });
  };

  const handleUnsubscribe = () => {
    if (!reminderToken) return;
    unsubscribe.mutate({ data: { reminderToken } }, {
      onSuccess: () => {
        setReminderToken('');
        localStorage.removeItem('sulm-cart-reminder');
        window.dispatchEvent(new Event('sulm-cart-reminder-change'));
      }
    });
  };

  const total = items.reduce((sum, item) => sum + (item.variant.price ?? item.product.price) * item.quantity, 0);
  const quoteData = quote.data;
  const displayTotal = quoteData?.total ?? total;
  const discount = quoteData?.discount ?? 0;

  if (!open) return null;
  const updateQty = (index: number, delta: number) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter((item) => item.quantity > 0));
  
  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-foreground/35 backdrop-blur-[2px]" onClick={onClose} aria-label="Close bag" data-testid="button-close-cart-backdrop" />
      <aside className="slide-in absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-accent">Your bag</p>
            <h2 className="display mt-1 text-2xl font-semibold">{items.length ? `${items.length} ${items.length === 1 ? 'piece' : 'pieces'}` : 'A considered start'}</h2>
          </div>
          <button onClick={onClose} className="outline-focus" aria-label="Close bag" data-testid="button-close-cart"><X size={20} strokeWidth={1.4} /></button>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
            <ShoppingBag size={28} strokeWidth={1} className="mb-5 text-accent" />
            <h3 className="text-lg font-semibold">Your bag is quiet.</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Start with one piece you will reach for tomorrow.</p>
            <Link href="/" onClick={onClose} className="mt-7 border-b border-foreground pb-1 text-[10px] font-bold uppercase tracking-[.17em]" data-testid="link-empty-cart-shop">Explore the edit</Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto px-6 py-4">
              {items.map((item, index) => (
                <div className="flex gap-4 border-b border-border py-5" key={`${item.product.id}-${item.variant.id}`}>
                  <div className="h-24 w-20 shrink-0"><ProductVisual product={item.product} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="truncate text-sm font-semibold">{item.product.name}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[.15em] text-muted-foreground">{item.variant.colorName} • Size {item.variant.size} • {item.variant.sku}</p>
                      </div>
                      <button className="text-muted-foreground hover:text-destructive" onClick={() => updateQty(index, -item.quantity)} aria-label={`Remove ${item.product.name}`} data-testid={`button-remove-cart-${item.product.id}`}><X size={14} /></button>
                    </div>
                    <div className="mt-5 flex items-center justify-between">
                      <div className="flex items-center border border-border">
                        <button className="grid h-7 w-7 place-items-center hover:bg-muted" onClick={() => updateQty(index, -1)} data-testid={`button-decrease-cart-${item.product.id}`}><Minus size={12} /></button>
                        <span className="w-7 text-center font-mono text-[11px]">{item.quantity}</span>
                        <button className="grid h-7 w-7 place-items-center hover:bg-muted" onClick={() => updateQty(index, 1)} data-testid={`button-increase-cart-${item.product.id}`}><Plus size={12} /></button>
                      </div>
                      <p className="font-mono text-xs">{money((item.variant.price ?? item.product.price) * item.quantity)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="border-t border-border bg-card p-6">
              {items.length > 0 && !reminderToken && (
                <form onSubmit={handleRemind} className="mb-6 rounded border border-border bg-background p-4">
                  <p className="mb-2 text-xs font-semibold">Save your bag for later</p>
                  <div className="flex gap-2">
                    <input type="tel" placeholder="WhatsApp number" required value={phone} onChange={e => setPhone(e.target.value)} className="h-8 flex-1 border-b border-border bg-transparent text-xs outline-none focus:border-accent" />
                    <button disabled={subscribe.isPending} type="submit" className="h-8 bg-foreground px-3 text-[10px] font-bold uppercase tracking-[.1em] text-background hover:bg-accent disabled:opacity-50">Save</button>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} className="h-3 w-3" />
                    I agree to receive a reminder message.
                  </label>
                </form>
              )}
              {items.length > 0 && reminderToken && (
                <div className="mb-6 flex items-center justify-between rounded border border-border bg-background p-4">
                  <p className="text-xs text-muted-foreground">We'll remind you about this bag.</p>
                  <button onClick={handleUnsubscribe} disabled={unsubscribe.isPending} className="text-[10px] font-bold uppercase tracking-[.1em] text-destructive hover:underline">Cancel</button>
                </div>
              )}
              <div className="mb-6 space-y-2">
                {discount > 0 && <div className="flex justify-between text-sm text-accent"><p>Bundle savings</p><p>−{money(discount)}</p></div>}
                <div className="flex justify-between text-base font-semibold"><p>Estimated total</p><p>{money(displayTotal)}</p></div>
              </div>
              <Link href="/checkout" onClick={onClose} className="flex h-12 w-full items-center justify-center gap-3 bg-foreground text-[11px] font-bold uppercase tracking-[.18em] text-background transition-colors hover:bg-accent" data-testid="link-cart-checkout">Proceed to checkout <ArrowRight size={15} /></Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}



function Checkout({ items, onSuccess }: { items: CartItem[]; onSuccess: (order: Order) => void }) {
  const mutation = useCreateOrder();
  const [form, setForm] = useState({ customerName: '', phone: '', city: 'Amman', address: '', paymentMethod: 'cod' as 'cod' | 'prepaid' });
  
  const quote = useQuoteBundle();
  useEffect(() => {
    if (items.length > 0) {
      quote.mutate({ data: { items: items.map(item => ({ productSlug: item.product.slug, variantId: item.variant.id, size: item.variant.size, quantity: item.quantity })) } });
    }
  }, [items.map(i => i.product.slug + i.variant.size + i.quantity).join(',')]);

  const [loyaltyPhone, setLoyaltyPhone] = useState('');
  const [loyaltyOrder, setLoyaltyOrder] = useState('');
  const loyalty = useLookupLoyalty();
  const [useWallet, setUseWallet] = useState(false);
  
  const availableWallet = loyalty.data?.walletCredit ?? 0;
  const total = items.reduce((sum, item) => sum + (item.variant.price ?? item.product.price) * item.quantity, 0);
  const quoteData = quote.data;
  const displayTotal = quoteData?.total ?? total;
  const discount = quoteData?.discount ?? 0;
  const maxWallet = Math.min(availableWallet, displayTotal);
  
  const [walletAmount, setWalletAmount] = useState(0);
  useEffect(() => {
    if (useWallet) setWalletAmount(maxWallet);
  }, [maxWallet, useWallet]);

  const handleLoyaltyLookup = (e: FormEvent) => {
    e.preventDefault();
    loyalty.mutate({ data: { phone: loyaltyPhone, orderNumber: loyaltyOrder } });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const orderData: any = {
      ...form, 
      items: items.map((item) => ({ productSlug: item.product.slug, variantId: item.variant.id, size: item.variant.size, quantity: item.quantity }))
    };
    if (useWallet && walletAmount > 0 && loyalty.data?.verificationToken) {
      orderData.walletCreditToUse = walletAmount;
      orderData.loyaltyVerificationToken = loyalty.data.verificationToken;
    }
    mutation.mutate({ data: orderData }, { onSuccess }); 
  };
  
  if (!items.length) return <div className="mx-auto max-w-[640px] px-5 py-28 text-center sm:px-8"><ShoppingBag size={30} strokeWidth={1} className="mx-auto mb-6 text-accent" /><h1 className="display text-5xl font-bold tracking-[-.06em]">Nothing to check out.</h1><p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">Your bag is waiting for the first piece.</p><Link href="/" className="mt-8 inline-flex border-b border-foreground pb-1 text-[10px] font-bold uppercase tracking-[.17em]" data-testid="link-checkout-empty-shop">Return to the edit</Link></div>;
  
  return (
    <main className="mx-auto max-w-[1240px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <div className="mb-10">
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-accent">Finish the thought / 03</p>
        <h1 className="display mt-4 text-5xl font-bold tracking-[-.07em] sm:text-7xl">Your details.</h1>
        <p className="mt-4 text-sm text-muted-foreground">We deliver with care across Jordan. Cash on delivery is available.</p>
      </div>
      <div className="grid gap-14 lg:grid-cols-[1fr_380px]">
        <div className="space-y-10">
          <form onSubmit={handleLoyaltyLookup} className="border border-border bg-card p-6">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground mb-4">SULM Atelier Member?</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input required minLength={6} value={loyaltyOrder} onChange={(e) => setLoyaltyOrder(e.target.value)} placeholder="Order number" className="h-10 w-full border-b border-border bg-transparent text-sm uppercase outline-none focus:border-accent" data-testid="input-checkout-loyalty-order" />
              <input required minLength={8} value={loyaltyPhone} onChange={(e) => setLoyaltyPhone(e.target.value)} placeholder="Phone number" className="h-10 w-full border-b border-border bg-transparent text-sm outline-none focus:border-accent" data-testid="input-checkout-loyalty-phone" />
              <button type="submit" disabled={loyalty.isPending || !loyaltyPhone || !loyaltyOrder} className="px-4 h-10 border border-foreground text-[10px] font-bold uppercase tracking-[.1em] hover:bg-foreground hover:text-background" data-testid="button-checkout-loyalty-lookup">{loyalty.isPending ? 'Checking...' : 'Check Wallet'}</button>
            </div>
            {loyalty.isError && <p className="mt-3 text-xs text-destructive">No loyalty profile found.</p>}
            {loyalty.isSuccess && loyalty.data && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm font-semibold mb-2">Available Wallet Credit: {loyalty.data.walletCredit.toFixed(2)} JOD</p>
                {loyalty.data.walletCredit > 0 && (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={useWallet} onChange={(e) => { setUseWallet(e.target.checked); setWalletAmount(maxWallet); }} data-testid="checkbox-use-wallet" />
                    Use wallet credit for this order
                  </label>
                )}
              </div>
            )}
          </form>

          <form id="checkout-form" onSubmit={handleSubmit} className="grid gap-8">
            <div className="grid gap-6 sm:grid-cols-2">
              <label className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">Full name<input required minLength={2} value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} className="mt-2 h-10 w-full border-b border-border bg-transparent text-sm outline-none focus:border-accent" data-testid="input-checkout-name" /></label>
              <label className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">Phone number<input required minLength={8} type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-2 h-10 w-full border-b border-border bg-transparent text-sm outline-none focus:border-accent" data-testid="input-checkout-phone" /></label>
            </div>
            <label className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">City<select required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} className="mt-2 h-10 w-full border-b border-border bg-transparent text-sm outline-none focus:border-accent" data-testid="select-checkout-city"><option>Amman</option><option>Irbid</option><option>Zarqa</option><option>Aqaba</option><option>Salt</option><option>Madaba</option><option>Mafraq</option><option>Jerash</option><option>Ajloun</option><option>Karak</option><option>Tafileh</option><option>Maan</option><option>Aqaba</option></select></label>
            <label className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">Address details<textarea required minLength={5} rows={3} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="mt-2 w-full border-b border-border bg-transparent py-2 text-sm outline-none focus:border-accent" placeholder="Street, building, apartment" data-testid="textarea-checkout-address" /></label>
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">Payment method</p>
              <label className="flex cursor-pointer items-center gap-4 border border-border p-4 transition-colors hover:border-accent"><input type="radio" name="payment" checked={form.paymentMethod === 'cod'} onChange={() => setForm({ ...form, paymentMethod: 'cod' })} className="accent-accent" data-testid="radio-payment-cod" /><div><p className="text-sm font-semibold">Cash on delivery</p><p className="mt-1 text-xs text-muted-foreground">Pay when your pieces arrive.</p></div></label>
              <label className="flex cursor-pointer items-center gap-4 border border-border p-4 transition-colors hover:border-accent"><input type="radio" name="payment" checked={form.paymentMethod === 'prepaid'} onChange={() => setForm({ ...form, paymentMethod: 'prepaid' })} className="accent-accent" data-testid="radio-payment-prepaid" /><div><p className="text-sm font-semibold">CliQ / Mobile Wallet</p><p className="mt-1 text-xs text-muted-foreground">Fast and contactless.</p></div></label>
            </div>
            {mutation.isError && <div className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">Something went wrong. Please check your details and try again.</div>}
            <button type="submit" disabled={mutation.isPending} className="mt-4 flex h-14 w-full items-center justify-center gap-3 bg-foreground text-[11px] font-bold uppercase tracking-[.18em] text-background transition-colors hover:bg-accent disabled:opacity-50" data-testid="button-submit-checkout">{mutation.isPending ? 'Confirming...' : 'Place order'} <ArrowRight size={16} /></button>
          </form>
        </div>
        <div>
          <div className="sticky top-28 border border-border bg-card p-6">
            <h2 className="mb-6 text-[10px] font-bold uppercase tracking-[.2em] text-accent">Order summary</h2>
            <div className="mb-6 space-y-4 border-b border-border pb-6">
              {items.map((item) => (
                <div className="flex justify-between gap-4" key={`${item.product.id}-${item.variant.id}`}>
                  <div><p className="text-sm font-semibold">{item.product.name}</p><p className="mt-1 text-[10px] uppercase tracking-[.1em] text-muted-foreground">{item.variant.colorName} • Size {item.variant.size} • Qty {item.quantity}</p></div>
                  <p className="font-mono text-xs">{money((item.variant.price ?? item.product.price) * item.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3 border-b border-border pb-6">
              <div className="flex justify-between text-sm"><p className="text-muted-foreground">Subtotal</p><p className="font-mono">{money(total)}</p></div>
              <div className="flex justify-between text-sm"><p className="text-muted-foreground">Delivery</p><p className="font-mono">Free</p></div>
              {discount > 0 && <div className="flex justify-between text-sm text-accent"><p>Bundle savings</p><p className="font-mono">−{money(discount)}</p></div>}
              {useWallet && walletAmount > 0 && <div className="flex justify-between text-sm text-accent"><p>Wallet credit applied</p><p className="font-mono">−{money(walletAmount)}</p></div>}
            </div>
            <div className="mt-6 flex justify-between">
              <p className="font-semibold">Total</p>
              <p className="font-mono font-semibold">{money(Math.max(0, displayTotal - (useWallet ? walletAmount : 0)))}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}


function TrackOrder() {
  const [form, setForm] = useState({ orderNumber: '', phone: '' });
  const [submitted, setSubmitted] = useState<{ orderNumber: string; phone: string }>();
  const params = submitted ?? { orderNumber: '', phone: '' };
  const query = useLookupOrder(params, { query: { enabled: Boolean(submitted), queryKey: getLookupOrderQueryKey(params) } });
  const submit = (event: FormEvent) => { event.preventDefault(); setSubmitted(form); };
  return <main className="mx-auto max-w-[1080px] px-5 py-16 sm:px-8 lg:py-24"><div className="grid gap-14 lg:grid-cols-[.85fr_1.15fr]"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-accent">After the order / 04</p><h1 className="display mt-5 text-6xl font-bold leading-[.86] tracking-[-.075em] sm:text-8xl">Where is<br />it now?</h1><p className="mt-8 max-w-sm text-sm leading-7 text-muted-foreground">Enter the order number from your confirmation and the phone number used at checkout.</p><p className="font-arabic mt-5 text-sm text-muted-foreground" dir="rtl">تابع طلبك بخطوتين بسيطتين.</p><div className="mt-12 flex items-center gap-3 text-xs text-muted-foreground"><a href={`tel:${PHONE.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-accent" data-testid="link-track-phone"><Phone size={14} /> Need help? {PHONE}</a></div></div><div><form onSubmit={submit} className="border border-border bg-card p-6 sm:p-9"><label className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Order number<input required value={form.orderNumber} onChange={(event) => setForm({ ...form, orderNumber: event.target.value })} placeholder="SULM-0000" className="mt-2 h-12 w-full border-b border-border bg-transparent text-sm uppercase outline-none focus:border-accent" data-testid="input-order-number" /></label><label className="mt-7 block text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Phone number<input required minLength={8} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+962 7..." className="mt-2 h-12 w-full border-b border-border bg-transparent text-sm outline-none focus:border-accent" data-testid="input-track-phone" /></label><button className="mt-9 flex h-13 w-full items-center justify-center gap-3 bg-foreground text-[11px] font-bold uppercase tracking-[.18em] text-background hover:bg-accent disabled:opacity-50" disabled={query.isFetching} data-testid="button-lookup-order">{query.isFetching ? 'Looking it up…' : 'Find my order'} <Search size={15} /></button></form>{query.isError && <div className="mt-5 border border-destructive/40 bg-destructive/10 p-5" data-testid="status-order-error"><p className="text-sm font-semibold">We could not find that order.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Check the number and phone, then try again.</p></div>}{query.data && <OrderResult order={query.data} />}</div></div></main>;
}

function OrderResult({ order }: { order: Order }) {
  const statuses = ['new', 'confirmed', 'processing', 'packed', 'ready_to_ship', 'shipped', 'delivered'];
  const current = statuses.indexOf(order.status);
  return <div className="slide-in mt-5 border border-border bg-card p-6 sm:p-9" data-testid="status-order-result"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-accent">Order found</p><h2 className="mt-2 font-mono text-xl">{order.orderNumber}</h2></div><PackageCheck size={23} strokeWidth={1.2} className="text-accent" /></div><div className="my-8 grid grid-cols-5 gap-1">{statuses.map((status, index) => <div key={status}><div className={`h-1 ${index <= current ? 'bg-accent' : 'bg-muted'}`} /><p className={`mt-3 text-[8px] font-bold uppercase tracking-[.08em] ${index === current ? 'text-foreground' : 'text-muted-foreground'}`}>{status.replace('_', ' ')}</p></div>)}</div><div className="grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2"><p><span className="block text-[10px] uppercase tracking-[.14em] text-muted-foreground">Delivering to</span>{order.city}</p><p><span className="block text-[10px] uppercase tracking-[.14em] text-muted-foreground">Total</span><span className="font-mono">{money(order.total)}</span></p></div></div>;
}


function Success({ order }: { order: Order }) {
  return (
    <main className="mx-auto max-w-[760px] px-5 py-24 text-center sm:px-8 lg:py-32">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-accent text-accent">
        <Check size={28} strokeWidth={1.2} />
      </div>
      <p className="mt-8 text-[10px] font-bold uppercase tracking-[.23em] text-accent">Order confirmed / {order.orderNumber}</p>
      <h1 className="display mt-5 text-6xl font-bold leading-[.88] tracking-[-.08em] sm:text-8xl">Good choice.</h1>
      <p className="mx-auto mt-8 max-w-md text-sm leading-7 text-muted-foreground">
        Thanks, {order.customerName.split(' ')[0]}. We have your order and will be in touch on {order.phone} before it leaves us.
      </p>

      {(order.loyaltyPointsEarned > 0 || order.bundleDiscount > 0 || order.walletCreditUsed > 0) && (
        <div className="mt-8 border border-border bg-card p-6 mx-auto max-w-sm text-left slide-in">
          <p className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground mb-4">Value Summary</p>
          <div className="space-y-2 text-sm">
            {order.bundleDiscount > 0 && (
              <p className="flex justify-between"><span className="text-muted-foreground">Bundle Savings:</span><span className="font-mono text-accent">{money(order.bundleDiscount)}</span></p>
            )}
            {order.walletCreditUsed > 0 && (
              <p className="flex justify-between"><span className="text-muted-foreground">Wallet Used:</span><span className="font-mono text-green-600">{money(order.walletCreditUsed)}</span></p>
            )}
            {order.loyaltyPointsEarned > 0 && (
              <p className="flex justify-between border-t border-border pt-2 mt-2"><span className="text-muted-foreground">Points Earned:</span><span className="font-mono font-semibold">+{order.loyaltyPointsEarned}</span></p>
            )}
          </div>
        </div>
      )}

      <p className="font-arabic mt-8 text-sm text-muted-foreground" dir="rtl">شكراً لاختيارك سولم. سنكون على تواصل قريباً.</p>
      <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
        <Link href="/" className="inline-flex h-12 items-center justify-center gap-2 bg-foreground px-7 text-[10px] font-bold uppercase tracking-[.17em] text-background" data-testid="link-success-shop">Continue shopping <ArrowRight size={14} /></Link>
        <Link href="/track-order" className="inline-flex h-12 items-center justify-center border border-border px-7 text-[10px] font-bold uppercase tracking-[.17em]" data-testid="link-success-track">Track order</Link>
      </div>
    </main>
  );
}


function NotFoundPage() {
  return <main className="mx-auto max-w-[700px] px-5 py-32 text-center"><p className="font-mono text-sm text-accent">404 / OUT OF FRAME</p><h1 className="display mt-5 text-7xl font-bold tracking-[-.08em]">Not this one.</h1><p className="mx-auto mt-5 max-w-sm text-sm leading-7 text-muted-foreground">The page moved on. The edit is still here.</p><Link href="/" className="mt-9 inline-flex items-center gap-2 border-b border-foreground pb-2 text-[10px] font-bold uppercase tracking-[.17em]" data-testid="link-not-found-home"><ArrowLeft size={14} /> Return home</Link></main>;
}

function RouterContent({ cart, setCart, cartOpen, setCartOpen }: { cart: CartItem[]; setCart: (items: CartItem[]) => void; cartOpen: boolean; setCartOpen: (open: boolean) => void }) {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [success, setSuccess] = useState<Order>();
  const add = (product: Product, variant?: import("@workspace/api-client-react").StorefrontVariant) => {
    const selectedVariant = variant ?? product.variants.find((v) => v.stock > 0) ?? product.variants[0];
    if (!selectedVariant) return;
    const existing = cart.find((item) => item.product.id === product.id && item.variant.id === selectedVariant.id);
    setCart(existing ? cart.map((item) => item === existing ? { ...item, quantity: item.quantity + 1 } : item) : [...cart, { product, variant: selectedVariant, quantity: 1 }]);
    setCartOpen(true);
  };
  const [location, setLocation] = useLocation();
  const isAdminOrAuth = location.startsWith('/admin') || location.startsWith('/sign-in') || location.startsWith('/sign-up');

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Admin Access", subtitle: "Restricted to authorized personnel" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <ErrorBoundary resetKey={location}>
        <div className="noise sulm-shell min-h-[100dvh]">
          {!isAdminOrAuth && <Header cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)} onCart={() => setCartOpen(true)} onMenu={() => setMenuOpen(!menuOpen)} />}
          
          {menuOpen && !isAdminOrAuth && (
            <div className="fixed inset-x-0 top-[72px] z-30 border-b border-border bg-background p-6 lg:hidden">
              <div className="grid gap-5 text-[11px] font-bold uppercase tracking-[.17em]">
                <a href="#shop" onClick={() => setMenuOpen(false)} data-testid="mobile-link-shop">{t('shop')}</a>
                <a href="#story" onClick={() => setMenuOpen(false)} data-testid="mobile-link-story">{t('standard')}</a>
                <Link href="/track-order" onClick={() => setMenuOpen(false)} data-testid="mobile-link-track">{t('track')}</Link>
                <Link href="/returns" onClick={() => setMenuOpen(false)} data-testid="mobile-link-returns">{t('returns')}</Link>
                <Link href="/loyalty" onClick={() => setMenuOpen(false)} data-testid="mobile-link-loyalty">{t('atelier')}</Link>
              </div>
            </div>
          )}
          
          <Switch>
            <Route path="/" component={() => <HomeRedirect onAdd={add} />} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            
            <Route path="/admin" component={() => <AdminGuard><Navigate to="/admin/catalog" /></AdminGuard>} />
            <Route path="/admin/orders" component={() => <AdminGuard><AdminOrders /></AdminGuard>} />
            <Route path="/admin/catalog" component={() => <AdminGuard><AdminCatalog /></AdminGuard>} />
            <Route path="/admin/health" component={() => <AdminGuard><AdminSystemHealth /></AdminGuard>} />
            
            <Route path="/product/:slug" component={() => <ProductPage onAdd={add} />} />
            <Route path="/track-order" component={TrackOrder} />
            <Route path="/loyalty" component={Loyalty} />
            <Route path="/returns" component={Returns} />
            <Route path="/checkout" component={() => success ? <Success order={success} /> : <Checkout items={cart} onSuccess={(order) => { setSuccess(order); setCart([]); }} />} />
            <Route component={NotFoundPage} />
          </Switch>
          
          {!isAdminOrAuth && location !== '/checkout' && <Footer />}
          {!isAdminOrAuth && <CartDrawer items={cart} open={cartOpen} onClose={() => setCartOpen(false)} onChange={setCart} />}
        </div>
      </ErrorBoundary>
    </ClerkProvider>
  );
}


function CartReminderPolling() {
  const token = localStorage.getItem('sulm-cart-reminder');
  const [activeToken, setActiveToken] = useState(token);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleStorage = () => setActiveToken(localStorage.getItem('sulm-cart-reminder'));
    window.addEventListener('storage', handleStorage);
    // Overriding push/pop state to intercept local changes isn't perfect, 
    // so we'll just check periodically or rely on useGetCartReminder to be enabled.
    const interval = setInterval(() => {
      setActiveToken(localStorage.getItem('sulm-cart-reminder'));
    }, 5000);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  const query = useGetCartReminder(activeToken || '', {
    query: {
      enabled: Boolean(activeToken),
      refetchInterval: 10000,
      queryKey: getGetCartReminderQueryKey(activeToken || ''),
    }
  });

  const markDelivered = useMarkCartReminderDelivered();

  useEffect(() => {
    if (query.data?.due && activeToken) {
      setShowBanner(true);
      markDelivered.mutate({ token: activeToken }, {
        onSettled: () => {
          localStorage.removeItem('sulm-cart-reminder');
          window.dispatchEvent(new Event('sulm-cart-reminder-change'));
          setActiveToken(null);
        }
      });
    }
  }, [query.data?.due, activeToken, markDelivered]);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 slide-in max-w-sm border border-border bg-foreground text-background p-5 shadow-2xl" data-testid="banner-cart-reminder">
      <div className="flex justify-between items-start gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-accent">Don't leave it behind</p>
          <p className="mt-2 text-sm leading-6 text-background/85">Your selected pieces are still waiting in your bag. They might sell out soon.</p>
        </div>
        <button onClick={() => setShowBanner(false)} className="text-background/50 hover:text-background" data-testid="button-close-reminder"><X size={16} /></button>
      </div>
      <Link href="/checkout" onClick={() => setShowBanner(false)} className="mt-5 inline-flex items-center gap-2 border-b border-background/60 pb-1 text-[10px] font-bold uppercase tracking-[.18em] text-background hover:border-accent hover:text-accent" data-testid="link-reminder-checkout">Complete order <ArrowRight size={14} /></Link>
    </div>
  );
}

function App() {
  const [cart, setCartState] = useState<CartItem[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('sulm-cart') ?? '[]');
      return parsed.filter((item: any) => item && item.product && item.variant && item.variant.id) as CartItem[];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const setCart = (items: CartItem[]) => { setCartState(items); localStorage.setItem('sulm-cart', JSON.stringify(items)); };
  return <QueryClientProvider client={queryClient}><TooltipProvider><LanguageProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RouterContent cart={cart} setCart={setCart} cartOpen={cartOpen} setCartOpen={setCartOpen} /></WouterRouter><Toaster /><CartReminderPolling /></LanguageProvider></TooltipProvider></QueryClientProvider>;
}

export default App;
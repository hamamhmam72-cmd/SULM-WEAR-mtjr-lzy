import { useState } from "react";
import { 
  useGetAdminProducts, getGetAdminProductsQueryKey, 
  useCreateAdminProduct, useUpdateAdminProduct, useDeleteAdminProduct,
  useRequestAdminUploadUrl,
  AdminProduct, AdminProductInput, AdminProductInputStatus
} from "@workspace/api-client-react";
import { Plus, Search, Edit2, Trash2, Loader2, Image as ImageIcon, X, Save, ArrowLeft, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";

function emptyProduct(): AdminProductInput {
  return {
    slug: "",
    name: "",
    nameAr: "",
    category: "T-Shirts",
    price: 0,
    compareAtPrice: null,
    description: "",
    descriptionAr: "",
    image: "",
    accent: "#000000",
    featured: false,
    story: "",
    status: 'draft',
    variants: []
  };
}

export function AdminCatalog() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: products, isLoading, isError: isProductsError } = useGetAdminProducts({
    query: { queryKey: getGetAdminProductsQueryKey() }
  });
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AdminProductInput | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [mutError, setMutError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const createMut = useCreateAdminProduct();
  const updateMut = useUpdateAdminProduct();
  const deleteMut = useDeleteAdminProduct();
  const uploadMut = useRequestAdminUploadUrl();

  const handleEdit = (p: AdminProduct) => {
    setEditingId(p.id);
    setMutError(null);
    setUploadError(null);
    setForm({
      slug: p.slug,
      name: p.name,
      nameAr: p.nameAr,
      category: p.category,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      description: p.description,
      descriptionAr: p.descriptionAr,
      image: p.image,
      accent: p.accent,
      featured: p.featured,
      story: p.story,
      status: p.status,
      variants: p.variants.map(v => ({
        id: v.id,
        sku: v.sku,
        colorName: v.colorName,
        colorHex: v.colorHex,
        size: v.size,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        stock: v.stock,
        chestMm: v.chestMm,
        lengthMm: v.lengthMm,
        shouldersMm: v.shouldersMm,
        sleevesMm: v.sleevesMm,
        media: v.media,
        active: v.active
      }))
    });
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setMutError(null);
    setUploadError(null);
    setForm(emptyProduct());
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (form.variants.length === 0) {
      setMutError("Please add at least one variant before saving.");
      return;
    }
    
    setMutError(null);
    if (editingId) {
      updateMut.mutate({ id: editingId, data: form }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAdminProductsQueryKey() });
          setForm(null);
        },
        onError: (err: any) => setMutError(err?.error || "Failed to update product")
      });
    } else {
      createMut.mutate({ data: form }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAdminProductsQueryKey() });
          setForm(null);
        },
        onError: (err: any) => setMutError(err?.error || "Failed to create product")
      });
    }
  };

  const handleDelete = (id: number) => {
    deleteMut.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminProductsQueryKey() });
        setIsDeleting(null);
      }
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    setUploadError(null);
    
    uploadMut.mutate({ data: { name: file.name, size: file.size, contentType: file.type as any } }, {
      onSuccess: async (res) => {
        try {
          const putRes = await fetch(res.uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
          if (!putRes.ok) throw new Error("Upload failed");
          setForm({ ...form, image: res.objectPath });
        } catch (err) {
          setUploadError("Failed to upload image. Please try again.");
        }
      },
      onError: () => setUploadError("Failed to request upload URL.")
    });
  };

  const money = (val: number) => `${val.toFixed(2)} JOD`;

  if (form) {
    return (
      <div className="flex h-full flex-col bg-background">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6 sticky top-0 bg-background z-10">
          <div className="flex items-center gap-4">
            <button aria-label="Back to catalog" onClick={() => setForm(null)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={18} /></button>
            <h2 className="text-sm font-bold uppercase tracking-[.18em]">{editingId ? 'Edit Product' : 'New Product'}</h2>
          </div>
          <button 
            type="submit"
            form="product-form"
            disabled={createMut.isPending || updateMut.isPending}
            className="flex items-center gap-2 bg-foreground text-background px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-accent disabled:opacity-50"
          >
            {(createMut.isPending || updateMut.isPending) ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Product
          </button>
        </header>

        <form id="product-form" onSubmit={handleSave} className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full">
          {mutError && (
            <div className="mb-6 flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm">
              <AlertCircle size={16} /> {mutError}
              <button aria-label="Dismiss error" type="button" onClick={() => setMutError(null)} className="ml-auto"><X size={16} /></button>
            </div>
          )}

          <div className="grid gap-8">
            {/* Basics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border border-border rounded-sm bg-card/30">
              <div className="col-span-full mb-2 border-b border-border pb-2"><h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Basics</h3></div>
              <label className="text-[10px] font-bold uppercase tracking-widest">Name (EN)
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="mt-2 h-9 w-full border border-border bg-background px-3 text-xs outline-none rounded-sm" />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-widest font-arabic text-right">Name (AR)
                <input required value={form.nameAr} onChange={e => setForm({...form, nameAr: e.target.value})} dir="rtl" className="mt-2 h-9 w-full border border-border bg-background px-3 text-xs outline-none rounded-sm font-arabic" />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-widest">Slug
                <input required value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} className="mt-2 h-9 w-full border border-border bg-background px-3 text-xs outline-none rounded-sm pattern-slug" pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$" title="Lowercase letters, numbers, and hyphens only" />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-widest">Category
                <input required value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="mt-2 h-9 w-full border border-border bg-background px-3 text-xs outline-none rounded-sm" />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-widest">Price
                <input required min={0} step={0.01} type="number" value={form.price || ''} onChange={e => setForm({...form, price: Number(e.target.value)})} className="mt-2 h-9 w-full border border-border bg-background px-3 text-xs outline-none rounded-sm" />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-widest">Compare At (Optional)
                <input min={0} step={0.01} type="number" value={form.compareAtPrice || ''} onChange={e => setForm({...form, compareAtPrice: e.target.value ? Number(e.target.value) : null})} className="mt-2 h-9 w-full border border-border bg-background px-3 text-xs outline-none rounded-sm" />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-widest">Status
                <select required value={form.status} onChange={e => setForm({...form, status: e.target.value as AdminProductInputStatus})} className="mt-2 h-9 w-full border border-border bg-background px-3 text-xs outline-none rounded-sm">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 mt-7 cursor-pointer">
                <input type="checkbox" checked={form.featured} onChange={e => setForm({...form, featured: e.target.checked})} className="h-4 w-4 accent-foreground" />
                Featured Product
              </label>
            </div>

            {/* Media & Design */}
            <div className="p-6 border border-border rounded-sm bg-card/30">
              <div className="mb-6 border-b border-border pb-2"><h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Media & Brand</h3></div>
              <div className="flex gap-6">
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest block mb-2">Main Image</label>
                  {form.image ? (
                    <div className="relative aspect-[3/4] w-48 border border-border overflow-hidden bg-muted group rounded-sm">
                      <img src={form.image} alt={form.name} className="w-full h-full object-cover" />
                      <button aria-label="Remove image" type="button" onClick={() => setForm({...form, image: ''})} className="absolute top-2 right-2 p-1.5 bg-background/80 hover:bg-background text-foreground backdrop-blur-sm rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                    </div>
                  ) : (
                    <label className="flex aspect-[3/4] w-48 cursor-pointer flex-col items-center justify-center border border-dashed border-border hover:bg-muted/50 rounded-sm relative">
                      {uploadMut.isPending ? <Loader2 className="animate-spin text-muted-foreground" /> : <ImageIcon size={24} className="text-muted-foreground mb-2" />}
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Upload Image</span>
                      <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} />
                    </label>
                  )}
                  <input type="hidden" required value={form.image} />
                  {uploadError && <p className="text-xs text-destructive mt-2">{uploadError}</p>}
                </div>
                <div className="flex-1 flex flex-col gap-6">
                  <label className="text-[10px] font-bold uppercase tracking-widest">Accent Color
                    <div className="flex items-center gap-3 mt-2">
                      <input type="color" value={form.accent} onChange={e => setForm({...form, accent: e.target.value})} className="h-9 w-12 cursor-pointer rounded-sm" />
                      <input required pattern="^#[0-9A-Fa-f]{6}$" title="Valid hex color (e.g., #000000)" value={form.accent} onChange={e => setForm({...form, accent: e.target.value})} className="h-9 flex-1 border border-border bg-background px-3 text-xs outline-none rounded-sm font-mono uppercase" />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 border border-border rounded-sm bg-card/30">
               <div className="mb-6 border-b border-border pb-2"><h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Story & Descriptions</h3></div>
               <label className="text-[10px] font-bold uppercase tracking-widest block mb-4">Product Story
                 <textarea required minLength={5} value={form.story} onChange={e => setForm({...form, story: e.target.value})} className="mt-2 h-24 w-full border border-border bg-background p-3 text-sm outline-none rounded-sm resize-y" />
               </label>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <label className="text-[10px] font-bold uppercase tracking-widest">Description (EN)
                   <textarea required minLength={5} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="mt-2 h-32 w-full border border-border bg-background p-3 text-sm outline-none rounded-sm resize-y" />
                 </label>
                 <label className="text-[10px] font-bold uppercase tracking-widest font-arabic text-right">Description (AR)
                   <textarea required minLength={5} value={form.descriptionAr} onChange={e => setForm({...form, descriptionAr: e.target.value})} dir="rtl" className="mt-2 h-32 w-full border border-border bg-background p-3 text-sm outline-none rounded-sm resize-y font-arabic" />
                 </label>
               </div>
            </div>

            {/* Variants */}
            <div className="p-6 border border-border rounded-sm bg-card/30 mb-12">
               <div className="mb-6 flex items-center justify-between border-b border-border pb-2">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Variants</h3>
                 <button type="button" onClick={() => setForm({...form, variants: [...form.variants, { id: null, sku: '', colorName: '', colorHex: '#000000', size: 'M', price: null, compareAtPrice: null, stock: 0, chestMm: null, lengthMm: null, shouldersMm: null, sleevesMm: null, media: [], active: true }]})} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-accent hover:text-foreground">
                   <Plus size={14} /> Add Variant
                 </button>
               </div>
               
               <div className="flex flex-col gap-4">
                 {form.variants.map((v, idx) => (
                   <div key={idx} className={`border p-4 bg-background rounded-sm ${!v.active ? 'border-muted opacity-60' : 'border-border'}`}>
                     <div className="flex justify-between items-center mb-4">
                       <div className="flex items-center gap-4">
                         <h4 className="text-[10px] font-bold uppercase tracking-widest">Variant {idx + 1}</h4>
                         <label className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 cursor-pointer">
                           <input type="checkbox" checked={v.active} onChange={e => { const nv = [...form.variants]; nv[idx].active = e.target.checked; setForm({...form, variants: nv})}} className="h-3 w-3 accent-foreground" />
                           Active
                         </label>
                       </div>
                       <button aria-label="Remove variant" type="button" onClick={() => setForm({...form, variants: form.variants.filter((_, i) => i !== idx)})} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                     </div>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                       <label className="text-[10px] font-bold uppercase tracking-widest">SKU<input required value={v.sku} onChange={e => { const nv = [...form.variants]; nv[idx].sku = e.target.value; setForm({...form, variants: nv})}} className="mt-1 h-8 w-full border border-border bg-background px-2 text-xs outline-none rounded-sm" /></label>
                       <label className="text-[10px] font-bold uppercase tracking-widest">Size<input required value={v.size} onChange={e => { const nv = [...form.variants]; nv[idx].size = e.target.value; setForm({...form, variants: nv})}} className="mt-1 h-8 w-full border border-border bg-background px-2 text-xs outline-none rounded-sm" /></label>
                       <label className="text-[10px] font-bold uppercase tracking-widest">Color Name<input required value={v.colorName} onChange={e => { const nv = [...form.variants]; nv[idx].colorName = e.target.value; setForm({...form, variants: nv})}} className="mt-1 h-8 w-full border border-border bg-background px-2 text-xs outline-none rounded-sm" /></label>
                       <label className="text-[10px] font-bold uppercase tracking-widest">Color Hex
                         <div className="flex items-center gap-1 mt-1">
                           <input type="color" value={v.colorHex} onChange={e => { const nv = [...form.variants]; nv[idx].colorHex = e.target.value; setForm({...form, variants: nv})}} className="h-8 w-8 cursor-pointer rounded-sm" />
                           <input required pattern="^#[0-9A-Fa-f]{6}$" title="Valid hex color (e.g., #000000)" value={v.colorHex} onChange={e => { const nv = [...form.variants]; nv[idx].colorHex = e.target.value; setForm({...form, variants: nv})}} className="h-8 flex-1 border border-border bg-background px-2 text-xs outline-none rounded-sm font-mono uppercase" />
                         </div>
                       </label>
                     </div>
                     <div className="grid grid-cols-3 gap-4 mb-4 border-t border-border pt-4">
                       <label className="text-[10px] font-bold uppercase tracking-widest">Stock<input required type="number" min={0} value={v.stock} onChange={e => { const nv = [...form.variants]; nv[idx].stock = Number(e.target.value); setForm({...form, variants: nv})}} className="mt-1 h-8 w-full border border-border bg-background px-2 text-xs outline-none rounded-sm" /></label>
                       <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Price Override<input type="number" min={0} step={0.01} value={v.price || ''} onChange={e => { const nv = [...form.variants]; nv[idx].price = e.target.value ? Number(e.target.value) : null; setForm({...form, variants: nv})}} placeholder="Use main price" className="mt-1 h-8 w-full border border-border bg-background px-2 text-xs outline-none rounded-sm" /></label>
                       <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Compare At<input type="number" min={0} step={0.01} value={v.compareAtPrice || ''} onChange={e => { const nv = [...form.variants]; nv[idx].compareAtPrice = e.target.value ? Number(e.target.value) : null; setForm({...form, variants: nv})}} placeholder="Optional" className="mt-1 h-8 w-full border border-border bg-background px-2 text-xs outline-none rounded-sm" /></label>
                     </div>
                     <div className="grid grid-cols-4 gap-4 border-t border-border pt-4">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Chest (mm)<input type="number" min={0} value={v.chestMm || ''} onChange={e => { const nv = [...form.variants]; nv[idx].chestMm = e.target.value ? Number(e.target.value) : null; setForm({...form, variants: nv})}} className="mt-1 h-8 w-full border border-border bg-background px-2 text-xs outline-none rounded-sm" /></label>
                       <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Length (mm)<input type="number" min={0} value={v.lengthMm || ''} onChange={e => { const nv = [...form.variants]; nv[idx].lengthMm = e.target.value ? Number(e.target.value) : null; setForm({...form, variants: nv})}} className="mt-1 h-8 w-full border border-border bg-background px-2 text-xs outline-none rounded-sm" /></label>
                       <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Shoulders (mm)<input type="number" min={0} value={v.shouldersMm || ''} onChange={e => { const nv = [...form.variants]; nv[idx].shouldersMm = e.target.value ? Number(e.target.value) : null; setForm({...form, variants: nv})}} className="mt-1 h-8 w-full border border-border bg-background px-2 text-xs outline-none rounded-sm" /></label>
                       <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sleeves (mm)<input type="number" min={0} value={v.sleevesMm || ''} onChange={e => { const nv = [...form.variants]; nv[idx].sleevesMm = e.target.value ? Number(e.target.value) : null; setForm({...form, variants: nv})}} className="mt-1 h-8 w-full border border-border bg-background px-2 text-xs outline-none rounded-sm" /></label>
                     </div>
                   </div>
                 ))}
                 {form.variants.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-sm">No variants added. A product needs at least one variant to be sellable.</p>}
               </div>
            </div>

          </div>
        </form>
      </div>
    )
  }

  const filtered = products?.filter(p => search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.slug.toLowerCase().includes(search.toLowerCase())) || [];

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
        <h2 className="text-sm font-bold uppercase tracking-[.18em]">Catalog</h2>
        <button onClick={handleCreateNew} className="flex items-center gap-2 bg-foreground text-background px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-accent rounded-sm">
          <Plus size={14} /> New Product
        </button>
      </header>

      <div className="flex items-center gap-4 border-b border-border p-6 bg-card/50">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            aria-label="Search catalog"
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search catalog..." 
            className="h-9 w-full border border-border bg-background pl-9 pr-3 text-xs outline-none focus:border-accent rounded-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-background p-6">
        {isLoading ? (
           <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : isProductsError ? (
           <div className="flex justify-center py-12 text-sm text-destructive"><AlertCircle className="mr-2" size={16} /> Error loading catalog.</div>
        ) : (
          <div className="border border-border rounded-sm bg-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted border-b border-border uppercase text-[10px] tracking-widest text-muted-foreground">
                <tr>
                  <th className="p-3 w-16">Image</th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Stock</th>
                  <th className="p-3">Price</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(product => (
                  <tr key={product.id} className="hover:bg-muted/50">
                    <td className="p-3">
                      <div className="h-12 w-9 rounded-sm border border-border overflow-hidden bg-muted">
                        {product.image && <img src={product.image} alt={product.name} className="w-full h-full object-cover" />}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold">{product.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{product.category} • {product.variants.length} variants</div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded-sm ${product.status === 'active' ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'}`}>
                        {product.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono">{product.stock}</td>
                    <td className="p-3 font-mono font-medium">{money(product.price)}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button aria-label={`Edit ${product.name}`} onClick={() => handleEdit(product)} className="p-1.5 text-muted-foreground hover:text-foreground"><Edit2 size={16}/></button>
                        <button aria-label={`Delete ${product.name}`} onClick={() => setIsDeleting(product.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No products found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog.Root open={isDeleting !== null} onOpenChange={(o) => !o && setIsDeleting(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 border border-border bg-background p-6 shadow-xl z-50">
            <Dialog.Title className="text-lg font-bold uppercase tracking-widest mb-2">Delete Product?</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground mb-6">
              This action cannot be undone. This will permanently remove the product and all its variants from the store.
            </Dialog.Description>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground" onClick={() => setIsDeleting(null)}>Cancel</button>
              <button className="bg-destructive text-destructive-foreground px-4 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90" onClick={() => isDeleting && handleDelete(isDeleting)}>Delete</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

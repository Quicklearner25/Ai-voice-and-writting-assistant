import { Barcode, Edit3, Filter, ImagePlus, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { assetUrl, productsApi } from "../services/api";
import { apiError, currency, decimal, shortDate } from "../utils/format";

const emptyProduct = {
  product_code: "",
  name: "",
  category: "Gold",
  weight: "",
  purity: "22K",
  stone_details: "",
  making_charges: "",
  gst_percentage: 3,
  purchase_price: "",
  selling_price: "",
  barcode: "",
  stock_quantity: 0,
  low_stock_threshold: 5,
  description: "",
  image: null,
};

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(["Gold", "Silver", "Diamond", "Platinum"]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: "", category: "", low_stock: false, page: 1 });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [preview, setPreview] = useState("");
  const { hasRole } = useAuth();
  const toast = useToast();
  const canManage = hasRole("admin", "accountant");

  const loadProducts = async () => {
    setLoading(true);
    try {
      const [productData, categoryData] = await Promise.all([
        productsApi.list({ ...filters, per_page: 10 }),
        productsApi.categories(),
      ]);
      setProducts(productData.items);
      setPagination(productData.pagination);
      setCategories(categoryData.map((category) => category.name));
    } catch (error) {
      toast.push(apiError(error, "Unable to load products"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [filters.page, filters.category, filters.low_stock, filters.search]);

  const applySearch = (event) => {
    event.preventDefault();
    setFilters((current) => ({ ...current, page: 1, search: event.currentTarget.search.value }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyProduct);
    setPreview("");
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      ...emptyProduct,
      ...product,
      category: product.category || "Gold",
      image: null,
    });
    setPreview(assetUrl(product.image_path));
    setModalOpen(true);
  };

  const imagePreview = useMemo(() => preview, [preview]);

  const submitProduct = async (event) => {
    event.preventDefault();
    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== null && value !== undefined) payload.append(key, value);
    });
    try {
      if (editing) {
        await productsApi.update(editing.id, payload);
        toast.push("Product updated");
      } else {
        await productsApi.create(payload);
        toast.push("Product created");
      }
      setModalOpen(false);
      loadProducts();
    } catch (error) {
      toast.push(apiError(error, "Unable to save product"), "error");
    }
  };

  const removeProduct = async (product) => {
    if (!window.confirm(`Delete ${product.name}?`)) return;
    try {
      await productsApi.remove(product.id);
      toast.push("Product deleted");
      loadProducts();
    } catch (error) {
      toast.push(apiError(error, "Unable to delete product"), "error");
    }
  };

  const searchBarcode = async (event) => {
    event.preventDefault();
    const barcode = event.currentTarget.barcode.value.trim();
    if (!barcode) return;
    try {
      const product = await productsApi.byBarcode(barcode);
      setProducts([product]);
      setPagination({ page: 1, pages: 1, total: 1 });
    } catch (error) {
      toast.push(apiError(error, "Barcode not found"), "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-100">Inventory master</p>
          <h2 className="text-2xl font-black text-slate-950 dark:text-white">Product / Jewellery Management</h2>
        </div>
        {canManage && (
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={18} /> Add Product
          </button>
        )}
      </div>

      <section className="panel p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_240px_180px_1fr]">
          <form onSubmit={applySearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input name="search" className="input pl-10" defaultValue={filters.search} placeholder="Search by name, product ID, barcode" />
          </form>
          <select className="input" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value, page: 1 }))}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700">
            <input type="checkbox" checked={filters.low_stock} onChange={(event) => setFilters((current) => ({ ...current, low_stock: event.target.checked, page: 1 }))} />
            Low stock
          </label>
          <form onSubmit={searchBarcode} className="relative">
            <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input name="barcode" className="input pl-10" placeholder="Scan or enter barcode" />
          </form>
        </div>
      </section>

      <section className="panel overflow-hidden">
        {loading ? (
          <div className="p-6"><Spinner label="Loading products" /></div>
        ) : products.length === 0 ? (
          <div className="p-6"><EmptyState title="No products found" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Weight</th>
                  <th className="px-5 py-3">Purity</th>
                  <th className="px-5 py-3">Stock</th>
                  <th className="px-5 py-3">Selling</th>
                  <th className="px-5 py-3">GST</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                          {product.image_path ? <img className="h-full w-full object-cover" src={assetUrl(product.image_path)} alt={product.name} /> : <div className="flex h-full items-center justify-center"><ImagePlus size={18} /></div>}
                        </div>
                        <div>
                          <p className="font-bold text-slate-950 dark:text-white">{product.name}</p>
                          <p className="text-xs text-slate-500">{product.product_code} · {product.barcode || "No barcode"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">{product.category}</td>
                    <td className="px-5 py-3">{decimal(product.weight, 3)} g</td>
                    <td className="px-5 py-3">{product.purity}</td>
                    <td className="px-5 py-3">
                      <Badge tone={product.low_stock ? "red" : "green"}>{product.stock_quantity}</Badge>
                    </td>
                    <td className="px-5 py-3 font-bold">{currency(product.selling_price)}</td>
                    <td className="px-5 py-3">{decimal(product.gst_percentage)}%</td>
                    <td className="px-5 py-3 text-slate-500">{shortDate(product.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        {canManage && (
                          <>
                            <button type="button" className="btn-muted h-9 w-9 p-0" onClick={() => openEdit(product)} aria-label="Edit product">
                              <Edit3 size={16} />
                            </button>
                            <button type="button" className="btn-muted h-9 w-9 p-0 text-red-600" onClick={() => removeProduct(product)} aria-label="Delete product">
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-col justify-between gap-3 border-t border-slate-200 p-4 text-sm dark:border-slate-800 sm:flex-row sm:items-center">
          <span className="text-slate-500">{pagination.total || 0} products</span>
          <div className="flex gap-2">
            <button className="btn-muted" disabled={!pagination.has_prev} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
            <button className="btn-muted" disabled={!pagination.has_next} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
          </div>
        </div>
      </section>

      <Modal open={modalOpen} title={editing ? "Edit Product" : "Add Product"} onClose={() => setModalOpen(false)} wide>
        <form onSubmit={submitProduct} className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product ID"><input className="input" value={form.product_code} onChange={(event) => setForm({ ...form, product_code: event.target.value })} placeholder="Auto generated if empty" /></Field>
              <Field label="Product Name"><input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
              <Field label="Category">
                <select className="input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </Field>
              <Field label="Purity"><input className="input" value={form.purity} onChange={(event) => setForm({ ...form, purity: event.target.value })} required /></Field>
              <Field label="Weight (g)"><input className="input" type="number" step="0.001" value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} /></Field>
              <Field label="Stone Details"><input className="input" value={form.stone_details || ""} onChange={(event) => setForm({ ...form, stone_details: event.target.value })} /></Field>
              <Field label="Making Charges"><input className="input" type="number" value={form.making_charges} onChange={(event) => setForm({ ...form, making_charges: event.target.value })} /></Field>
              <Field label="GST %"><input className="input" type="number" step="0.01" value={form.gst_percentage} onChange={(event) => setForm({ ...form, gst_percentage: event.target.value })} /></Field>
              <Field label="Purchase Price"><input className="input" type="number" value={form.purchase_price} onChange={(event) => setForm({ ...form, purchase_price: event.target.value })} /></Field>
              <Field label="Selling Price"><input className="input" type="number" value={form.selling_price} onChange={(event) => setForm({ ...form, selling_price: event.target.value })} required /></Field>
              <Field label="Barcode"><input className="input" value={form.barcode || ""} onChange={(event) => setForm({ ...form, barcode: event.target.value })} /></Field>
              <Field label="Stock Quantity"><input className="input" type="number" value={form.stock_quantity} onChange={(event) => setForm({ ...form, stock_quantity: event.target.value })} /></Field>
              <Field label="Low Stock Alert"><input className="input" type="number" value={form.low_stock_threshold} onChange={(event) => setForm({ ...form, low_stock_threshold: event.target.value })} /></Field>
              <Field label="Description"><textarea className="input min-h-24" value={form.description || ""} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            </div>
          </div>
          <div>
            <label className="label">Product Image</label>
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950">
              {imagePreview ? <img src={imagePreview} alt="Preview" className="h-full w-full rounded-lg object-cover" /> : <><ImagePlus size={28} /> Upload image</>}
              <input
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setForm({ ...form, image: file || null });
                  setPreview(file ? URL.createObjectURL(file) : "");
                }}
              />
            </label>
            <div className="mt-6 flex gap-3">
              <button type="submit" className="btn-primary flex-1">{editing ? "Save Changes" : "Create Product"}</button>
              <button type="button" className="btn-muted" onClick={() => setModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const Field = ({ label, children }) => (
  <label>
    <span className="label">{label}</span>
    {children}
  </label>
);

export default Products;

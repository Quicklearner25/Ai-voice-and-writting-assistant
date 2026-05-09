import { AlertTriangle, Boxes, MinusCircle, PlusCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { useToast } from "../context/ToastContext";
import { inventoryApi, productsApi } from "../services/api";
import { apiError, shortDateTime } from "../utils/format";

const Inventory = () => {
  const [logs, setLogs] = useState([]);
  const [products, setProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ product_id: "", change_quantity: 1, reason: "" });
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [logsData, productData, lowData] = await Promise.all([
        inventoryApi.logs({ per_page: 12 }),
        productsApi.list({ per_page: 100 }),
        productsApi.list({ low_stock: true, per_page: 20 }),
      ]);
      setLogs(logsData.items);
      setPagination(logsData.pagination);
      setProducts(productData.items);
      setLowStock(lowData.items);
    } catch (error) {
      toast.push(apiError(error, "Unable to load inventory"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitAdjustment = async (type) => {
    if (!form.product_id) {
      toast.push("Select a product", "error");
      return;
    }
    try {
      if (type === "damaged") {
        await inventoryApi.damaged({ product_id: form.product_id, quantity: Math.abs(Number(form.change_quantity)), reason: form.reason });
      } else {
        await inventoryApi.adjust({ ...form, type: "adjustment" });
      }
      toast.push(type === "damaged" ? "Damaged stock recorded" : "Stock adjusted");
      setForm({ product_id: "", change_quantity: 1, reason: "" });
      load();
    } catch (error) {
      toast.push(apiError(error, "Unable to update stock"), "error");
    }
  };

  if (loading) return <Spinner label="Loading stock data" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-100">Stock control</p>
          <h2 className="text-2xl font-black text-slate-950 dark:text-white">Inventory & Stock Management</h2>
        </div>
        <button type="button" className="btn-muted" onClick={load}>
          <RefreshCw size={18} /> Refresh
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        <section className="space-y-6">
          <div className="panel p-5">
            <h3 className="flex items-center gap-2 font-bold text-slate-950 dark:text-white">
              <Boxes size={18} /> Manual Stock Adjustment
            </h3>
            <div className="mt-4 grid gap-4">
              <label>
                <span className="label">Product</span>
                <select className="input" value={form.product_id} onChange={(event) => setForm({ ...form, product_id: event.target.value })}>
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · Current {product.stock_quantity}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Quantity Change</span>
                <input className="input" type="number" value={form.change_quantity} onChange={(event) => setForm({ ...form, change_quantity: event.target.value })} />
              </label>
              <label>
                <span className="label">Reason</span>
                <textarea className="input min-h-24" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" className="btn-primary" onClick={() => submitAdjustment("adjustment")}>
                  <PlusCircle size={18} /> Apply
                </button>
                <button type="button" className="btn-muted text-red-600" onClick={() => submitAdjustment("damaged")}>
                  <MinusCircle size={18} /> Damaged
                </button>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <h3 className="flex items-center gap-2 font-bold text-slate-950 dark:text-white">
              <AlertTriangle size={18} /> Low Inventory Notifications
            </h3>
            <div className="mt-4 space-y-3">
              {lowStock.length === 0 ? (
                <EmptyState title="No low stock alerts" message="All products are above their alert threshold." />
              ) : (
                lowStock.map((product) => (
                  <div key={product.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <div>
                      <p className="font-bold">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.product_code}</p>
                    </div>
                    <Badge tone="red">{product.stock_quantity} left</Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h3 className="font-bold text-slate-950 dark:text-white">Product Movement Logs</h3>
            <p className="text-sm text-slate-500">Stock in/out, sales deductions, damaged entries, and adjustments</p>
          </div>
          {logs.length === 0 ? (
            <div className="p-6"><EmptyState title="No movement logs yet" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Change</th>
                    <th className="px-5 py-3">Before</th>
                    <th className="px-5 py-3">After</th>
                    <th className="px-5 py-3">Reason</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-5 py-3 font-bold">{log.product?.name}</td>
                      <td className="px-5 py-3 capitalize">{log.log_type?.replace("_", " ")}</td>
                      <td className="px-5 py-3">
                        <Badge tone={log.change_quantity < 0 ? "red" : "green"}>{log.change_quantity}</Badge>
                      </td>
                      <td className="px-5 py-3">{log.previous_stock}</td>
                      <td className="px-5 py-3">{log.new_stock}</td>
                      <td className="px-5 py-3 text-slate-500">{log.reason}</td>
                      <td className="px-5 py-3 text-slate-500">{shortDateTime(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800">
            {pagination.total || 0} movement entries
          </div>
        </section>
      </div>
    </div>
  );
};

export default Inventory;

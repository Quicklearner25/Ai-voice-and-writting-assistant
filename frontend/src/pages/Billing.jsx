import { Barcode, Download, Plus, Printer, ReceiptText, Share2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { useToast } from "../context/ToastContext";
import { customersApi, dashboardApi, downloadAuthenticated, printAuthenticatedPdf, productsApi, salesApi } from "../services/api";
import { apiError, currency, decimal } from "../utils/format";

const Billing = () => {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [payments, setPayments] = useState([{ method: "cash", amount: "", transaction_ref: "" }]);
  const [goldRate, setGoldRate] = useState(null);
  const [summary, setSummary] = useState(null);
  const [lastSale, setLastSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [customerData, productData, rateData, daily] = await Promise.all([
        customersApi.list({ per_page: 100 }),
        productsApi.list({ per_page: 100 }),
        dashboardApi.goldRate(),
        salesApi.summary(),
      ]);
      setCustomers(customerData.items);
      setProducts(productData.items.filter((product) => product.stock_quantity > 0));
      setGoldRate(rateData);
      setSummary(daily);
    } catch (error) {
      toast.push(apiError(error, "Unable to load billing data"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedCustomer = customers.find((customer) => String(customer.id) === String(customerId));

  const totals = useMemo(() => {
    const lineData = items.map((item) => {
      const base = (Number(item.selling_price) + Number(item.making_charges || 0)) * Number(item.quantity);
      const itemDiscount = Number(item.discount_amount || 0);
      const taxable = Math.max(base - itemDiscount, 0);
      const gst = (taxable * Number(item.gst_percentage || 0)) / 100;
      return { ...item, lineSubtotal: base, gst, lineTotal: taxable + gst };
    });
    const subtotal = lineData.reduce((sum, item) => sum + item.lineSubtotal, 0);
    const gst = lineData.reduce((sum, item) => sum + item.gst, 0);
    const gross = lineData.reduce((sum, item) => sum + item.lineTotal, 0);
    const total = Math.max(gross - Number(discount || 0), 0);
    const paid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return { lineData, subtotal, gst, total, paid, due: Math.max(total - paid, 0) };
  }, [items, discount, payments]);

  useEffect(() => {
    if (totals.total && payments.length === 1 && payments[0].amount === "") {
      setPayments([{ ...payments[0], amount: totals.total.toFixed(2) }]);
    }
  }, [totals.total]);

  const addProduct = (product) => {
    if (!product) return;
    const existing = items.find((item) => item.product_id === product.id);
    if (existing) {
      setItems((current) =>
        current.map((item) => (item.product_id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock_quantity) } : item)),
      );
    } else {
      setItems((current) => [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          purity: product.purity,
          weight: product.weight,
          selling_price: product.selling_price,
          making_charges: product.making_charges,
          gst_percentage: product.gst_percentage,
          stock_quantity: product.stock_quantity,
          quantity: 1,
          discount_amount: 0,
        },
      ]);
    }
    setSelectedProductId("");
  };

  const addByBarcode = async (event) => {
    event.preventDefault();
    const barcode = event.currentTarget.barcode.value.trim();
    if (!barcode) return;
    try {
      const product = await productsApi.byBarcode(barcode);
      addProduct(product);
      event.currentTarget.reset();
    } catch (error) {
      toast.push(apiError(error, "Barcode not found"), "error");
    }
  };

  const submitSale = async () => {
    if (!customerId) {
      toast.push("Select a customer before billing", "error");
      return;
    }
    if (!items.length) {
      toast.push("Add at least one product", "error");
      return;
    }
    setSaving(true);
    try {
      const sale = await salesApi.create({
        customer_id: customerId,
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          discount_amount: item.discount_amount,
        })),
        discount_amount: discount,
        payments: payments.map((payment) => ({ ...payment, amount: payment.amount || 0 })),
        gold_rate: goldRate?.rate_24k || 0,
      });
      setLastSale(sale);
      toast.push(`Invoice ${sale.invoice_no} created`);
      setItems([]);
      setDiscount(0);
      setPayments([{ method: "cash", amount: "", transaction_ref: "" }]);
      load();
    } catch (error) {
      toast.push(apiError(error, "Unable to create sale"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading billing module" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-100">Sales counter</p>
          <h2 className="text-2xl font-black text-slate-950 dark:text-white">Sales & Billing</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="blue">24K Gold: {currency(goldRate?.rate_24k)} / g</Badge>
          <Badge tone="green">Today: {currency(summary?.total_sales)} · {summary?.transactions || 0} bills</Badge>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <section className="space-y-6">
          <div className="panel p-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <label>
                <span className="label">Customer</span>
                <select className="input" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} · {customer.phone}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
                <p className="text-sm font-semibold text-slate-500">Customer Snapshot</p>
                <p className="mt-1 font-bold">{selectedCustomer?.name || "No customer selected"}</p>
                <p className="text-sm text-slate-500">Due: {currency(selectedCustomer?.due_amount)}</p>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
              <div className="flex gap-3">
                <select className="input" value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
                  <option value="">Select jewellery product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · {currency(product.selling_price)} · Stock {product.stock_quantity}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn-primary" onClick={() => addProduct(products.find((product) => String(product.id) === String(selectedProductId)))}>
                  <Plus size={18} /> Add
                </button>
              </div>
              <form onSubmit={addByBarcode} className="relative">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input name="barcode" className="input pl-10" placeholder="Scan barcode" />
              </form>
            </div>
          </div>

          <div className="panel overflow-hidden">
            {items.length === 0 ? (
              <div className="p-6"><EmptyState title="No items in this bill" message="Select jewellery or scan barcode to start billing." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="table-head">
                    <tr>
                      <th className="px-5 py-3">Product</th>
                      <th className="px-5 py-3">Qty</th>
                      <th className="px-5 py-3">Weight</th>
                      <th className="px-5 py-3">Rate</th>
                      <th className="px-5 py-3">Making</th>
                      <th className="px-5 py-3">Discount</th>
                      <th className="px-5 py-3">GST</th>
                      <th className="px-5 py-3">Total</th>
                      <th className="px-5 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {totals.lineData.map((item) => (
                      <tr key={item.product_id}>
                        <td className="px-5 py-3">
                          <p className="font-bold">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.purity} · Stock {item.stock_quantity}</p>
                        </td>
                        <td className="px-5 py-3">
                          <input
                            className="input w-24"
                            type="number"
                            min="1"
                            max={item.stock_quantity}
                            value={item.quantity}
                            onChange={(event) => setItems((current) => current.map((row) => (row.product_id === item.product_id ? { ...row, quantity: Number(event.target.value) } : row)))}
                          />
                        </td>
                        <td className="px-5 py-3">{decimal(item.weight, 3)} g</td>
                        <td className="px-5 py-3">{currency(item.selling_price)}</td>
                        <td className="px-5 py-3">{currency(item.making_charges)}</td>
                        <td className="px-5 py-3">
                          <input
                            className="input w-28"
                            type="number"
                            min="0"
                            value={item.discount_amount}
                            onChange={(event) => setItems((current) => current.map((row) => (row.product_id === item.product_id ? { ...row, discount_amount: event.target.value } : row)))}
                          />
                        </td>
                        <td className="px-5 py-3">{currency(item.gst)}</td>
                        <td className="px-5 py-3 font-bold">{currency(item.lineTotal)}</td>
                        <td className="px-5 py-3">
                          <button type="button" className="btn-muted h-9 w-9 p-0 text-red-600" onClick={() => setItems((current) => current.filter((row) => row.product_id !== item.product_id))} aria-label="Remove item">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="panel p-5">
            <h3 className="font-bold text-slate-950 dark:text-white">Payment</h3>
            <div className="mt-4 space-y-3">
              {payments.map((payment, index) => (
                <div key={index} className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <select
                    className="input"
                    value={payment.method}
                    onChange={(event) => setPayments((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, method: event.target.value } : row)))}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / QR</option>
                    <option value="card">Card</option>
                  </select>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="Amount"
                    value={payment.amount}
                    onChange={(event) => setPayments((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, amount: event.target.value } : row)))}
                  />
                  <input
                    className="input"
                    placeholder="Transaction reference"
                    value={payment.transaction_ref}
                    onChange={(event) => setPayments((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, transaction_ref: event.target.value } : row)))}
                  />
                </div>
              ))}
              <button type="button" className="btn-muted w-full" onClick={() => setPayments((current) => [...current, { method: "upi", amount: "", transaction_ref: "" }])}>
                <Plus size={16} /> Split Payment
              </button>
            </div>
          </section>

          <section className="panel p-5">
            <h3 className="font-bold text-slate-950 dark:text-white">Invoice Summary</h3>
            <div className="mt-4 space-y-3 text-sm">
              <SummaryRow label="Subtotal" value={currency(totals.subtotal)} />
              <SummaryRow label="GST" value={currency(totals.gst)} />
              <div>
                <label className="label">Bill Discount</label>
                <input className="input" type="number" min="0" value={discount} onChange={(event) => setDiscount(event.target.value)} />
              </div>
              <SummaryRow label="Grand Total" value={currency(totals.total)} strong />
              <SummaryRow label="Paid" value={currency(totals.paid)} />
              <SummaryRow label="Due" value={currency(totals.due)} warning={totals.due > 0} />
            </div>
            <button type="button" className="btn-primary mt-5 w-full" onClick={submitSale} disabled={saving}>
              <ReceiptText size={18} /> {saving ? "Creating Invoice..." : "Create Bill"}
            </button>
          </section>

          {lastSale && (
            <section className="panel p-5">
              <h3 className="font-bold text-slate-950 dark:text-white">Invoice Ready</h3>
              <p className="mt-1 text-sm text-slate-500">{lastSale.invoice_no}</p>
              <div className="mt-4 grid gap-2">
                <button type="button" className="btn-muted" onClick={() => downloadAuthenticated(salesApi.invoiceUrl(lastSale.id), `${lastSale.invoice_no}.pdf`)}>
                  <Download size={16} /> Download PDF
                </button>
                <button type="button" className="btn-muted" onClick={() => printAuthenticatedPdf(salesApi.invoiceUrl(lastSale.id))}>
                  <Printer size={16} /> Print Invoice
                </button>
                {selectedCustomer?.phone && (
                  <a
                    className="btn-muted"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://wa.me/91${selectedCustomer.phone}?text=${encodeURIComponent(`Invoice ${lastSale.invoice_no} total ${currency(lastSale.total_amount)} is ready. Thank you for shopping with Aurum Jewellery.`)}`}
                  >
                    <Share2 size={16} /> WhatsApp Share
                  </a>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};

const SummaryRow = ({ label, value, strong, warning }) => (
  <div className={`flex items-center justify-between rounded-md px-3 py-2 ${strong ? "bg-slate-900 text-white dark:bg-brand-500" : "bg-slate-50 dark:bg-slate-950"}`}>
    <span className="font-semibold">{label}</span>
    <span className={`font-black ${warning ? "text-red-600 dark:text-red-300" : ""}`}>{value}</span>
  </div>
);

export default Billing;

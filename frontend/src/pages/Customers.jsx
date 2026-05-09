import { Edit3, Eye, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { customersApi } from "../services/api";
import { apiError, currency, shortDate, shortDateTime } from "../utils/format";

const emptyCustomer = { name: "", phone: "", email: "", address: "", due_amount: 0 };

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0 });
  const [filters, setFilters] = useState({ search: "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyCustomer);
  const toast = useToast();
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin", "sales_staff", "accountant");

  const load = async () => {
    setLoading(true);
    try {
      const data = await customersApi.list({ ...filters, per_page: 10 });
      setCustomers(data.items);
      setPagination(data.pagination);
    } catch (error) {
      toast.push(apiError(error, "Unable to load customers"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filters.page, filters.search]);

  const openCreate = () => {
    setSelected(null);
    setForm(emptyCustomer);
    setModalOpen(true);
  };

  const openEdit = (customer) => {
    setSelected(customer);
    setForm({ ...emptyCustomer, ...customer });
    setModalOpen(true);
  };

  const openHistory = async (customer) => {
    try {
      const detail = await customersApi.get(customer.id);
      setSelected(detail);
      setHistoryOpen(true);
    } catch (error) {
      toast.push(apiError(error, "Unable to load history"), "error");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      if (selected) {
        await customersApi.update(selected.id, form);
        toast.push("Customer updated");
      } else {
        await customersApi.create(form);
        toast.push("Customer created");
      }
      setModalOpen(false);
      load();
    } catch (error) {
      toast.push(apiError(error, "Unable to save customer"), "error");
    }
  };

  const remove = async (customer) => {
    if (!window.confirm(`Delete ${customer.name}?`)) return;
    try {
      await customersApi.remove(customer.id);
      toast.push("Customer deleted");
      load();
    } catch (error) {
      toast.push(apiError(error, "Unable to delete customer"), "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-100">CRM</p>
          <h2 className="text-2xl font-black text-slate-950 dark:text-white">Customer Management</h2>
        </div>
        {hasRole("admin", "sales_staff") && (
          <button type="button" className="btn-primary" onClick={openCreate}>
            <UserPlus size={18} /> Add Customer
          </button>
        )}
      </div>

      <section className="panel p-4">
        <form
          className="relative max-w-xl"
          onSubmit={(event) => {
            event.preventDefault();
            setFilters((current) => ({ ...current, page: 1, search: event.currentTarget.search.value }));
          }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input name="search" className="input pl-10" placeholder="Search customers by name, phone, email" />
        </form>
      </section>

      <section className="panel overflow-hidden">
        {loading ? (
          <div className="p-6"><Spinner label="Loading customers" /></div>
        ) : customers.length === 0 ? (
          <div className="p-6"><EmptyState title="No customers found" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Total Spent</th>
                  <th className="px-5 py-3">Pending Dues</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-5 py-3">
                      <p className="font-bold text-slate-950 dark:text-white">{customer.name}</p>
                      <p className="text-xs text-slate-500">{customer.customer_id}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p>{customer.phone}</p>
                      <p className="text-xs text-slate-500">{customer.email || "No email"}</p>
                    </td>
                    <td className="px-5 py-3 font-bold">{currency(customer.total_spent)}</td>
                    <td className="px-5 py-3"><Badge tone={customer.due_amount > 0 ? "red" : "green"}>{currency(customer.due_amount)}</Badge></td>
                    <td className="px-5 py-3 text-slate-500">{shortDate(customer.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button type="button" className="btn-muted h-9 w-9 p-0" onClick={() => openHistory(customer)} aria-label="View history">
                          <Eye size={16} />
                        </button>
                        {canEdit && (
                          <button type="button" className="btn-muted h-9 w-9 p-0" onClick={() => openEdit(customer)} aria-label="Edit customer">
                            <Edit3 size={16} />
                          </button>
                        )}
                        {hasRole("admin") && (
                          <button type="button" className="btn-muted h-9 w-9 p-0 text-red-600" onClick={() => remove(customer)} aria-label="Delete customer">
                            <Trash2 size={16} />
                          </button>
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
          <span className="text-slate-500">{pagination.total || 0} customers</span>
          <div className="flex gap-2">
            <button className="btn-muted" disabled={!pagination.has_prev} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
            <button className="btn-muted" disabled={!pagination.has_next} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
          </div>
        </div>
      </section>

      <Modal open={modalOpen} title={selected ? "Edit Customer" : "Add Customer"} onClose={() => setModalOpen(false)}>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
          <Field label="Phone"><input className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required /></Field>
          <Field label="Email"><input className="input" type="email" value={form.email || ""} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
          <Field label="Due Amount"><input className="input" type="number" value={form.due_amount || 0} onChange={(event) => setForm({ ...form, due_amount: event.target.value })} /></Field>
          <label className="sm:col-span-2">
            <span className="label">Address</span>
            <textarea className="input min-h-24" value={form.address || ""} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          </label>
          <div className="flex gap-3 sm:col-span-2">
            <button type="submit" className="btn-primary">{selected ? "Save Changes" : <><Plus size={18} /> Create Customer</>}</button>
            <button type="button" className="btn-muted" onClick={() => setModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal open={historyOpen} title="Purchase History" onClose={() => setHistoryOpen(false)} wide>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
            <p className="text-sm text-slate-500">Customer</p>
            <p className="font-bold">{selected?.name}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
            <p className="text-sm text-slate-500">Total Spent</p>
            <p className="font-bold">{currency(selected?.total_spent)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
            <p className="text-sm text-slate-500">Pending Dues</p>
            <p className="font-bold">{currency(selected?.due_amount)}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(selected?.purchase_history || []).map((sale) => (
                <tr key={sale.id}>
                  <td className="px-4 py-3 font-bold">{sale.invoice_no}</td>
                  <td className="px-4 py-3">{currency(sale.total_amount)}</td>
                  <td className="px-4 py-3">{currency(sale.paid_amount)}</td>
                  <td className="px-4 py-3">{currency(sale.due_amount)}</td>
                  <td className="px-4 py-3 text-slate-500">{shortDateTime(sale.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

export default Customers;

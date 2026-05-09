import { DatabaseBackup, ShieldCheck, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { useToast } from "../context/ToastContext";
import { adminApi, authApi, downloadAuthenticated } from "../services/api";
import { apiError, shortDateTime } from "../utils/format";

const Settings = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState({ name: "", email: "", password: "", role: "sales_staff" });
  const toast = useToast();

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await adminApi.auditLogs({ per_page: 20 });
      setLogs(data.items);
    } catch (error) {
      toast.push(apiError(error, "Unable to load audit logs"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const createStaff = async (event) => {
    event.preventDefault();
    try {
      await authApi.register(staff);
      toast.push("Staff user created");
      setStaff({ name: "", email: "", password: "", role: "sales_staff" });
      loadLogs();
    } catch (error) {
      toast.push(apiError(error, "Unable to create staff user"), "error");
    }
  };

  const backup = () => {
    downloadAuthenticated(adminApi.backupUrl(), `jewellery-backup-${Date.now()}.json`).catch((error) =>
      toast.push(apiError(error, "Unable to download backup"), "error"),
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-100">Security</p>
        <h2 className="text-2xl font-black text-slate-950 dark:text-white">Admin Settings</h2>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="space-y-6">
          <form onSubmit={createStaff} className="panel p-5">
            <h3 className="flex items-center gap-2 font-bold text-slate-950 dark:text-white">
              <UserPlus size={18} /> Staff Access
            </h3>
            <div className="mt-4 grid gap-4">
              <label><span className="label">Name</span><input className="input" value={staff.name} onChange={(event) => setStaff({ ...staff, name: event.target.value })} required /></label>
              <label><span className="label">Email</span><input className="input" type="email" value={staff.email} onChange={(event) => setStaff({ ...staff, email: event.target.value })} required /></label>
              <label><span className="label">Password</span><input className="input" type="password" value={staff.password} onChange={(event) => setStaff({ ...staff, password: event.target.value })} required /></label>
              <label>
                <span className="label">Role</span>
                <select className="input" value={staff.role} onChange={(event) => setStaff({ ...staff, role: event.target.value })}>
                  <option value="sales_staff">Sales Staff</option>
                  <option value="accountant">Accountant</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <button type="submit" className="btn-primary">Create User</button>
            </div>
          </form>

          <section className="panel p-5">
            <h3 className="flex items-center gap-2 font-bold text-slate-950 dark:text-white">
              <DatabaseBackup size={18} /> Backup & Restore
            </h3>
            <p className="mt-2 text-sm text-slate-500">Download a JSON backup of core business tables. Restore is intentionally disabled by default on the API.</p>
            <button type="button" className="btn-muted mt-4 w-full" onClick={backup}>
              Download Backup
            </button>
          </section>
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h3 className="flex items-center gap-2 font-bold text-slate-950 dark:text-white">
              <ShieldCheck size={18} /> Audit Logs
            </h3>
          </div>
          {loading ? (
            <div className="p-6"><Spinner label="Loading audit trail" /></div>
          ) : logs.length === 0 ? (
            <div className="p-6"><EmptyState title="No audit entries" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Entity</th>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">IP</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-5 py-3"><Badge tone="blue">{log.action}</Badge></td>
                      <td className="px-5 py-3">{log.entity_type} #{log.entity_id || "-"}</td>
                      <td className="px-5 py-3">{log.user?.name || "System"}</td>
                      <td className="px-5 py-3 text-slate-500">{log.ip_address || "-"}</td>
                      <td className="px-5 py-3 text-slate-500">{shortDateTime(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Settings;

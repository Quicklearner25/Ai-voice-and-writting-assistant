import { Gem, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiError } from "../utils/format";

const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "admin@jewellery.local", password: "Admin@12345" });
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await login(form);
      toast.push("Welcome back");
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (error) {
      toast.push(apiError(error, "Unable to login"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-brand-500">
              <Gem size={28} />
            </div>
            <h1 className="text-4xl font-black leading-tight text-slate-950 dark:text-white">Aurum Jewellery Shop Management</h1>
            <p className="mt-5 text-lg text-slate-600 dark:text-slate-300">
              Inventory, billing, GST, invoices, staff roles, reports, and stock movement in one secure operating console.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {["JWT security", "Live billing", "Audit logs"].map((item) => (
                <div key={item} className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
        <form onSubmit={submit} className="panel mx-auto w-full max-w-md p-6 sm:p-8">
          <div className="mb-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-100 lg:hidden">
              <Gem size={24} />
            </div>
            <h2 className="text-2xl font-black text-slate-950 dark:text-white">Secure Login</h2>
            <p className="mt-2 text-sm text-slate-500">Use seeded admin credentials after running the backend seed command.</p>
          </div>
          <label className="label" htmlFor="email">Email</label>
          <div className="relative mb-4">
            <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              id="email"
              className="input pl-10"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </div>
          <label className="label" htmlFor="password">Password</label>
          <div className="relative mb-6">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              id="password"
              className="input pl-10"
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

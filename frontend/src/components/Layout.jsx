import {
  BarChart3,
  Boxes,
  Gem,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ReceiptText,
  ShieldCheck,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Gem },
  { to: "/billing", label: "Billing", icon: ReceiptText },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Admin", icon: ShieldCheck, roles: ["admin"] },
];

const Sidebar = ({ onClose }) => {
  const { user } = useAuth();
  return (
    <aside className="flex h-full w-72 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-brand-500">
            <Gem size={22} />
          </span>
          <div>
            <p className="text-sm font-black uppercase text-slate-950 dark:text-white">Aurum Suite</p>
            <p className="text-xs text-slate-500">Jewellery operations</p>
          </div>
        </div>
        <button type="button" className="rounded-md p-2 lg:hidden" onClick={onClose} aria-label="Close navigation">
          <X size={18} />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems
          .filter((item) => !item.roles || item.roles.includes(user?.role))
          .map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-slate-900 text-white dark:bg-brand-500"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
                  }`
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
      </nav>
      <div className="border-t border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-800">
        <p className="font-semibold text-slate-700 dark:text-slate-300">{user?.name}</p>
        <p className="capitalize">{user?.role?.replace("_", " ")}</p>
      </div>
    </aside>
  );
};

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex">
        <Sidebar />
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-slate-900 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu size={20} />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Management console</p>
              <h1 className="text-base font-bold text-slate-950 dark:text-white">Jewellery Shop Management</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-muted h-10 w-10 p-0" onClick={toggleTheme} aria-label="Toggle color mode">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="hidden rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 sm:block">
              <span className="font-semibold">{user?.name}</span>
            </div>
            <button type="button" className="btn-muted h-10 w-10 p-0" onClick={handleLogout} aria-label="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-64px)] max-w-[1600px] p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

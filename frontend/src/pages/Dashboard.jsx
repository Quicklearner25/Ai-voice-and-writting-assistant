import {
  AlertTriangle,
  Banknote,
  Gem,
  ReceiptText,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { Link } from "react-router-dom";

import Badge from "../components/Badge";
import Spinner from "../components/Spinner";
import StatCard from "../components/StatCard";
import { dashboardApi } from "../services/api";
import { apiError, currency, shortDateTime } from "../utils/format";
import { useToast } from "../context/ToastContext";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [goldRate, setGoldRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    Promise.all([dashboardApi.stats(), dashboardApi.goldRate()])
      .then(([statsData, goldData]) => {
        setStats(statsData);
        setGoldRate(goldData);
      })
      .catch((error) => toast.push(apiError(error, "Unable to load dashboard"), "error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading dashboard" />;

  const cards = stats?.cards || {};
  const chart = stats?.revenue_chart || { labels: [], revenue: [], profit: [], prediction: [] };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { boxWidth: 10 } } },
    scales: { y: { beginAtZero: true } },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-100">Today</p>
          <h2 className="text-2xl font-black text-slate-950 dark:text-white">Operations Dashboard</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/billing" className="btn-primary">
            <ReceiptText size={18} /> New Bill
          </Link>
          <Link to="/products" className="btn-muted">
            <Gem size={18} /> Add Jewellery
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Banknote} label="Sales Today" value={currency(cards.total_sales_today)} helper="Completed invoices" tone="green" />
        <StatCard icon={TrendingUp} label="Monthly Sales" value={currency(cards.monthly_sales)} helper="Current month" tone="blue" />
        <StatCard icon={Gem} label="Products" value={cards.total_products || 0} helper="Active inventory" />
        <StatCard icon={AlertTriangle} label="Low Stock" value={cards.low_stock_alerts || 0} helper="Needs attention" tone="red" />
        <StatCard icon={UserRound} label="Customers" value={cards.customers || 0} helper={`${stats?.customer_statistics?.new_this_month || 0} new this month`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-950 dark:text-white">Revenue and Profit</h3>
              <p className="text-sm text-slate-500">Monthly trend with a short prediction curve</p>
            </div>
            <Badge tone={goldRate?.source === "live" ? "green" : "amber"}>{currency(goldRate?.rate_24k)} / g 24K</Badge>
          </div>
          <div className="h-80">
            <Line
              options={chartOptions}
              data={{
                labels: chart.labels,
                datasets: [
                  { label: "Revenue", data: chart.revenue, borderColor: "#0ea5e9", backgroundColor: "rgba(14,165,233,.15)", tension: 0.35 },
                  { label: "Profit", data: chart.profit, borderColor: "#10b981", backgroundColor: "rgba(16,185,129,.15)", tension: 0.35 },
                  { label: "Prediction", data: [...Array(Math.max(chart.labels.length - chart.prediction.length, 0)).fill(null), ...chart.prediction], borderColor: "#b7791f", borderDash: [6, 5], tension: 0.35 },
                ],
              }}
            />
          </div>
        </section>

        <section className="panel p-5">
          <h3 className="font-bold text-slate-950 dark:text-white">Top-Selling Jewellery</h3>
          <p className="mb-4 text-sm text-slate-500">Products ranked by quantity sold</p>
          <div className="h-80">
            <Bar
              options={chartOptions}
              data={{
                labels: (stats?.top_selling_jewellery || []).map((item) => item.product_name),
                datasets: [
                  {
                    label: "Quantity",
                    data: (stats?.top_selling_jewellery || []).map((item) => item.quantity),
                    backgroundColor: ["#b7791f", "#0ea5e9", "#10b981", "#ef4444", "#64748b"],
                  },
                ],
              }}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h3 className="font-bold text-slate-950 dark:text-white">Recent Transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(stats?.recent_transactions || []).map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-5 py-3 font-semibold">{sale.invoice_no}</td>
                    <td className="px-5 py-3">{sale.customer?.name}</td>
                    <td className="px-5 py-3 capitalize">{sale.payment_method}</td>
                    <td className="px-5 py-3 font-bold">{currency(sale.total_amount)}</td>
                    <td className="px-5 py-3 text-slate-500">{shortDateTime(sale.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel p-5">
          <h3 className="font-bold text-slate-950 dark:text-white">Customer Statistics</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-sm text-slate-500">Customers with dues</p>
              <p className="mt-1 text-2xl font-black">{stats?.customer_statistics?.with_dues || 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-sm text-slate-500">New customers this month</p>
              <p className="mt-1 text-2xl font-black">{stats?.customer_statistics?.new_this_month || 0}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;

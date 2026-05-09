import { Download, FileBarChart, FileSpreadsheet, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { Bar } from "react-chartjs-2";

import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { useToast } from "../context/ToastContext";
import { downloadAuthenticated, reportsApi } from "../services/api";
import { apiError, currency, shortDateTime } from "../utils/format";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const reportTypes = [
  ["daily_sales", "Daily Sales"],
  ["monthly_sales", "Monthly Sales"],
  ["profit", "Profit"],
  ["inventory", "Inventory"],
  ["employee_sales", "Employee Sales"],
  ["customer", "Customer"],
  ["gst", "GST"],
  ["stock_movement", "Stock Movement"],
];

const Reports = () => {
  const today = new Date().toISOString().slice(0, 10);
  const [filters, setFilters] = useState({ type: "daily_sales", start_date: today, end_date: today });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await reportsApi.get(filters);
      setReport(data);
    } catch (error) {
      toast.push(apiError(error, "Unable to load report"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filters.type]);

  const chartData = useMemo(() => {
    const rows = report?.rows || [];
    const key = filters.type === "inventory" ? "stock_quantity" : filters.type === "profit" ? "profit" : filters.type === "gst" ? "gst_amount" : "total_amount";
    return {
      labels: rows.slice(0, 12).map((row) => row.invoice_no || row.name || row.product_code || row.log_type || "Record"),
      values: rows.slice(0, 12).map((row) => Number(row[key] || row.total_sales || row.total_spent || 0)),
    };
  }, [report, filters.type]);

  const exportReport = (format) => {
    downloadAuthenticated(reportsApi.exportUrl({ ...filters, format }), `${filters.type}.${format === "pdf" ? "pdf" : "xlsx"}`).catch((error) =>
      toast.push(apiError(error, "Unable to export report"), "error"),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-100">Analytics</p>
          <h2 className="text-2xl font-black text-slate-950 dark:text-white">Reports & Analytics</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-muted" onClick={() => exportReport("excel")}>
            <FileSpreadsheet size={18} /> Excel
          </button>
          <button type="button" className="btn-muted" onClick={() => exportReport("pdf")}>
            <Download size={18} /> PDF
          </button>
        </div>
      </div>

      <section className="panel p-4">
        <div className="grid gap-3 lg:grid-cols-[260px_180px_180px_auto]">
          <select className="input" value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
            {reportTypes.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input className="input" type="date" value={filters.start_date} onChange={(event) => setFilters((current) => ({ ...current, start_date: event.target.value }))} />
          <input className="input" type="date" value={filters.end_date} onChange={(event) => setFilters((current) => ({ ...current, end_date: event.target.value }))} />
          <button type="button" className="btn-primary" onClick={load}>
            <RefreshCw size={18} /> Generate
          </button>
        </div>
      </section>

      {loading ? (
        <Spinner label="Generating report" />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <section className="panel p-5">
              <h3 className="flex items-center gap-2 font-bold text-slate-950 dark:text-white">
                <FileBarChart size={18} /> {report?.title}
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Object.entries(report?.summary || {}).map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
                    <p className="text-sm font-semibold capitalize text-slate-500">{key.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xl font-black">{typeof value === "number" && key.includes("total") ? currency(value) : value}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel p-5">
              <h3 className="font-bold text-slate-950 dark:text-white">Report Visualization</h3>
              <div className="mt-4 h-72">
                <Bar
                  options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }}
                  data={{
                    labels: chartData.labels,
                    datasets: [{ label: "Value", data: chartData.values, backgroundColor: "#0ea5e9" }],
                  }}
                />
              </div>
            </section>
          </div>

          <section className="panel overflow-hidden">
            {!report?.rows?.length ? (
              <div className="p-6"><EmptyState title="No report rows" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-sm">
                  <thead className="table-head">
                    <tr>
                      {(report.columns || []).map((column) => (
                        <th key={column} className="px-5 py-3">{column.replaceAll("_", " ")}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {report.rows.slice(0, 100).map((row, index) => (
                      <tr key={row.id || row.invoice_no || index}>
                        {(report.columns || []).map((column) => (
                          <td key={column} className="px-5 py-3">{formatCell(row[column])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

const formatCell = (value) => {
  if (value && typeof value === "object") return value.name || value.invoice_no || JSON.stringify(value);
  if (typeof value === "string" && value.includes("T")) return shortDateTime(value);
  if (typeof value === "number" && value > 999) return currency(value);
  return value ?? "-";
};

export default Reports;

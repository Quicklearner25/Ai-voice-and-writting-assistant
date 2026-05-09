import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
export const ASSET_BASE_URL = import.meta.env.VITE_ASSET_BASE_URL || "http://localhost:5000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("jewellery_token");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
    return Promise.reject(error);
  },
);

const unwrap = (response) => response.data.data;

export const assetUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${ASSET_BASE_URL}${path}`;
};

export const authApi = {
  login: (payload) => api.post("/auth/login", payload).then(unwrap),
  register: (payload) => api.post("/auth/register", payload).then(unwrap),
  me: () => api.get("/auth/me").then(unwrap),
  logout: () => api.post("/auth/logout").then(unwrap),
};

export const dashboardApi = {
  stats: () => api.get("/dashboard/stats").then(unwrap),
  goldRate: () => api.get("/dashboard/gold-rate").then(unwrap),
};

export const productsApi = {
  list: (params) => api.get("/products", { params }).then(unwrap),
  categories: () => api.get("/products/categories").then(unwrap),
  create: (payload) =>
    api.post("/products", payload, { headers: { "Content-Type": "multipart/form-data" } }).then(unwrap),
  update: (id, payload) =>
    api.put(`/products/${id}`, payload, { headers: { "Content-Type": "multipart/form-data" } }).then(unwrap),
  remove: (id) => api.delete(`/products/${id}`).then(unwrap),
  byBarcode: (barcode) => api.get(`/products/barcode/${barcode}`).then(unwrap),
};

export const customersApi = {
  list: (params) => api.get("/customers", { params }).then(unwrap),
  create: (payload) => api.post("/customers", payload).then(unwrap),
  update: (id, payload) => api.put(`/customers/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/customers/${id}`).then(unwrap),
  get: (id) => api.get(`/customers/${id}`).then(unwrap),
};

export const salesApi = {
  list: (params) => api.get("/sales", { params }).then(unwrap),
  create: (payload) => api.post("/sales", payload).then(unwrap),
  summary: (params) => api.get("/sales/summary/daily", { params }).then(unwrap),
  invoiceUrl: (id) => `${API_BASE_URL}/sales/${id}/invoice.pdf`,
};

export const inventoryApi = {
  logs: (params) => api.get("/inventory/logs", { params }).then(unwrap),
  adjust: (payload) => api.post("/inventory/adjustments", payload).then(unwrap),
  damaged: (payload) => api.post("/inventory/damaged", payload).then(unwrap),
};

export const reportsApi = {
  get: (params) => api.get("/reports", { params }).then(unwrap),
  exportUrl: (params) => {
    const query = new URLSearchParams(params).toString();
    return `${API_BASE_URL}/reports/export?${query}`;
  },
};

export const adminApi = {
  auditLogs: (params) => api.get("/admin/audit-logs", { params }).then(unwrap),
  backupUrl: () => `${API_BASE_URL}/admin/backup`,
};

export const downloadAuthenticated = async (url, filename) => {
  const response = await axios.get(url, {
    responseType: "blob",
    headers: { Authorization: `Bearer ${localStorage.getItem("jewellery_token")}` },
  });
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
};

export const printAuthenticatedPdf = async (url) => {
  const response = await axios.get(url, {
    responseType: "blob",
    headers: { Authorization: `Bearer ${localStorage.getItem("jewellery_token")}` },
  });
  const objectUrl = URL.createObjectURL(response.data);
  const win = window.open(objectUrl, "_blank");
  if (win) {
    win.addEventListener("load", () => win.print(), { once: true });
  }
};

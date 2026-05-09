export const currency = (value = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export const decimal = (value = 0, digits = 2) => Number(value || 0).toFixed(digits);

export const shortDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");

export const shortDateTime = (value) =>
  value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

export const apiError = (error, fallback = "Request failed") => error.response?.data?.message || error.message || fallback;

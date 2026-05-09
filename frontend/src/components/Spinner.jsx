const Spinner = ({ label = "Loading" }) => (
  <div className="flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-slate-300">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
    {label}
  </div>
);

export default Spinner;

const StatCard = ({ icon: Icon, label, value, helper, tone = "brand" }) => {
  const toneClass =
    tone === "green"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : tone === "red"
        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
        : tone === "blue"
          ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
          : "bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-100";

  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</p>
          {helper && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{helper}</p>}
        </div>
        {Icon && (
          <div className={`rounded-lg p-3 ${toneClass}`}>
            <Icon size={22} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;

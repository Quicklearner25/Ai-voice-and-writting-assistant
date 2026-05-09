import { SearchX } from "lucide-react";

const EmptyState = ({ title = "No records found", message = "Try adjusting your filters." }) => (
  <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
    <SearchX className="text-slate-400" size={32} />
    <div>
      <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
    </div>
  </div>
);

export default EmptyState;

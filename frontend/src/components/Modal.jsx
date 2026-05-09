import { X } from "lucide-react";

const Modal = ({ open, title, children, onClose, wide = false }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4">
      <div className={`max-h-[92vh] w-full overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-900 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <button type="button" className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[calc(92vh-70px)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
};

export default Modal;

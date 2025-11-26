import React, { useEffect } from 'react';

const Toast = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

const ToastItem = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const bgColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500'
  };

  return (
    <div
      className={`${bgColors[toast.type] || bgColors.info} text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between min-w-[300px] animate-slide-in`}
    >
      <span>{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-4 text-white hover:text-gray-200"
      >
        ✕
      </button>
    </div>
  );
};

export default Toast;

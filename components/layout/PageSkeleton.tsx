function Bar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className ?? ""}`} />;
}

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="space-y-2">
        <Bar className="h-6 w-32" />
        <Bar className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Bar key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Bar key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

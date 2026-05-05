"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Droplets, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "登录失败");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Droplets className="h-8 w-8 text-[#E8472A]" />
          <h1 className="text-2xl font-bold">污水处理 SaaS</h1>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4"
        >
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              管理员密码
            </label>
            <input
              id="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8472A]"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#E8472A] px-4 py-2 text-sm font-medium text-white hover:bg-[#D13D22] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "登录中…" : "登录"}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center pt-2">
            通过环境变量 <code className="font-mono">ADMIN_PASSWORD</code> 配置
          </p>
        </form>
      </div>
    </div>
  );
}

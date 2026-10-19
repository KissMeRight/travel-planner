"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";
import SettingsBar from "@/components/SettingsBar";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLang();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { username: username.toLowerCase() } },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (result.error) return setError(result.error.message);
    router.push("/");
  }

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-surface px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-100";

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-surface to-teal-50 p-4">
      <div className="absolute right-3 top-3">
        <SettingsBar />
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-3xl bg-surface p-7 shadow-xl shadow-black/10"
      >
        <div className="text-center">
          <div className="text-4xl">✈️</div>
          <h1 className="mt-2 text-2xl font-bold text-slate-800">{t("appName")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("tagline")}</p>
        </div>

        <div className="flex rounded-xl bg-slate-100 p-1">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === m
                  ? "bg-surface text-teal-700 shadow"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t(m)}
            </button>
          ))}
        </div>

        {mode === "signup" && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              {t("username")}
            </span>
            <input
              className={inputClass}
              placeholder={t("usernamePh")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <span className="mt-1 block text-xs text-slate-500">{t("usernameHint")}</span>
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">{t("email")}</span>
          <input
            className={inputClass}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">{t("password")}</span>
          <input
            className={inputClass}
            type="password"
            placeholder={t("passwordPh")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          disabled={loading}
          className="w-full rounded-xl bg-teal-600 py-3 font-semibold text-white shadow-md shadow-teal-200 transition hover:bg-teal-500 disabled:opacity-50"
        >
          {loading ? t("wait") : mode === "login" ? t("login") : t("createAccount")}
        </button>
      </form>
    </main>
  );
}
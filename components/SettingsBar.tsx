"use client";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";

export default function SettingsBar() {
  const { lang, setLang, t } = useLang();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  const btn =
    "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100";

  return (
    <div className="flex items-center">
      <button
        onClick={() => setLang(lang === "th" ? "en" : "th")}
        className={btn}
        aria-label={t("switchLang")}
      >
        {lang === "th" ? "EN" : "ไทย"}
      </button>
      <button onClick={toggleTheme} className={btn} aria-label={t("switchTheme")}>
        {dark ? "☀️" : "🌙"}
      </button>
    </div>
  );
}
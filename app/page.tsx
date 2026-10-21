"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";
import SettingsBar from "@/components/SettingsBar";

type Trip = {
  id: string;
  title: string;
  start_date: string | null;
  owner_id: string;
  trip_members: { count: number }[];
  stops: { cost: number | null }[];
};

type Invite = {
  invite_id: string;
  trip_id: string;
  trip_title: string;
  inviter_username: string;
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-surface px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-100";

export default function HomePage() {
  const router = useRouter();
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busyInvite, setBusyInvite] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function formatDate(d: string | null) {
    if (!d) return t("noDate");
    return new Date(d + "T00:00:00").toLocaleDateString(
      lang === "th" ? "th-TH" : "en-GB",
      { day: "numeric", month: "short", year: "numeric" }
    );
  }

  const loadTrips = useCallback(async () => {
    const { data, error } = await supabase
      .from("trips")
      .select("id, title, start_date, owner_id, trip_members(count), stops(cost)")
      .order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
      return;
    }
    setTrips((data ?? []) as unknown as Trip[]);
  }, []);

  const loadInvites = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_invites");
    setInvites((data ?? []) as Invite[]);
  }, []);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }
      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", session.user.id)
        .single();

      setUsername(profile?.username ?? "");
      await Promise.all([loadTrips(), loadInvites()]);
      setLoading(false);
    }
    init();
  }, [router, loadTrips, loadInvites]);

  // สำรอง: โหลดคำเชิญใหม่เมื่อกลับมาที่แท็บ และทุก 15 วินาที
  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      if (document.visibilityState === "visible") {
        loadInvites();
        loadTrips();
      }
    };
    const timer = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [userId, loadInvites, loadTrips]);

  async function respond(inv: Invite, accept: boolean) {
    setBusyInvite(inv.invite_id);
    const { error } = await supabase.rpc("respond_invite", {
      p_invite: inv.invite_id,
      p_accept: accept,
    });
    setBusyInvite("");
    if (error) return setError(error.message);
    await Promise.all([loadInvites(), loadTrips()]);
  }

    // เจ้าของ: ลบแผนทั้งแผน
  async function deleteTrip(trip: Trip) {
    if (!window.confirm(t("confirmDeleteTrip", { title: trip.title }))) return;
    const { error } = await supabase.from("trips").delete().eq("id", trip.id);
    if (error) return setError(error.message);
    await loadTrips();
  }

  // สมาชิก: ออกจากแผน (แผนยังอยู่ให้คนอื่น)
  async function leaveTrip(trip: Trip) {
    if (!window.confirm(t("confirmLeave"))) return;
    const { data, error } = await supabase.rpc("remove_member", {
      p_trip: trip.id,
      p_user: userId,
    });
    if (error) return setError(error.message);
    if (data !== "ok") return setError(String(data));
    await loadTrips();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const { data, error } = await supabase
      .from("trips")
      .insert({ title: title.trim(), start_date: startDate || null })
      .select("id")
      .single();

    setSaving(false);
    if (error) return setError(error.message);
    router.push(`/trip/${data.id}`);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        {t("loading")}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2">
          <h1 className="text-lg font-bold text-slate-800">✈️ {t("appName")}</h1>
          <div className="flex items-center gap-1">
            <SettingsBar />
            <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-700">
              @{username}
            </span>
            <button
              onClick={handleLogout}
              className="ml-1 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
            >
              {t("logout")}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {/* คำเชิญ */}
        {invites.length > 0 && (
          <section className="space-y-3 rounded-2xl bg-teal-50 p-4 ring-1 ring-teal-300">
            <h2 className="font-bold text-teal-700">
              📩 {t("invitesTitle")} ({invites.length})
            </h2>
            {invites.map((inv) => (
              <div
                key={inv.invite_id}
                className="rounded-xl bg-surface p-4 shadow-sm"
              >
                <p className="text-sm text-slate-500">
                  {t("invitedBy", { name: inv.inviter_username })}
                </p>
                <p className="mt-0.5 font-semibold text-slate-800">{inv.trip_title}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={busyInvite === inv.invite_id}
                    onClick={() => respond(inv, false)}
                    className="flex-1 rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                  >
                    {t("decline")}
                  </button>
                  <button
                    disabled={busyInvite === inv.invite_id}
                    onClick={() => respond(inv, true)}
                    className="flex-1 rounded-lg bg-teal-600 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
                  >
                    {t("accept")}
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">{t("myTrips")}</h2>
          <button
            onClick={() => {
              setError("");
              setShowForm(true);
            }}
            className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-teal-200 transition hover:bg-teal-500"
          >
            {t("newTrip")}
          </button>
        </div>

        {error && !showForm && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {trips.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-surface p-10 text-center">
            <div className="text-4xl">🗺️</div>
            <p className="mt-3 font-medium text-slate-700">{t("noTrips")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("noTripsHint")}</p>
          </div>
        )}

                {trips.map((trip) => {
          const total = trip.stops.reduce((sum, s) => sum + Number(s.cost ?? 0), 0);
          const members = trip.trip_members[0]?.count ?? 1;
          const isOwner = trip.owner_id === userId;
          return (
            <div
              key={trip.id}
              className="rounded-2xl bg-surface shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-teal-300"
            >
              <Link href={`/trip/${trip.id}`} className="block p-5 pb-3">
                <h3 className="text-lg font-semibold text-slate-800">{trip.title}</h3>
                <p className="mt-1 text-sm text-slate-500">📅 {formatDate(trip.start_date)}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    👥 {t("memberCount", { n: members })}
                  </span>
                  <span className="font-semibold text-teal-700">
                    {t("totalCost", { n: total.toLocaleString() })}
                  </span>
                </div>
              </Link>

              <div className="flex justify-end border-t border-slate-100 px-3 py-2">
                {isOwner ? (
                  <button
                    onClick={() => deleteTrip(trip)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    🗑️ {t("delete")}
                  </button>
                ) : (
                  <button
                    onClick={() => leaveTrip(trip)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    {t("leave")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setShowForm(false)}
        >
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-3xl bg-surface p-6 shadow-xl"
          >
            <h3 className="text-lg font-bold text-slate-800">{t("createTitle")}</h3>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {t("tripName")}
              </span>
              <input
                className={inputClass}
                placeholder={t("tripNamePh")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {t("startDate")}
              </span>
              <input
                className={inputClass}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl bg-slate-100 py-3 font-medium text-slate-700 hover:bg-slate-200"
              >
                {t("cancel")}
              </button>
              <button
                disabled={saving}
                className="flex-1 rounded-xl bg-teal-600 py-3 font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {saving ? t("creating") : t("create")}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
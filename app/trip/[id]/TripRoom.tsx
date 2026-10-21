"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BTS_FARE_URL, MRT_FARE_URL, mapsDirectionsUrl } from "@/lib/links";
import { useLang, type Key } from "@/lib/i18n";

type Trip = {
  id: string;
  title: string;
  start_date: string | null;
  day_count: number;
};

type Stop = {
  id: string;
  day: number;
  time: string | null;
  place: string;
  from_place: string | null;
  transport: string;
  cost: number | null;
  note: string | null;
  created_at: string;
};

type Member = { user_id: string; username: string; is_owner: boolean };
type Pending = { invite_id: string; username: string };

const TRANSPORTS = [
  { key: "walk", icon: "🚶" },
  { key: "bts", icon: "🚆" },
  { key: "mrt", icon: "🚇" },
  { key: "train", icon: "🚂" },
  { key: "bus", icon: "🚌" },
  { key: "taxi", icon: "🚕" },
  { key: "grab", icon: "🚖" },
  { key: "car", icon: "🚗" },
  { key: "other", icon: "✨" },
];

// ข้อความเฉพาะฟีเจอร์ลบวัน (เก็บไว้ในไฟล์นี้ ไม่ต้องแก้ i18n.tsx)
const extra = {
  th: {
    deleteDay: "ลบวัน {n}",
    confirmDay: "ลบวัน {n}? วันถัดไปจะเลื่อนขึ้นมาแทน",
    confirmDayStops:
      "ลบวัน {n}? มี {count} จุดแวะที่จะถูกลบไปด้วย และวันถัดไปจะเลื่อนขึ้นมาแทน",
    lastDay: "ลบวันสุดท้ายไม่ได้ ต้องมีอย่างน้อย 1 วัน",
  },
  en: {
    deleteDay: "Delete day {n}",
    confirmDay: "Delete day {n}? Later days will move up.",
    confirmDayStops:
      "Delete day {n}? Its {count} stop(s) will be deleted too, and later days will move up.",
    lastDay: "You can't delete the last day. A trip needs at least 1 day.",
  },
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-surface px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-100";

export default function TripRoom({ id }: { id: string }) {
  const router = useRouter();
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [day, setDay] = useState(1);
  const [error, setError] = useState("");

  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [friend, setFriend] = useState("");
  const [friendMsg, setFriendMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState(false);

  const [editing, setEditing] = useState<Stop | "new" | null>(null);
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [fromPlace, setFromPlace] = useState("");
  const [transport, setTransport] = useState("walk");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const locale = lang === "th" ? "th-TH" : "en-GB";
  const trLabel = (k: string) => t(`tr_${k}` as Key);

  function x(k: keyof typeof extra.th, vars?: Record<string, string | number>) {
    let s: string = extra[lang][k];
    if (vars) for (const [n, v] of Object.entries(vars)) s = s.replaceAll(`{${n}}`, String(v));
    return s;
  }

  function dayDate(start: string | null, d: number) {
    if (!start) return null;
    const dt = new Date(start + "T00:00:00");
    dt.setDate(dt.getDate() + d - 1);
    return dt.toLocaleDateString(locale, { day: "numeric", month: "short" });
  }

  function codeMsg(code: string) {
    if (code === "last_day") return x("lastDay");
    const map: Record<string, Key> = {
      not_member: "err_not_member",
      not_found: "err_not_found",
      self: "err_self",
      already_member: "err_already_member",
      already_invited: "err_already_invited",
      not_allowed: "err_not_allowed",
      owner_cannot_leave: "err_owner_cannot_leave",
    };
    return t(map[code] ?? "err_generic");
  }

  const loadTrip = useCallback(async () => {
    const { data, error } = await supabase
      .from("trips")
      .select("id, title, start_date, day_count")
      .eq("id", id)
      .maybeSingle();
    if (error) setError(error.message);
    setTrip(data as Trip | null);
  }, [id]);

  const loadStops = useCallback(async () => {
    const { data, error } = await supabase.from("stops").select("*").eq("trip_id", id);
    if (error) return setError(error.message);
    setStops((data ?? []) as Stop[]);
  }, [id]);

  const loadMembers = useCallback(async () => {
    const [m, p] = await Promise.all([
      supabase.rpc("get_trip_members", { p_trip: id }),
      supabase.rpc("get_trip_invites", { p_trip: id }),
    ]);
    setMembers((m.data ?? []) as Member[]);
    setPending((p.data ?? []) as Pending[]);
  }, [id]);

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

      await Promise.all([loadTrip(), loadStops(), loadMembers()]);

      try {
        const saved = Number(sessionStorage.getItem(`day:${id}`));
        if (saved >= 1) setDay(saved);
      } catch {}

      setLoading(false);
    }
    init();
  }, [id, router, loadTrip, loadStops, loadMembers]);

  // realtime: มีคนแก้จุดแวะ/แผน ให้โหลดใหม่ทันที
  useEffect(() => {
    const channel = supabase
      .channel(`trip-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stops", filter: `trip_id=eq.${id}` },
        () => loadStops()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${id}` },
        () => loadTrip()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, loadStops, loadTrip]);

  function changeDay(d: number) {
    setDay(d);
    try {
      sessionStorage.setItem(`day:${id}`, String(d));
    } catch {}
  }

  const dayCount = Math.max(trip?.day_count ?? 1, ...stops.map((s) => s.day), 1);
  const activeDay = Math.min(day, dayCount);

  const dayStops = stops
    .filter((s) => s.day === activeDay)
    .sort(
      (a, b) =>
        (a.time ?? "99:99").localeCompare(b.time ?? "99:99") ||
        a.created_at.localeCompare(b.created_at)
    );

  const dayTotal = dayStops.reduce((sum, s) => sum + Number(s.cost ?? 0), 0);
  const tripTotal = stops.reduce((sum, s) => sum + Number(s.cost ?? 0), 0);
  const isOwner = members.some((m) => m.user_id === userId && m.is_owner);

  async function addDay() {
    const next = dayCount + 1;
    const { error } = await supabase.from("trips").update({ day_count: next }).eq("id", id);
    if (error) return setError(error.message);
    setTrip((tr) => (tr ? { ...tr, day_count: next } : tr));
    changeDay(next);
  }

  async function deleteDay() {
    const count = dayStops.length;
    const msg =
      count > 0
        ? x("confirmDayStops", { n: activeDay, count })
        : x("confirmDay", { n: activeDay });
    if (!window.confirm(msg)) return;

    setError("");
    const { data, error } = await supabase.rpc("delete_day", {
      p_trip: id,
      p_day: activeDay,
    });
    if (error) return setError(error.message);
    if (data !== "ok") return setError(codeMsg(String(data)));

    await Promise.all([loadTrip(), loadStops()]);
    changeDay(Math.max(1, Math.min(activeDay, dayCount - 1)));
  }

  function openNew() {
    setTime("");
    setPlace("");
    setFromPlace("");
    setTransport("walk");
    setCost("");
    setNote("");
    setError("");
    setEditing("new");
  }

  function openEdit(s: Stop) {
    setTime(s.time ?? "");
    setPlace(s.place);
    setFromPlace(s.from_place ?? "");
    setTransport(s.transport);
    setCost(s.cost ? String(s.cost) : "");
    setNote(s.note ?? "");
    setError("");
    setEditing(s);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const payload = {
      time: time || null,
      place: place.trim(),
      from_place: fromPlace.trim() || null,
      transport,
      cost: Number(cost) || 0,
      note: note.trim() || null,
    };

    const result =
      editing === "new"
        ? await supabase.from("stops").insert({ ...payload, trip_id: id, day: activeDay })
        : await supabase.from("stops").update(payload).eq("id", (editing as Stop).id);

    setSaving(false);
    if (result.error) return setError(result.error.message);
    setEditing(null);
    await loadStops();
  }

  async function handleDelete(s: Stop) {
    if (!window.confirm(t("confirmDeleteStop", { place: s.place }))) return;
    const { error } = await supabase.from("stops").delete().eq("id", s.id);
    if (error) return setError(error.message);
    await loadStops();
  }

  function openMembers() {
    setFriendMsg(null);
    setShowMembers(true);
    loadMembers();
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const name = friend.trim().replace(/^@/, "");
    if (!name) return;
    setAdding(true);
    setFriendMsg(null);

    const { data, error } = await supabase.rpc("invite_by_username", {
      p_trip: id,
      p_username: name,
    });

    setAdding(false);
    if (error) return setFriendMsg({ ok: false, text: error.message });
    if (data === "ok") {
      setFriendMsg({ ok: true, text: t("inviteSent", { name }) });
      setFriend("");
      await loadMembers();
    } else {
      setFriendMsg({ ok: false, text: codeMsg(String(data)) });
    }
  }

  async function cancelInvite(p: Pending) {
    const { error } = await supabase.from("trip_invites").delete().eq("id", p.invite_id);
    if (error) return setFriendMsg({ ok: false, text: error.message });
    await loadMembers();
  }

  async function removeMember(m: Member) {
    const self = m.user_id === userId;
    const msg = self ? t("confirmLeave") : t("confirmRemove", { name: m.username });
    if (!window.confirm(msg)) return;

    const { data, error } = await supabase.rpc("remove_member", {
      p_trip: id,
      p_user: m.user_id,
    });
    if (error) return setFriendMsg({ ok: false, text: error.message });
    if (data !== "ok") return setFriendMsg({ ok: false, text: codeMsg(String(data)) });

    if (self) {
      router.replace("/");
      return;
    }
    setFriendMsg(null);
    await loadMembers();
  }

  async function deleteTrip() {
    if (!trip || !window.confirm(t("confirmDeleteTrip", { title: trip.title }))) return;
    const { error } = await supabase.from("trips").delete().eq("id", id);
    if (error) return setFriendMsg({ ok: false, text: error.message });
    router.replace("/");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        {t("loading")}
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-slate-600">
        <p>{t("notFound")}</p>
        <button onClick={() => router.push("/")} className="text-teal-700">
          {t("backHome")}
        </button>
      </main>
    );
  }

  const me = members.find((m) => m.user_id === userId);
  const activeDate = dayDate(trip.start_date, activeDay);

  return (
    <main className="min-h-screen bg-slate-50 pb-32">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-surface/90 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 pt-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="rounded-lg px-2 py-1 text-xl text-slate-600 hover:bg-slate-100"
              aria-label={t("back")}
            >
              ←
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold text-slate-800">{trip.title}</h1>
              <p className="text-xs text-slate-500">
                {t("tripTotal", { n: tripTotal.toLocaleString() })}
              </p>
            </div>
            <button
              onClick={openMembers}
              className="shrink-0 rounded-xl bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100"
            >
              👥 {members.length || 1}
            </button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-3">
            {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                onClick={() => changeDay(d)}
                className={`shrink-0 rounded-xl px-4 py-2 text-center text-sm font-semibold transition ${
                  d === activeDay
                    ? "bg-teal-600 text-white shadow-md shadow-teal-200"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t("day", { n: d })}
                {dayDate(trip.start_date, d) && (
                  <span className="block text-[11px] font-normal opacity-80">
                    {dayDate(trip.start_date, d)}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={addDay}
              className="shrink-0 rounded-xl border-2 border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 hover:border-teal-400 hover:text-teal-700"
            >
              {t("addDay")}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-3 px-4 py-5">
        {/* หัวของวันที่เปิดอยู่ + ปุ่มลบวัน */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-600">
            {t("day", { n: activeDay })}
            {activeDate ? ` · ${activeDate}` : ""}
          </p>
          {dayCount > 1 && (
            <button
              onClick={deleteDay}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              🗑️ {x("deleteDay", { n: activeDay })}
            </button>
          )}
        </div>

        {error && !editing && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {dayStops.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-surface p-10 text-center">
            <div className="text-4xl">📍</div>
            <p className="mt-3 font-medium text-slate-700">{t("emptyDay")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("emptyDayHint")}</p>
          </div>
        )}

        {dayStops.map((s, i) => {
          const origin = s.from_place || dayStops[i - 1]?.place || null;
          const icon = TRANSPORTS.find((tp) => tp.key === s.transport)?.icon;
          return (
            <div
              key={s.id}
              className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-slate-200"
            >
              <div className="flex items-start gap-3">
                <div className="w-14 shrink-0 rounded-lg bg-teal-50 py-1 text-center text-sm font-bold text-teal-700">
                  {s.time ?? "--:--"}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-800">{s.place}</h3>
                  {origin && (
                    <p className="text-xs text-slate-500">{t("fromPlace", { place: origin })}</p>
                  )}
                  <p className="mt-1 text-sm text-slate-600">
                    {icon} {trLabel(s.transport)} · ฿{Number(s.cost ?? 0).toLocaleString()}
                  </p>
                  {s.note && <p className="mt-1 text-sm text-slate-500">📝 {s.note}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => openEdit(s)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                    aria-label={t("edit")}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-red-50"
                    aria-label={t("delete")}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={mapsDirectionsUrl(origin, s.place, s.transport)}
                  className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/google-maps.png" alt="" className="h-5 w-5" />
                  {t("route")}
                </a>
                {s.transport === "bts" && (
                  <a
                    href={BTS_FARE_URL}
                    className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    {t("btsFare")}
                  </a>
                )}
                {s.transport === "mrt" && (
                  <a
                    href={MRT_FARE_URL}
                    className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    {t("mrtFare")}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs text-slate-500">{t("dayTotal", { n: activeDay })}</p>
            <p className="text-lg font-bold text-teal-700">฿{dayTotal.toLocaleString()}</p>
          </div>
          <button
            onClick={openNew}
            className="rounded-xl bg-teal-600 px-5 py-3 font-semibold text-white shadow-md shadow-teal-200 transition hover:bg-teal-500"
          >
            {t("addStop")}
          </button>
        </div>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={() => setEditing(null)}
        >
          <form
            onSubmit={handleSave}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-xl sm:rounded-3xl"
          >
            <h3 className="text-lg font-bold text-slate-800">
              {editing === "new" ? t("addStopTitle", { n: activeDay }) : t("editStopTitle")}
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <label className="col-span-1 block">
                <span className="mb-1 block text-sm font-medium text-slate-700">{t("time")}</span>
                <input
                  className={inputClass}
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>
              <label className="col-span-2 block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  {t("whereTo")}
                </span>
                <input
                  className={inputClass}
                  placeholder={t("wherePh")}
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  required
                  autoFocus
                />
              </label>
            </div>

            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {t("travelBy")}
              </span>
              <div className="grid grid-cols-3 gap-2">
                {TRANSPORTS.map((tp) => (
                  <button
                    key={tp.key}
                    type="button"
                    onClick={() => setTransport(tp.key)}
                    className={`rounded-xl border py-2 text-center text-xs font-medium transition ${
                      transport === tp.key
                        ? "border-teal-500 bg-teal-50 text-teal-700 ring-2 ring-teal-100"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-xl">{tp.icon}</span>
                    {trLabel(tp.key)}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {t("costLabel")}
              </span>
              <input
                className={inputClass}
                type="number"
                min="0"
                inputMode="decimal"
                placeholder="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {t("fromLabel")}
              </span>
              <input
                className={inputClass}
                placeholder={t("fromPh")}
                value={fromPlace}
                onChange={(e) => setFromPlace(e.target.value)}
              />
              <span className="mt-1 block text-xs text-slate-500">{t("fromHint")}</span>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {t("noteLabel")}
              </span>
              <input
                className={inputClass}
                placeholder={t("notePh")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 rounded-xl bg-slate-100 py-3 font-medium text-slate-700 hover:bg-slate-200"
              >
                {t("cancel")}
              </button>
              <button
                disabled={saving}
                className="flex-1 rounded-xl bg-teal-600 py-3 font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {saving ? t("saving") : t("save")}
              </button>
            </div>
          </form>
        </div>
      )}

      {showMembers && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={() => setShowMembers(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-xl sm:rounded-3xl"
          >
            <h3 className="text-lg font-bold text-slate-800">{t("membersTitle")}</h3>

            <ul className="space-y-2">
              {members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3"
                >
                  <span className="min-w-0 truncate font-medium text-slate-800">
                    @{m.username}
                    {m.user_id === userId && (
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        ({t("you")})
                      </span>
                    )}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {m.is_owner && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {t("owner")}
                      </span>
                    )}
                    {isOwner && !m.is_owner && (
                      <button
                        onClick={() => removeMember(m)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        {t("remove")}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {pending.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  ⏳ {t("pendingTitle")}
                </p>
                <ul className="space-y-2">
                  {pending.map((p) => (
                    <li
                      key={p.invite_id}
                      className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 px-4 py-2"
                    >
                      <span className="text-slate-600">@{p.username}</span>
                      <button
                        onClick={() => cancelInvite(p)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                      >
                        {t("cancelInvite")}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-2">
              <span className="block text-sm font-medium text-slate-700">
                {t("inviteTitle")}
              </span>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  placeholder={t("invitePh")}
                  value={friend}
                  onChange={(e) => setFriend(e.target.value)}
                />
                <button
                  disabled={adding}
                  className="shrink-0 rounded-xl bg-teal-600 px-4 font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
                >
                  {t("inviteBtn")}
                </button>
              </div>
              {friendMsg && (
                <p
                  className={`rounded-lg px-3 py-2 text-sm ${
                    friendMsg.ok ? "bg-teal-50 text-teal-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {friendMsg.text}
                </p>
              )}
              <p className="text-xs text-slate-500">{t("inviteHint")}</p>
            </form>

            {isOwner ? (
              <button
                onClick={deleteTrip}
                className="w-full rounded-xl bg-red-50 py-3 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                🗑️ {t("deleteTrip")}
              </button>
            ) : (
              me && (
                <button
                  onClick={() => removeMember(me)}
                  className="w-full rounded-xl bg-red-50 py-3 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  {t("leave")}
                </button>
              )
            )}

            <button
              onClick={() => setShowMembers(false)}
              className="w-full rounded-xl bg-slate-100 py-3 font-medium text-slate-700 hover:bg-slate-200"
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BTS_FARE_URL, MRT_FARE_URL, mapsDirectionsUrl } from "@/lib/links";

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

const TRANSPORTS = [
  { key: "walk", icon: "🚶", label: "เดิน" },
  { key: "bts", icon: "🚆", label: "BTS" },
  { key: "mrt", icon: "🚇", label: "MRT" },
  { key: "train", icon: "🚂", label: "รถไฟ" },
  { key: "bus", icon: "🚌", label: "รถเมล์" },
  { key: "taxi", icon: "🚕", label: "แท็กซี่" },
  { key: "grab", icon: "🚖", label: "Grab" },
  { key: "car", icon: "🚗", label: "รถส่วนตัว" },
  { key: "other", icon: "✨", label: "อื่นๆ" },
];

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-100";

function dayDate(start: string | null, d: number) {
  if (!start) return null;
  const dt = new Date(start + "T00:00:00");
  dt.setDate(dt.getDate() + d - 1);
  return dt.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

export default function TripView({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [day, setDay] = useState(1);
  const [error, setError] = useState("");

  // เพื่อนร่วมแผน
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [friend, setFriend] = useState("");
  const [friendMsg, setFriendMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState(false);

  // ฟอร์มจุดแวะ: null = ปิด, "new" = เพิ่มใหม่, Stop = กำลังแก้
  const [editing, setEditing] = useState<Stop | "new" | null>(null);
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [fromPlace, setFromPlace] = useState("");
  const [transport, setTransport] = useState("walk");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadStops = useCallback(async () => {
    const { data, error } = await supabase
      .from("stops")
      .select("*")
      .eq("trip_id", id);
    if (error) return setError(error.message);
    setStops((data ?? []) as Stop[]);
  }, [id]);

  const loadMembers = useCallback(async () => {
    const { data } = await supabase.rpc("get_trip_members", { p_trip: id });
    setMembers((data ?? []) as Member[]);
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

      const { data, error } = await supabase
        .from("trips")
        .select("id, title, start_date, day_count")
        .eq("id", id)
        .maybeSingle();

      if (error) setError(error.message);
      setTrip(data as Trip | null);
      await loadStops();
      await loadMembers();

      // จำวันที่เปิดค้างไว้ (กดย้อนกลับจาก Google Maps แล้วจะกลับมาวันเดิม)
      try {
        const saved = Number(sessionStorage.getItem(`day:${id}`));
        if (saved >= 1) setDay(saved);
      } catch {}

      setLoading(false);
    }
    init();
  }, [id, router, loadStops, loadMembers]);

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
        (payload) =>
          setTrip((t) => (t ? { ...t, ...(payload.new as Partial<Trip>) } : t))
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, loadStops]);

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

  async function addDay() {
    const next = dayCount + 1;
    const { error } = await supabase
      .from("trips")
      .update({ day_count: next })
      .eq("id", id);
    if (error) return setError(error.message);
    setTrip((t) => (t ? { ...t, day_count: next } : t));
    changeDay(next);
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
        ? await supabase
            .from("stops")
            .insert({ ...payload, trip_id: id, day: activeDay })
        : await supabase
            .from("stops")
            .update(payload)
            .eq("id", (editing as Stop).id);

    setSaving(false);
    if (result.error) return setError(result.error.message);
    setEditing(null);
    await loadStops();
  }

  async function handleDelete(s: Stop) {
    if (!window.confirm(`ลบ "${s.place}" ?`)) return;
    const { error } = await supabase.from("stops").delete().eq("id", s.id);
    if (error) return setError(error.message);
    await loadStops();
  }

  async function handleAddFriend(e: React.FormEvent) {
    e.preventDefault();
    if (!friend.trim()) return;
    setAdding(true);
    setFriendMsg(null);

    const { data, error } = await supabase.rpc("add_member_by_username", {
      p_trip: id,
      p_username: friend,
    });

    setAdding(false);
    if (error) return setFriendMsg({ ok: false, text: error.message });
    if (data === "ok") {
      setFriendMsg({ ok: true, text: `เพิ่ม @${friend.replace("@", "")} แล้ว` });
      setFriend("");
      await loadMembers();
    } else {
      setFriendMsg({ ok: false, text: String(data) });
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        กำลังโหลด...
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-slate-600">
        <p>ไม่พบแผนนี้ หรือคุณไม่ได้เป็นสมาชิกของแผน</p>
        <button onClick={() => router.push("/")} className="text-teal-700">
          ← กลับหน้าแรก
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-32">
      {/* แถบบน */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 pt-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="rounded-lg px-2 py-1 text-xl text-slate-600 hover:bg-slate-100"
              aria-label="กลับ"
            >
              ←
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold text-slate-800">
                {trip.title}
              </h1>
              <p className="text-xs text-slate-500">
                ค่าเดินทางรวมทั้งแผน ฿{tripTotal.toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => {
                setFriendMsg(null);
                setShowMembers(true);
              }}
              className="shrink-0 rounded-xl bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100"
            >
              👥 {members.length || 1}
            </button>
          </div>

          {/* แท็บวัน */}
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
                วัน {d}
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
              + วัน
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-3 px-4 py-5">
        {error && !editing && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {dayStops.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="text-4xl">📍</div>
            <p className="mt-3 font-medium text-slate-700">วันนี้ยังไม่มีจุดแวะ</p>
            <p className="mt-1 text-sm text-slate-500">
              กดปุ่ม &quot;+ เพิ่มจุดแวะ&quot; ด้านล่างได้เลย
            </p>
          </div>
        )}

        {dayStops.map((s, i) => {
          // ต้นทาง: ถ้าไม่ได้กรอกเอง ใช้ปลายทางของจุดก่อนหน้า
          const origin = s.from_place || dayStops[i - 1]?.place || null;
          const t = TRANSPORTS.find((x) => x.key === s.transport);
          return (
            <div
              key={s.id}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
            >
              <div className="flex items-start gap-3">
                <div className="w-14 shrink-0 rounded-lg bg-teal-50 py-1 text-center text-sm font-bold text-teal-700">
                  {s.time ?? "--:--"}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-800">{s.place}</h3>
                  {origin && (
                    <p className="text-xs text-slate-500">จาก {origin}</p>
                  )}
                  <p className="mt-1 text-sm text-slate-600">
                    {t?.icon} {t?.label} · ฿{Number(s.cost ?? 0).toLocaleString()}
                  </p>
                  {s.note && (
                    <p className="mt-1 text-sm text-slate-500">📝 {s.note}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => openEdit(s)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                    aria-label="แก้ไข"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-red-50"
                    aria-label="ลบ"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* ปุ่มลิงก์: ไม่มี target="_blank" = เปิดในแท็บเดิม กดย้อนกลับแล้วกลับมาเว็บเรา */}
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={mapsDirectionsUrl(origin, s.place, s.transport)}
                  className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/google-maps.png" alt="" className="h-5 w-5" />
                  เส้นทาง
                </a>
                {s.transport === "bts" && (
                  <a
                    href={BTS_FARE_URL}
                    className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    💰 ค่าโดยสาร BTS
                  </a>
                )}
                {s.transport === "mrt" && (
                  <a
                    href={MRT_FARE_URL}
                    className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    💰 ค่าโดยสาร MRT
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* แถบล่าง: ยอดรวมวันนี้ + ปุ่มเพิ่ม */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs text-slate-500">ยอดรวมวัน {activeDay}</p>
            <p className="text-lg font-bold text-teal-700">
              ฿{dayTotal.toLocaleString()}
            </p>
          </div>
          <button
            onClick={openNew}
            className="rounded-xl bg-teal-600 px-5 py-3 font-semibold text-white shadow-md shadow-teal-200 transition hover:bg-teal-700"
          >
            + เพิ่มจุดแวะ
          </button>
        </div>
      </div>

      {/* ฟอร์มเพิ่ม/แก้จุดแวะ */}
      {editing && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
          onClick={() => setEditing(null)}
        >
          <form
            onSubmit={handleSave}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
          >
            <h3 className="text-lg font-bold text-slate-800">
              {editing === "new" ? `เพิ่มจุดแวะ (วัน ${activeDay})` : "แก้ไขจุดแวะ"}
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <label className="col-span-1 block">
                <span className="mb-1 block text-sm font-medium text-slate-700">เวลา</span>
                <input
                  className={inputClass}
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>
              <label className="col-span-2 block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  ไปที่ไหน
                </span>
                <input
                  className={inputClass}
                  placeholder="เช่น สยามพารากอน"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  required
                  autoFocus
                />
              </label>
            </div>

            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">
                เดินทางโดย
              </span>
              <div className="grid grid-cols-3 gap-2">
                {TRANSPORTS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTransport(t.key)}
                    className={`rounded-xl border py-2 text-center text-xs font-medium transition ${
                      transport === t.key
                        ? "border-teal-500 bg-teal-50 text-teal-700 ring-2 ring-teal-100"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-xl">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                ค่าเดินทาง (บาท)
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
                ต้นทาง (ไม่กรอกก็ได้)
              </span>
              <input
                className={inputClass}
                placeholder="เว้นว่าง = ใช้จุดก่อนหน้า"
                value={fromPlace}
                onChange={(e) => setFromPlace(e.target.value)}
              />
              <span className="mt-1 block text-xs text-slate-500">
                ถ้าเป็นจุดแรกของวันและเว้นว่าง Google Maps จะใช้ตำแหน่งปัจจุบันของคุณ
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                โน้ต (ไม่กรอกก็ได้)
              </span>
              <input
                className={inputClass}
                placeholder="เช่น ลงสถานีสยาม ทางออก 3"
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
                ยกเลิก
              </button>
              <button
                disabled={saving}
                className="flex-1 rounded-xl bg-teal-600 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* หน้าต่างเพื่อนร่วมแผน */}
      {showMembers && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
          onClick={() => setShowMembers(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
          >
            <h3 className="text-lg font-bold text-slate-800">คนในแผนนี้</h3>

            <ul className="space-y-2">
              {members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                >
                  <span className="font-medium text-slate-800">@{m.username}</span>
                  {m.is_owner && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      เจ้าของแผน
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <form onSubmit={handleAddFriend} className="space-y-2">
              <span className="block text-sm font-medium text-slate-700">
                เพิ่มเพื่อนด้วย username
              </span>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  placeholder="เช่น ploy"
                  value={friend}
                  onChange={(e) => setFriend(e.target.value)}
                />
                <button
                  disabled={adding}
                  className="shrink-0 rounded-xl bg-teal-600 px-4 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  เพิ่ม
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
              <p className="text-xs text-slate-500">
                เพื่อนจะเห็นแผนนี้ในหน้าแรกและแก้ไขร่วมกันได้ทันที
              </p>
            </form>

            <button
              onClick={() => setShowMembers(false)}
              className="w-full rounded-xl bg-slate-100 py-3 font-medium text-slate-700 hover:bg-slate-200"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
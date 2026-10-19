"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

const th = {
  appName: "Trip Planner",
  tagline: "วางแผนเที่ยวกับเพื่อนได้ในที่เดียว",
  loading: "กำลังโหลด...",
  wait: "รอสักครู่...",
  cancel: "ยกเลิก",
  save: "บันทึก",
  saving: "กำลังบันทึก...",
  close: "ปิด",
  back: "กลับ",
  switchLang: "เปลี่ยนภาษา",
  switchTheme: "สลับโหมดสว่าง/มืด",
  // เข้าสู่ระบบ
  login: "เข้าสู่ระบบ",
  signup: "สมัครสมาชิก",
  createAccount: "สร้างบัญชี",
  logout: "ออก",
  username: "Username",
  usernamePh: "เช่น pim_01 (a-z 0-9 _ , 3-20 ตัว)",
  usernameHint: "เพื่อนจะใช้ชื่อนี้ค้นหาคุณเพื่อเชิญเข้าแผน",
  email: "อีเมล",
  password: "รหัสผ่าน",
  passwordPh: "อย่างน้อย 6 ตัวอักษร",
  // หน้าแรก
  myTrips: "แผนของฉัน",
  newTrip: "+ สร้างแผน",
  noDate: "ยังไม่ระบุวันที่",
  noTrips: "ยังไม่มีแผนเดินทาง",
  noTripsHint: 'กด "+ สร้างแผน" เพื่อเริ่มวางแผนทริปแรกของคุณ',
  memberCount: "{n} คน",
  totalCost: "ค่าเดินทางรวม ฿{n}",
  createTitle: "สร้างแผนใหม่",
  tripName: "ชื่อแผน",
  tripNamePh: "เช่น เที่ยวเชียงใหม่ 3 วัน",
  startDate: "วันที่เริ่มเดินทาง (ไม่ใส่ก็ได้)",
  create: "สร้างแผน",
  creating: "กำลังสร้าง...",
  invitesTitle: "คำเชิญเข้าร่วมแผน",
  invitedBy: "@{name} เชิญคุณเข้าร่วม",
  accept: "ยอมรับ",
  decline: "ปฏิเสธ",
  // หน้าแผน
  notFound: "ไม่พบแผนนี้ หรือคุณไม่ได้เป็นสมาชิกของแผน",
  backHome: "← กลับหน้าแรก",
  tripTotal: "ค่าเดินทางรวมทั้งแผน ฿{n}",
  day: "วัน {n}",
  addDay: "+ วัน",
  emptyDay: "วันนี้ยังไม่มีจุดแวะ",
  emptyDayHint: 'กดปุ่ม "+ เพิ่มจุดแวะ" ด้านล่างได้เลย',
  fromPlace: "จาก {place}",
  route: "เส้นทาง",
  btsFare: "💰 ค่าโดยสาร BTS",
  mrtFare: "💰 ค่าโดยสาร MRT",
  edit: "แก้ไข",
  delete: "ลบ",
  confirmDeleteStop: 'ลบ "{place}" ?',
  dayTotal: "ยอดรวมวัน {n}",
  addStop: "+ เพิ่มจุดแวะ",
  addStopTitle: "เพิ่มจุดแวะ (วัน {n})",
  editStopTitle: "แก้ไขจุดแวะ",
  time: "เวลา",
  whereTo: "ไปที่ไหน",
  wherePh: "เช่น สยามพารากอน",
  travelBy: "เดินทางโดย",
  costLabel: "ค่าเดินทาง (บาท)",
  fromLabel: "ต้นทาง (ไม่กรอกก็ได้)",
  fromPh: "เว้นว่าง = ใช้จุดก่อนหน้า",
  fromHint: "ถ้าเป็นจุดแรกของวันและเว้นว่าง Google Maps จะใช้ตำแหน่งปัจจุบันของคุณ",
  noteLabel: "โน้ต (ไม่กรอกก็ได้)",
  notePh: "เช่น ลงสถานีสยาม ทางออก 3",
  tr_walk: "เดิน",
  tr_bts: "BTS",
  tr_mrt: "MRT",
  tr_train: "รถไฟ",
  tr_bus: "รถเมล์",
  tr_taxi: "แท็กซี่",
  tr_grab: "Grab",
  tr_car: "รถส่วนตัว",
  tr_other: "อื่นๆ",
  // คนในแผน
  membersTitle: "คนในแผนนี้",
  owner: "เจ้าของแผน",
  you: "คุณ",
  remove: "นำออก",
  confirmRemove: "นำ @{name} ออกจากแผนนี้?",
  pendingTitle: "รอตอบรับ",
  cancelInvite: "ยกเลิก",
  inviteTitle: "เชิญเพื่อนด้วย username",
  invitePh: "เช่น ploy",
  inviteBtn: "เชิญ",
  inviteHint: "เพื่อนจะได้รับคำเชิญในหน้าแรก และต้องกดยอมรับก่อนถึงจะเห็นแผนนี้",
  inviteSent: "ส่งคำเชิญให้ @{name} แล้ว",
  leave: "ออกจากแผนนี้",
  confirmLeave: "ออกจากแผนนี้? คุณจะไม่เห็นแผนนี้อีกจนกว่าจะมีคนเชิญใหม่",
  deleteTrip: "ลบแผนนี้ทั้งแผน",
  confirmDeleteTrip: 'ลบแผน "{title}" ทั้งแผน? ทุกคนจะเสียข้อมูลและกู้คืนไม่ได้',
  err_generic: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง",
  err_not_member: "คุณไม่ใช่สมาชิกของแผนนี้",
  err_not_found: "ไม่พบ username นี้",
  err_self: "เชิญตัวเองไม่ได้",
  err_already_member: "เป็นสมาชิกอยู่แล้ว",
  err_already_invited: "เชิญไปแล้ว กำลังรอตอบรับ",
  err_not_allowed: "คุณไม่มีสิทธิ์ทำรายการนี้",
  err_owner_cannot_leave: "เจ้าของแผนออกจากแผนไม่ได้ ให้ลบแผนแทน",
};

export type Key = keyof typeof th;

const en: Record<Key, string> = {
  appName: "Trip Planner",
  tagline: "Plan trips with friends, all in one place",
  loading: "Loading...",
  wait: "Please wait...",
  cancel: "Cancel",
  save: "Save",
  saving: "Saving...",
  close: "Close",
  back: "Back",
  switchLang: "Switch language",
  switchTheme: "Toggle light/dark mode",
  login: "Log in",
  signup: "Sign up",
  createAccount: "Create account",
  logout: "Log out",
  username: "Username",
  usernamePh: "e.g. pim_01 (a-z, 0-9, _ ; 3-20 chars)",
  usernameHint: "Friends will use this name to invite you to trips",
  email: "Email",
  password: "Password",
  passwordPh: "At least 6 characters",
  myTrips: "My trips",
  newTrip: "+ New trip",
  noDate: "No date set",
  noTrips: "No trips yet",
  noTripsHint: 'Tap "+ New trip" to plan your first trip',
  memberCount: "{n} people",
  totalCost: "Total fare ฿{n}",
  createTitle: "New trip",
  tripName: "Trip name",
  tripNamePh: "e.g. 3 days in Chiang Mai",
  startDate: "Start date (optional)",
  create: "Create",
  creating: "Creating...",
  invitesTitle: "Trip invitations",
  invitedBy: "@{name} invited you to join",
  accept: "Accept",
  decline: "Decline",
  notFound: "Trip not found, or you are not a member",
  backHome: "← Back home",
  tripTotal: "Total fare for the trip ฿{n}",
  day: "Day {n}",
  addDay: "+ Day",
  emptyDay: "No stops for this day",
  emptyDayHint: 'Tap "+ Add stop" below to get started',
  fromPlace: "From {place}",
  route: "Directions",
  btsFare: "💰 BTS fare",
  mrtFare: "💰 MRT fare",
  edit: "Edit",
  delete: "Delete",
  confirmDeleteStop: 'Delete "{place}"?',
  dayTotal: "Day {n} total",
  addStop: "+ Add stop",
  addStopTitle: "Add stop (Day {n})",
  editStopTitle: "Edit stop",
  time: "Time",
  whereTo: "Where to",
  wherePh: "e.g. Siam Paragon",
  travelBy: "Travel by",
  costLabel: "Fare (THB)",
  fromLabel: "From (optional)",
  fromPh: "Empty = previous stop",
  fromHint: "If this is the first stop of the day and left empty, Google Maps uses your current location",
  noteLabel: "Note (optional)",
  notePh: "e.g. Siam station, exit 3",
  tr_walk: "Walk",
  tr_bts: "BTS",
  tr_mrt: "MRT",
  tr_train: "Train",
  tr_bus: "Bus",
  tr_taxi: "Taxi",
  tr_grab: "Grab",
  tr_car: "Own car",
  tr_other: "Other",
  membersTitle: "People in this trip",
  owner: "Owner",
  you: "you",
  remove: "Remove",
  confirmRemove: "Remove @{name} from this trip?",
  pendingTitle: "Waiting for reply",
  cancelInvite: "Cancel",
  inviteTitle: "Invite a friend by username",
  invitePh: "e.g. ploy",
  inviteBtn: "Invite",
  inviteHint: "Your friend gets the invitation on their home page and must accept before seeing this trip",
  inviteSent: "Invitation sent to @{name}",
  leave: "Leave this trip",
  confirmLeave: "Leave this trip? You will not see it again unless someone invites you back.",
  deleteTrip: "Delete this trip",
  confirmDeleteTrip: 'Delete "{title}" for everyone? This cannot be undone.',
  err_generic: "Something went wrong, please try again",
  err_not_member: "You are not a member of this trip",
  err_not_found: "Username not found",
  err_self: "You can't invite yourself",
  err_already_member: "Already a member",
  err_already_invited: "Already invited, waiting for reply",
  err_not_allowed: "You don't have permission to do this",
  err_owner_cannot_leave: "The owner can't leave. Delete the trip instead",
};

type Lang = "th" | "en";
const dict = { th, en };

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key, vars?: Record<string, string | number>) => string;
};

const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("th");

  // อ่านภาษาที่เคยเลือกไว้ (ไม่เคยเลือก: เครื่องเป็นภาษาไทยใช้ไทย ไม่งั้นใช้อังกฤษ)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lang");
      if (saved === "th" || saved === "en") {
        setLangState(saved);
        return;
      }
    } catch {}
    if (!navigator.language.toLowerCase().startsWith("th")) setLangState("en");
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch {}
  }, []);

  const t = useCallback(
    (k: Key, vars?: Record<string, string | number>) => {
      let s: string = dict[lang][k] ?? k;
      if (vars) {
        for (const [name, v] of Object.entries(vars)) {
          s = s.replaceAll(`{${name}}`, String(v));
        }
      }
      return s;
    },
    [lang]
  );

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang ต้องอยู่ใน LangProvider");
  return ctx;
}
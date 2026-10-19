export const MRT_FARE_URL = "https://metro.bemplc.co.th/Fare-Calculation";
export const BTS_FARE_URL = "https://www.bts.co.th/routemap.html";

// แปลงชนิดการเดินทางของเรา เป็น travelmode ของ Google Maps
const TRAVEL_MODE: Record<string, string> = {
  walk: "walking",
  bts: "transit",
  mrt: "transit",
  bus: "transit",
  train: "transit",
  taxi: "driving",
  grab: "driving",
  car: "driving",
};

export function mapsDirectionsUrl(
  origin: string | null,
  destination: string,
  transport: string
) {
  const params = new URLSearchParams({ api: "1", destination });
  if (origin) params.set("origin", origin); // ไม่ใส่ = Google ใช้ตำแหน่งปัจจุบัน
  const mode = TRAVEL_MODE[transport];
  if (mode) params.set("travelmode", mode);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
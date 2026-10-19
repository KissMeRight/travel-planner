import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  await connection(); // บังคับให้ทำงานจริงทุกครั้ง ไม่ใช่ผลที่แคชไว้ตอน build
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { error } = await supabase.rpc("ping");
  return Response.json({ ok: !error });
}
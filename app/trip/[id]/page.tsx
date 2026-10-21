import { Suspense } from "react";
import TripRoom from "./TripRoom";

export default function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
          ...
        </main>
      }
    >
      <TripLoader params={params} />
    </Suspense>
  );
}

async function TripLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TripRoom id={id} />;
}
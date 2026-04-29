export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function ControlRedirectPage() {
  const first = await prisma.station.findFirst({ orderBy: { createdAt: "asc" } });
  if (first) redirect(`/stations/${first.id}/control`);
  redirect("/dashboard");
}

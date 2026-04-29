import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function StationsPage() {
  const first = await prisma.station.findFirst({ orderBy: { createdAt: "asc" } });
  if (first) redirect(`/stations/${first.id}`);
  redirect("/dashboard");
}

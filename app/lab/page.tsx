import { prisma } from "@/lib/prisma";
import { LabForm } from "@/components/lab/LabForm";

export const dynamic = "force-dynamic";

async function getData() {
  const station = await prisma.station.findFirst({ orderBy: { createdAt: "asc" } });
  if (!station) return { station: null, samples: [] };
  const samples = await prisma.labSample.findMany({
    where: { stationId: station.id },
    orderBy: { sampledAt: "desc" },
    take: 20,
  });
  return { station, samples };
}

export default async function LabPage() {
  const { station, samples } = await getData();
  if (!station) return <div className="p-6 text-slate-400">暂无站点数据</div>;

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">化验记录</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          录入人工化验数据，用于软测量模型 bias correction 校准
        </p>
      </div>
      <LabForm
        stationId={station.id}
        initialSamples={samples.map((s) => ({
          ...s,
          sampledAt: s.sampledAt.toISOString(),
          createdAt: s.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}

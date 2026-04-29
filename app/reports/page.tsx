import { prisma } from "@/lib/prisma";
import { ReportViewer } from "@/components/reports/ReportViewer";

export const revalidate = 0;

async function getData() {
  const station = await prisma.station.findFirst({ orderBy: { createdAt: "asc" } });
  if (!station) return { station: null, reports: [] };

  const reports = await prisma.report.findMany({
    where: { stationId: station.id },
    orderBy: { month: "desc" },
  });
  const labSamples = await prisma.labSample.findMany({
    where: { stationId: station.id },
    orderBy: { sampledAt: "desc" },
  });

  return { station, reports, labSamples };
}

export default async function ReportsPage() {
  const { station, reports, labSamples } = await getData();
  if (!station) {
    return <div className="p-6 text-slate-400">暂无站点数据</div>;
  }

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">运营报表</h1>
        <p className="text-sm text-slate-500 mt-0.5">{station.name}</p>
      </div>
      <ReportViewer
        stationId={station.id}
        initialReports={reports.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          metrics: r.metrics as Record<string, number | null>,
        }))}
        labSamples={labSamples.map((l) => ({
          ...l,
          sampledAt: l.sampledAt.toISOString(),
          createdAt: l.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}

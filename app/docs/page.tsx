import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HardDrive, Wifi, Zap, Wrench, ChevronRight, AlertTriangle, CheckCircle2, Scale
} from "lucide-react";

const Section = ({ id, icon: Icon, title, children }: {
  id: string; icon: React.ElementType; title: string; children: React.ReactNode;
}) => (
  <section id={id} className="scroll-mt-6">
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200">
      <Icon className="h-5 w-5 text-blue-500" />
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
    </div>
    {children}
  </section>
);

const Table = ({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) => (
  <div className="rounded-xl border overflow-hidden">
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-xs text-slate-500">
        <tr>{headers.map(h => <th key={h} className="px-4 py-2.5 text-left font-medium">{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-slate-50">
            {row.map((cell, j) => <td key={j} className="px-4 py-2.5 text-slate-700">{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
      {n}
    </div>
    <div className="pt-1 pb-6 border-l-2 border-slate-200 pl-4 -ml-4 flex-1">
      <h3 className="font-semibold text-slate-800 mb-2">{title}</h3>
      <div className="text-sm text-slate-600 space-y-1">{children}</div>
    </div>
  </div>
);

export default function DocsPage() {
  return (
    <div className="p-6 max-w-4xl space-y-10">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">硬件部署指南</h1>
        <p className="text-sm text-slate-500 mt-1">乡镇污水站标准化接入方案 · 适用于 50–5000 吨/天规模</p>
      </div>

      {/* 目录 */}
      <Card className="bg-blue-50 border-blue-100">
        <CardContent className="pt-4 pb-3">
          <p className="text-xs font-medium text-blue-700 mb-2">目录</p>
          <div className="grid grid-cols-2 gap-1 text-sm text-blue-600">
            {[
              ["#bom", "一、标准硬件清单"],
              ["#vision", "二、AI 视觉替代方案"],
              ["#install", "三、安装步骤"],
              ["#scale", "四、站点规模适配"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="flex items-center gap-1 hover:text-blue-800">
                <ChevronRight className="h-3 w-3" />{label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 一、标准硬件清单 */}
      <Section id="bom" icon={HardDrive} title="一、标准硬件清单（500 吨/天基准站）">
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-slate-600 mb-2">▍核心传感器（必装）</p>
            <Table
              headers={["设备", "推荐型号", "数量", "安装位置", "参考价（元）"]}
              rows={[
                ["pH 传感器", "哈希 PHC301 / 奥立龙 8107BNUMD", "1 套", "曝气池进水端", "2,500–5,000"],
                ["DO 溶氧仪（荧光法）", "哈希 LDO2 / 德国 WTW FDO925", "1 套", "曝气池中段", "4,000–8,000"],
                ["ORP 传感器", "美国 YSI Pro20 / 汉威 HWS-ORP", "1 套", "缺氧池", "1,500–3,000"],
                ["电磁流量计", "科隆 OPTIFLUX / 艾默生 8700M", "2 台", "进水管 + 出水管", "3,000–6,000/台"],
              ]}
            />
            <p className="text-xs text-slate-400 mt-2">※ 核心传感器不可被视觉替代，为工艺控制与出水达标的法定依据。</p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-600 mb-2">▍边缘计算与通信</p>
            <Table
              headers={["设备", "推荐型号", "数量", "说明", "参考价（元）"]}
              rows={[
                ["工业边缘网关", "研华 ECU-1051 / 西门子 IOT2040", "1 台", "汇聚传感器数据，运行本地 MQTT Broker，断网缓存", "2,500–5,000"],
                ["4G/5G 工业路由器", "移远 EC20 / 华为 E5576", "1 台", "上传数据至云端，建议 4G 双卡备份", "500–1,500"],
                ["RS485 集线器", "通用 DIN 导轨式", "1 台", "统一接入 Modbus 传感器", "200–500"],
                ["防雷防浪涌模块", "OBO 或菲尼克斯", "1 套", "保护网关与传感器", "300–800"],
              ]}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-600 mb-2">▍执行器（控制下发所需）</p>
            <Table
              headers={["设备", "推荐型号", "数量", "说明", "参考价（元）"]}
              rows={[
                ["变频器（风机用）", "西门子 G120 / 汇川 MD500", "1–2 台", "接收 Modbus 指令控制曝气风机转速", "2,000–5,000/台"],
                ["变频器（水泵用）", "同上或台达 VFD", "1–2 台", "回流泵 / 剩余污泥泵变频", "1,500–4,000/台"],
                ["智能电表", "威胜 DTSD341 / 华立 DDS", "1 台", "记录月耗电量，填充运营报表", "300–800"],
              ]}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-600 mb-2">▍综合成本估算</p>
            <Table
              headers={["方案", "硬件成本", "安装调试", "合计", "备注"]}
              rows={[
                [
                  "全传感器标准方案",
                  "¥18,000–33,000",
                  "¥3,000–5,000",
                  <span className="font-semibold">¥21,000–38,000</span>,
                  "精度最高，适合新建站"
                ],
                [
                  "视觉混合方案（推荐）",
                  "¥10,000–18,000",
                  "¥3,000–5,000",
                  <span className="font-semibold text-green-700">¥13,000–23,000</span>,
                  "省去浊度仪+液位计，用相机替代"
                ],
                [
                  "最简方案（改造旧站）",
                  "¥6,000–10,000",
                  "¥2,000–3,000",
                  <span className="font-semibold">¥8,000–13,000</span>,
                  "仅接 pH+DO，复用现有设备"
                ],
              ]}
            />
          </div>
        </div>
      </Section>

      {/* 二、AI 视觉替代方案 */}
      <Section id="vision" icon={Zap} title="二、AI 视觉替代方案（节省 ¥8,000–20,000/站）">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">一台工业防水相机（¥800–2,000）部署在现场，运行 AI 视觉推理，可替代以下传感器：</p>
          <Table
            headers={["可替代传感器", "视觉检测方式", "精度", "节省金额"]}
            rows={[
              ["浊度仪", "拍摄出水端水色，模型判断 NTU 区间", "±10 NTU（满足达标预警需求）", "¥3,000–8,000"],
              ["污泥液位计", "拍摄沉淀池泥水界面，检测污泥层高度", "±5 cm（粗精度，可替代常规液位计）", "¥5,000–15,000"],
              ["泡沫检测", "实时检测曝气池表面泡沫面积", "新增能力，原无传感器", "—"],
              ["设备运行状态", "检测水泵/风机指示灯、叶轮运转", "新增能力，替代人工巡检", "—"],
            ]}
          />
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 flex gap-3">
            <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700">
              <span className="font-medium">注意：</span>pH、DO、ORP、流量计不可被视觉替代。这四项是工艺控制核心，也是环保局在线监测的法定要求，不得省略。
            </p>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex gap-3">
            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">
              <span className="font-medium">接入方式：</span>视觉推理脚本运行在边缘网关，结果以相同格式 POST 至平台 <code className="bg-green-100 px-1 rounded">/api/ingest/telemetry</code>，软件端无需任何改动。
            </p>
          </div>
        </div>
      </Section>

      {/* 三、安装步骤 */}
      <Section id="install" icon={Wrench} title="三、现场安装步骤">
        <div className="space-y-0">
          <Step n={1} title="现场勘察（0.5 天）">
            <p>确认进水管径（常见 DN100–DN300）、电控柜位置、网络信号强度。</p>
            <p>拍摄现场照片，记录现有设备型号（是否有旧 PLC 可复用）。</p>
            <p>确认 4G 信号强度，弱信号区域提前申请外置天线或定向天线。</p>
          </Step>
          <Step n={2} title="传感器安装（1 天）">
            <p>pH / DO / ORP 探头安装在专用流通池或直插式管道安装支架。</p>
            <p>电磁流量计需断管安装，注意上下游直管段要求（上游 ≥10D，下游 ≥5D）。</p>
            <p>所有传感器走穿线管保护，避免阳光直射和设备震动。</p>
            <p className="text-slate-400">※ 视觉相机：安装在曝气池斜上方 1.5–2 m 处，视角覆盖水面，需防水外壳 IP67。</p>
          </Step>
          <Step n={3} title="边缘网关配置（0.5 天）">
            <p>将所有传感器通过 RS485 线缆接入网关，每条总线不超过 32 个节点。</p>
            <p>在网关上配置各传感器的 Modbus 地址和采集频率（默认 10 秒/次）。</p>
            <p>设置 <code className="bg-slate-100 px-1 rounded">gatewayId</code>（格式：GW-[站点编号]-[年份]，如 <code className="bg-slate-100 px-1 rounded">GW-DEMO-001</code>）。</p>
            <p>测试本地 MQTT Broker 正常推送数据至 <code className="bg-slate-100 px-1 rounded">/api/ingest/telemetry</code>。</p>
          </Step>
          <Step n={4} title="变频器对接（0.5 天）">
            <p>将曝气风机变频器接入 RS485 网络，配置 Modbus 站号（默认 1）。</p>
            <p>在平台"控制下发"页面验证送风频率指令（建议先在 30 Hz 空载测试）。</p>
            <p>安全限幅已预设：风机 20–50 Hz，单次调节幅度 ≤30%，系统自动保护。</p>
          </Step>
          <Step n={5} title="联调与验收（0.5 天）">
            <p>打开平台"总览"页面，确认传感器数据实时更新（每 10–15 秒刷新）。</p>
            <p>人工制造一个告警（如拔掉 pH 探头），验证告警中心自动弹出并推送通知。</p>
            <p>录入一条化验记录，与传感器实时值比对，误差应在 ±10% 以内。</p>
            <p>签署《数据接入验收单》，交付运维手册。</p>
          </Step>
        </div>
      </Section>

      {/* 四、站点规模适配 */}
      <Section id="scale" icon={Scale} title="四、不同规模站点适配方案">
        <div className="space-y-4">
          <Table
            headers={["站点规模", "处理工艺", "传感器配置", "网关数量", "预估硬件成本"]}
            rows={[
              [
                <span>微型站<br/><span className="text-slate-400 text-xs">50–200 吨/天</span></span>,
                "A/O 或一体化设备",
                "pH + DO + 进水流量计（3 项）",
                "1 台（可用树莓派4B简化）",
                "¥8,000–13,000",
              ],
              [
                <span className="font-medium text-blue-600">标准站 ✦ 推荐<br/><span className="text-slate-400 text-xs font-normal">200–1000 吨/天</span></span>,
                "MBBR / A²/O",
                "pH + DO + ORP + 流量计×2（+ 视觉可选）",
                "1 台工业网关",
                "¥13,000–23,000",
              ],
              [
                <span>中型站<br/><span className="text-slate-400 text-xs">1000–3000 吨/天</span></span>,
                "A²/O + MBR",
                "全套传感器 + 在线 COD 仪 + 总磷仪",
                "1–2 台网关（分区采集）",
                "¥35,000–80,000",
              ],
              [
                <span>大型站<br/><span className="text-slate-400 text-xs">3000 吨/天以上</span></span>,
                "多段 A²/O + 深度处理",
                "全套 + SCADA 系统对接",
                "2 台以上，建议专线上传",
                "¥80,000 以上（含 SCADA）",
              ],
            ]}
          />

          <div className="grid grid-cols-2 gap-4 mt-2">
            <Card className="border-orange-100 bg-orange-50">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm text-orange-700">规模缩小时</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-orange-700 space-y-1 pb-4">
                <p>• 可裁撤 ORP 传感器，改用 DO 值间接推断氧化还原状态</p>
                <p>• 变频控制改为定时曝气，取消控制下发功能</p>
                <p>• 网关可降级为树莓派 4B + 4G 模组（成本降至 ¥500）</p>
                <p>• 软件端直接在"传感器"页面关闭不活跃传感器即可</p>
              </CardContent>
            </Card>
            <Card className="border-green-100 bg-green-50">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm text-green-700">规模扩大时</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-green-700 space-y-1 pb-4">
                <p>• 新增在线 COD 仪（¥30,000–80,000）直接代替软测量</p>
                <p>• 添加总磷/总氮在线仪，满足严格排放标准（一级 A+）</p>
                <p>• 多个工艺段各部署独立网关，数据汇入同一个 <code className="bg-green-100 px-1 rounded">stationId</code></p>
                <p>• 数据量增大后联系我们开启 TimescaleDB 自动压缩</p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">平台扩展性：</span>
              系统支持无限站点，只需为每个站点分配唯一 <code className="bg-slate-100 px-1 rounded">gatewayId</code>。
              多站点管理、用户权限、跨站报表等功能将在 P1 阶段上线。如需定制接入方案，请联系技术支持。
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}

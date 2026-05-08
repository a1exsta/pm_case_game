import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer,
} from "recharts";

interface RadarPoint {
  category: string;
  value: number;
}

interface Props {
  data: RadarPoint[];
}

const axisLabelMap: Record<string, string> = {
  "Дискавери и аналитика": "Дискавери и аналит.",
  "AI и технический контекст": "AI и тех. контекст",
  "Планирование и delivery": "Планирование и delivery",
  "Управление стейкхолдерами": "Упр. стейкхолдерами",
  "Оптимизация процессов": "Оптимизация проц.",
};

const formatAxisLabel = (label: string) => axisLabelMap[label] ?? label;

interface AxisTickProps {
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  payload?: { value: string };
}

function AxisTick({ x = 0, y = 0, cx = 0, cy = 0, payload }: AxisTickProps) {
  const label = formatAxisLabel(payload?.value ?? "");
  const dx = x - cx;
  const dy = y - cy;

  let textAnchor: "start" | "middle" | "end" = "middle";
  let xOffset = 0;
  let yOffset = 0;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) {
      textAnchor = "start";
      xOffset = 10;
    } else {
      textAnchor = "end";
      xOffset = -10;
    }
  } else {
    textAnchor = "middle";
    yOffset = dy < 0 ? -6 : 14;
  }

  return (
    <text x={x + xOffset} y={y + yOffset} fill="#cbd5e1" fontSize={11} textAnchor={textAnchor}>
      {label}
    </text>
  );
}

export default function RadarChart({ data }: Props) {
  return (
    <div className="h-80 w-full rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={data} margin={{ top: 18, right: 44, bottom: 18, left: 44 }}>
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis dataKey="category" tick={<AxisTick />} />
          <Radar dataKey="value" stroke="#818cf8" fill="#6366f1" fillOpacity={0.45} />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}

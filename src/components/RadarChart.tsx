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

export default function RadarChart({ data }: Props) {
  return (
    <div className="h-80 w-full rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={data}>
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis dataKey="category" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
          <Radar dataKey="value" stroke="#818cf8" fill="#6366f1" fillOpacity={0.45} />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}

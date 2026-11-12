export function LineChart({ points }: { points: { label: string; value: number }[] }) {
  if (points.length === 0) return null;
  const width = 320;
  const height = 176;
  const padL = 44;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = max === min;
  const span = max - min || 1;
  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? padL + (width - padL - padR) / 2
        : padL + (index / (points.length - 1)) * (width - padL - padR);
    const y = flat
      ? padT + (height - padT - padB) / 2
      : padT + (1 - (point.value - min) / span) * (height - padT - padB);
    return { ...point, x, y };
  });
  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const grid = [0, 0.5, 1].map((step) => padT + step * (height - padT - padB));

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Estimated one-rep max over time">
      {grid.map((y) => (
        <line key={y} x1={padL} x2={width - padR} y1={y} y2={y} className="grid" />
      ))}
      <text x={4} y={flat ? padT + (height - padT - padB) / 2 : padT + 4} className="axis">
        {Math.round(max)}
      </text>
      {!flat && (
        <text x={4} y={height - padB} className="axis">
          {Math.round(min)}
        </text>
      )}
      <path d={path} className="series" />
      {coords.map((point) => (
        <g key={`${point.label}-${point.x}`}>
          <circle cx={point.x} cy={point.y} r="4" className="dot" />
          <text x={point.x} y={height - 8} textAnchor="middle" className="axis">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function BarList({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) return <p className="muted">No completed sets this week.</p>;
  return (
    <ul className="bars">
      {rows.map((row) => (
        <li key={row.label}>
          <span>{row.label}</span>
          <span className="bar" aria-hidden="true">
            <span style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <strong>{row.value}</strong>
        </li>
      ))}
    </ul>
  );
}

import type { ReactNode } from 'react';
import { isDeloadWeek, targetRir } from '../engine/progression';

export function Mark({ size = 36 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#241910" />
      <path d="M14 44h36" stroke="#e39a45" strokeWidth="6" strokeLinecap="round" />
      <path d="M16 44a16 16 0 0 1 32 0" fill="#1a100e" stroke="#e39a45" strokeWidth="6" />
      <circle cx="32" cy="38" r="3.5" fill="#e07a5f" />
    </svg>
  );
}

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
  step = 1,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  suffix?: string;
  step?: number;
}) {
  const down = Math.max(min, value - step);
  const up = Math.min(max, value + step);
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} disabled={down === value} onClick={() => onChange(down)}>
        −
      </button>
      <span>
        {value}
        {suffix ? ` ${suffix}` : ''}
      </span>
      <button type="button" aria-label={`Increase ${label}`} disabled={up === value} onClick={() => onChange(up)}>
        +
      </button>
    </div>
  );
}

export function WeekRail({ week, total }: { week: number; total: number }) {
  return (
    <ol className="week-rail" aria-label="Weeks in this block">
      {Array.from({ length: total }, (_, index) => {
        const number = index + 1;
        const deload = isDeloadWeek(number, total);
        const state = number === week ? 'now' : number < week ? 'past' : 'future';
        return (
          <li key={number} className={`week-cell ${state} ${deload ? 'deload' : ''}`}>
            <span>{deload ? 'D' : number}</span>
            <small>{deload ? 'Easy' : `RIR ${targetRir(number, total)}`}</small>
          </li>
        );
      })}
    </ol>
  );
}

export function Sheet({
  title,
  children,
  confirmLabel,
  cancelLabel = 'Back',
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="sheet-title">{title}</h2>
        <div className="sheet-body">{children}</div>
        <div className="btn-row">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="notice">{children}</p>;
}

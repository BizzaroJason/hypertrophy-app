import type { Unit } from '../engine/types';

export function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function formatLoad(weight: number, unit: Unit): string {
  return `${formatNumber(weight)} ${unit}`;
}

export function formatWhen(timestamp: number | null): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function parseLoad(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 2000) return null;
  return Math.round(value * 100) / 100;
}

export function parseReps(raw: string): number | null {
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < 1 || value > 50) return null;
  return value;
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

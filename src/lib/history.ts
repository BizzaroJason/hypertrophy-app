import { estimateE1rm } from '../engine/progression';
import type { MuscleGroup } from '../engine/types';
import type { SetLog } from '../db/types';

export interface StrengthPoint {
  key: string;
  at: number;
  week: number;
  label: string;
  e1rm: number;
  weight: number;
  reps: number;
}

export function strengthSeries(sets: SetLog[]): StrengthPoint[] {
  const best = new Map<string, StrengthPoint>();
  for (const set of sets) {
    if (set.status !== 'done' || set.weight == null || set.reps == null) continue;
    const e1rm = estimateE1rm(set.weight, set.reps);
    if (e1rm == null) continue;
    const key = `${set.mesoId}:${set.week}:${set.dayIndex}`;
    const point: StrengthPoint = {
      key,
      at: set.loggedAt ?? set.week * 100 + set.dayIndex,
      week: set.week,
      label: `W${set.week}`,
      e1rm,
      weight: set.weight,
      reps: set.reps,
    };
    const current = best.get(key);
    if (!current || point.e1rm > current.e1rm) best.set(key, point);
  }
  return [...best.values()].sort((a, b) => a.at - b.at);
}

export function volumeByWeek(input: {
  weeks: number;
  sets: SetLog[];
  primary: Map<string, MuscleGroup>;
}): { week: number; total: number; byMuscle: { muscle: MuscleGroup; sets: number }[] }[] {
  return Array.from({ length: input.weeks }, (_, index) => {
    const week = index + 1;
    const counts = new Map<MuscleGroup, number>();
    for (const set of input.sets) {
      if (set.week !== week || set.status !== 'done') continue;
      const muscle = input.primary.get(set.exerciseId);
      if (!muscle) continue;
      counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
    }
    const byMuscle = [...counts.entries()]
      .map(([muscle, setCount]) => ({ muscle, sets: setCount }))
      .sort((a, b) => b.sets - a.sets);
    return {
      week,
      total: byMuscle.reduce((sum, row) => sum + row.sets, 0),
      byMuscle,
    };
  });
}

import {
  buildSessionPlan,
  recommendLoad,
  setsForWeek,
  type LiftInput,
  type PerformedSet,
  type RawFeedback,
  type SessionSetPlan,
} from '../engine/progression';
import type { MuscleGroup } from '../engine/types';
import type { Bundle, Exercise, PlannedExercise, SetLog } from '../db/types';

function trainedMuscles(bundle: Bundle, week: number, dayIndex: number): Set<MuscleGroup> {
  const trained = new Set<MuscleGroup>();
  const day = bundle.days.find((item) => item.index === dayIndex);
  if (!day) return trained;
  const onDay = new Set(bundle.planned.filter((row) => row.dayId === day.id).map((row) => row.exerciseId));
  const byId = new Map(bundle.exercises.map((exercise) => [exercise.id, exercise]));
  for (const set of bundle.sets) {
    if (set.week !== week || set.dayIndex !== dayIndex || set.status !== 'done' || !onDay.has(set.exerciseId)) continue;
    byId.get(set.exerciseId)?.muscles.forEach((muscle) => trained.add(muscle));
  }
  return trained;
}

/** Ratings count only when that muscle was actually trained that day. */
function feedbackByWeek(bundle: Bundle): Record<number, RawFeedback[]> {
  const grouped: Record<number, RawFeedback[]> = {};
  for (const row of bundle.feedback) {
    if (!trainedMuscles(bundle, row.week, row.dayIndex).has(row.muscle)) continue;
    (grouped[row.week] ??= []).push({
      muscle: row.muscle,
      pump: row.pump,
      soreness: row.soreness,
      joint: row.joint,
      workload: row.workload,
    });
  }
  return grouped;
}

function liftsInBlock(bundle: Bundle): LiftInput[] {
  const byId = new Map(bundle.exercises.map((exercise) => [exercise.id, exercise]));
  const dayIndex = new Map(bundle.days.map((day) => [day.id, day.index]));
  return bundle.planned
    .slice()
    .sort((a, b) => (dayIndex.get(a.dayId) ?? 0) - (dayIndex.get(b.dayId) ?? 0) || a.order - b.order)
    .flatMap((row) => {
      const exercise = byId.get(row.exerciseId);
      const primary = exercise?.muscles[0];
      if (!exercise || !primary) return [];
      return [
        {
          id: row.id,
          exerciseId: row.exerciseId,
          primaryMuscle: primary,
          order: (dayIndex.get(row.dayId) ?? 0) * 100 + row.order,
          startingSets: row.startingSets,
          repRange: { min: row.repMin, max: row.repMax },
          equipment: exercise.equipment,
          startingWeight: row.startingWeight,
          startingReps: row.startingReps,
        } satisfies LiftInput,
      ];
    });
}

function countsForWeek(bundle: Bundle, week: number): Map<string, number> {
  return setsForWeek({
    lifts: liftsInBlock(bundle),
    feedbackByWeek: feedbackByWeek(bundle),
    week,
    totalWeeks: bundle.meso.weeks,
  });
}

function toPerformed(set: SetLog): PerformedSet | null {
  if (set.status === 'pending') return null;
  if (set.status === 'skipped') {
    return {
      weight: set.weight ?? 0,
      reps: set.reps ?? 0,
      targetReps: set.targetReps,
      status: 'skipped',
      isCarryOver: set.isCarryOver,
    };
  }
  if (set.weight == null || set.reps == null) return null;
  return {
    weight: set.weight,
    reps: set.reps,
    targetReps: set.targetReps,
    status: 'done',
    isCarryOver: set.isCarryOver,
  };
}

export function planForDay(
  bundle: Bundle,
  week: number,
  dayIndex: number,
  options?: { includeCarries?: boolean },
): SessionSetPlan[] {
  const day = bundle.days.find((item) => item.index === dayIndex);
  if (!day) return [];
  const lifts = liftsInBlock(bundle).filter((lift) => bundle.planned.some((row) => row.id === lift.id && row.dayId === day.id));
  const previousSetsByLift: Record<string, PerformedSet[]> = {};
  for (const lift of lifts) {
    previousSetsByLift[lift.id] = bundle.sets
      .filter((set) => set.plannedExerciseId === lift.id && set.week === week - 1 && set.dayIndex === dayIndex)
      .sort((a, b) => a.setIndex - b.setIndex)
      .flatMap((set) => {
        const performed = toPerformed(set);
        return performed ? [performed] : [];
      });
  }
  const includeCarries = options?.includeCarries !== false;
  return buildSessionPlan({
    week,
    totalWeeks: bundle.meso.weeks,
    lifts,
    previousSetsByLift,
    feedbackByWeek: feedbackByWeek(bundle),
    carries: includeCarries
      ? bundle.carries.map((carry) => ({
          plannedExerciseId: carry.plannedExerciseId,
          sets: carry.sets,
          applied: carry.applied === 1,
        }))
      : [],
    unit: bundle.settings.unit,
    setCounts: countsForWeek(bundle, week),
  });
}

/** Programmed sets per primary muscle for one week, carries excluded. */
export function muscleSetTotals(bundle: Bundle, week: number): Map<MuscleGroup, number> {
  const totals = new Map<MuscleGroup, number>();
  const counts = countsForWeek(bundle, week);
  for (const lift of liftsInBlock(bundle)) {
    totals.set(lift.primaryMuscle, (totals.get(lift.primaryMuscle) ?? 0) + (counts.get(lift.id) ?? 0));
  }
  return totals;
}

export function continuationFor(
  bundle: Bundle,
  planned: PlannedExercise,
  exercise: Exercise,
): { sets: number; weight: number; reps: number } {
  const counts = countsForWeek(bundle, Math.max(1, bundle.meso.weeks - 1));
  const lastWorking = bundle.meso.weeks - 1;
  const history = bundle.sets
    .filter(
      (set) =>
        set.plannedExerciseId === planned.id &&
        set.week <= lastWorking &&
        set.status === 'done' &&
        !set.isCarryOver &&
        set.weight != null &&
        set.reps != null,
    )
    .sort((a, b) => a.week - b.week || a.setIndex - b.setIndex);
  const last = history[history.length - 1];
  const recommendation = recommendLoad({
    last: last
      ? {
          weight: last.weight ?? 0,
          reps: last.reps ?? 0,
          targetReps: last.targetReps,
          status: 'done',
          isCarryOver: false,
        }
      : null,
    repRange: { min: planned.repMin, max: planned.repMax },
    equipment: exercise.equipment,
    unit: bundle.settings.unit,
    deload: false,
    startingWeight: planned.startingWeight,
    startingReps: planned.startingReps,
  });
  return {
    sets: counts.get(planned.id) ?? planned.startingSets,
    weight: recommendation.weight,
    reps: recommendation.reps,
  };
}

export function dayState(
  sets: SetLog[],
  week: number,
  dayIndex: number,
): 'empty' | 'open' | 'done' | 'skipped' {
  const rows = sets.filter((set) => set.week === week && set.dayIndex === dayIndex);
  if (rows.length === 0) return 'empty';
  if (rows.some((set) => set.status === 'pending')) return 'open';
  if (rows.every((set) => set.status === 'skipped')) return 'skipped';
  return 'done';
}

/**
 * Kiln progression rules
 * ---------------------
 * This file is the source of truth. The README summarizes the same behavior.
 *
 * Blocks
 *   A block is 4 to 8 weeks. The last week is always a deload.
 *   Starting a deload early skips the remaining working sessions and opens
 *   the deload week. Ending a block marks every unfinished session skipped
 *   and archives it.
 *
 * Effort (reps in reserve)
 *   Working weeks step down toward 0 on the final working week, capped at 4
 *   so a long block does not open with an easy 6-RIR week.
 *   A 5-week block is therefore 3, 2, 1, 0, then deload.
 *   The deload target is 4 reps in reserve: stop well before it gets hard.
 *   Kiln does not ask you to type RIR after the set. The rep target and the
 *   effort line are the prescription. Missing the rep target holds the load.
 *
 * Load and reps
 *   Each working week looks at the last completed programmed set of that
 *   lift from the previous week (one-time carried sets are ignored).
 *   - Above the top of the rep range: add one equipment step and aim at the
 *     bottom of the range next week.
 *   - On target, and one more rep still fits in the range: next week's rep
 *     target is the reps you performed, plus one. Load stays put.
 *   - On target, but one more rep would leave the range: add one equipment
 *     step and return to the bottom of the range.
 *   - Short of the target: repeat the same load and the same rep target.
 *   The first week uses the starting load and rep target from the builder.
 *   Load you actually lifted is what progresses, even if it differed from
 *   the suggestion.
 *
 * Equipment steps
 *   Pounds: barbell, cable, and machine +5 lb; dumbbell +5 lb.
 *   Kilograms: barbell, cable, and machine +2.5 kg; dumbbell +2 kg.
 *   Bodyweight has no load step. Reps climb to the top of the range and hold.
 *   A step up lands on the next multiple of the increment above the load
 *   you used. A deload takes about 10% off and rounds down to a step,
 *   without rounding a real load down to zero.
 *
 * Sets and feedback
 *   Week 1 uses the set counts chosen in the builder (1 to 6 per lift).
 *   After each session you can rate pump, soreness, joints, and workload
 *   for every muscle that session trained.
 *   Ratings from the same muscle in the same week merge: joints, soreness,
 *   and workload keep the worst score; pump is the rounded average.
 *   The merged rating changes the NEXT working week's sets for lifts whose
 *   primary muscle is that muscle:
 *     painful joints (3)            → −2 sets
 *     uncomfortable joints (2)      → −1
 *     limiting soreness or workload → −1
 *     excessive pump on hard work   → −1
 *     low pump, no soreness, easy   → +1
 *     anything else                 → hold
 *   Joint pain is decided first, so a sore joint never gains a set.
 *   Added sets go to that muscle's primary lift with the fewest sets.
 *   Removed sets come off the primary lift with the most sets.
 *   A lift never leaves the 1–6 range. Muscles that were only secondary
 *   movers do not change a lift's set count; rate the muscle you want to
 *   adjust on a day where it is the primary target, or add a direct lift.
 *   The deload week does not take a feedback bump. It halves the previous
 *   working week's sets, rounded down, with at least 1 set left.
 *
 * Skipped sets
 *   Finishing a session with skipped sets offers to carry them once onto
 *   the next session of that same lift. Carried sets are extra, tagged
 *   one-time, and use that day's target. They are not part of the standing
 *   set count, they do not drive the following week's load, and they do not
 *   appear again unless you skip and carry once more. At most 6 one-time
 *   sets are added to a single session.
 */

import type { Equipment, MuscleGroup, RepRange, Signal, Unit } from './types';

export const MIN_WEEKS = 4;
export const MAX_WEEKS = 8;
export const DELOAD_RIR = 4;
export const MAX_OPENING_RIR = 4;
export const MIN_SETS = 1;
export const MAX_SETS = 6;
export const MAX_CARRY_SETS = 6;
export const DELOAD_LOAD_FACTOR = 0.9;

export type ProgressReason =
  | 'first-session'
  | 'add-rep'
  | 'add-load'
  | 'hold'
  | 'deload'
  | 'top-hold';

export interface PerformedSet {
  weight: number;
  reps: number;
  targetReps: number;
  status: 'done' | 'skipped' | 'pending';
  /** One-time carried sets never move next week's target. */
  isCarryOver?: boolean;
}

export interface LoadRecommendation {
  weight: number;
  reps: number;
  reason: ProgressReason;
}

export interface RawFeedback {
  muscle: MuscleGroup;
  pump: Signal;
  soreness: Signal;
  joint: Signal;
  workload: Signal;
}

export interface LiftInput {
  id: string;
  exerciseId: string;
  primaryMuscle: MuscleGroup;
  order: number;
  startingSets: number;
  repRange: RepRange;
  equipment: Equipment;
  startingWeight: number;
  startingReps: number;
}

export interface SessionSetPlan {
  plannedExerciseId: string;
  exerciseId: string;
  setIndex: number;
  isCarryOver: boolean;
  targetWeight: number;
  targetReps: number;
  targetRir: number;
  reason: ProgressReason;
}

export interface Slot {
  week: number;
  dayIndex: number;
}

function assertBlock(week: number, totalWeeks: number): void {
  if (!Number.isInteger(totalWeeks) || totalWeeks < MIN_WEEKS || totalWeeks > MAX_WEEKS) {
    throw new Error('Blocks run 4 to 8 weeks');
  }
  if (!Number.isInteger(week) || week < 1 || week > totalWeeks) {
    throw new Error('Week is outside this block');
  }
}

export function isDeloadWeek(week: number, totalWeeks: number): boolean {
  assertBlock(week, totalWeeks);
  return week === totalWeeks;
}

/** Reps in reserve for a week. Deload weeks return DELOAD_RIR. */
export function targetRir(week: number, totalWeeks: number): number {
  assertBlock(week, totalWeeks);
  if (week === totalWeeks) return DELOAD_RIR;
  const lastWorkingWeek = totalWeeks - 1;
  const stepsBeforeLastWorking = lastWorkingWeek - week;
  return Math.min(MAX_OPENING_RIR, stepsBeforeLastWorking);
}

export function rirSchedule(totalWeeks: number): { week: number; rir: number; deload: boolean }[] {
  return Array.from({ length: totalWeeks }, (_, index) => {
    const week = index + 1;
    return {
      week,
      rir: targetRir(week, totalWeeks),
      deload: isDeloadWeek(week, totalWeeks),
    };
  });
}

/**
 * One load increase.
 * Barbell / cable / machine: 5 lb or 2.5 kg.
 * Dumbbell: 5 lb or 2 kg (a typical pair-to-pair jump).
 * Bodyweight: no added load.
 */
export function plateIncrement(equipment: Equipment, unit: Unit): number {
  if (equipment === 'bodyweight') return 0;
  if (unit === 'kg') return equipment === 'dumbbell' ? 2 : 2.5;
  return 5;
}

export function suggestedRepRange(equipment: Equipment, compound: boolean): RepRange {
  if (compound && equipment === 'barbell') return { min: 6, max: 10 };
  if (compound) return { min: 8, max: 12 };
  return { min: 10, max: 15 };
}

function cents(value: number): number {
  return Math.round(value * 100);
}

export function roundLoad(value: number): number {
  return cents(value) / 100;
}

/** Next increment above `weight`. 137 lb with a 5 lb step becomes 140. */
export function bumpLoad(weight: number, increment: number): number {
  const safe = Math.max(0, weight);
  if (increment <= 0) return roundLoad(safe);
  const inc = cents(increment);
  const steps = Math.floor(cents(safe) / inc) + 1;
  return (steps * inc) / 100;
}

/** About 10% off, rounded down to a plate step. Never drops a real load to 0. */
export function easeLoad(weight: number, increment: number): number {
  const safe = Math.max(0, weight);
  if (safe === 0) return 0;
  const lighter = cents(safe * DELOAD_LOAD_FACTOR);
  if (increment <= 0) return lighter / 100;
  const inc = cents(increment);
  let steps = Math.floor(lighter / inc);
  if (steps < 1) steps = 1;
  return (steps * inc) / 100;
}

function normalizeRange(range: RepRange): RepRange {
  const min = Math.max(1, Math.round(range.min));
  const max = Math.max(min, Math.round(range.max));
  return { min, max };
}

function clampReps(reps: number, range: RepRange): number {
  if (!Number.isFinite(reps) || reps < range.min) return range.min;
  if (reps > range.max) return range.max;
  return Math.round(reps);
}

export function recommendLoad(input: {
  last: PerformedSet | null;
  repRange: RepRange;
  equipment: Equipment;
  unit: Unit;
  deload: boolean;
  startingWeight: number;
  startingReps: number;
}): LoadRecommendation {
  const range = normalizeRange(input.repRange);
  const increment = plateIncrement(input.equipment, input.unit);
  const startingWeight = Math.max(0, roundLoad(input.startingWeight || 0));

  if (input.deload) {
    const base = input.last && input.last.status === 'done' ? Math.max(0, input.last.weight) : startingWeight;
    return {
      weight: easeLoad(base, increment),
      reps: range.min,
      reason: 'deload',
    };
  }

  if (!input.last || input.last.status !== 'done') {
    return {
      weight: startingWeight,
      reps: clampReps(input.startingReps, range),
      reason: 'first-session',
    };
  }

  const weight = Math.max(0, roundLoad(input.last.weight));
  const reps = input.last.reps;
  const hitTarget = reps >= input.last.targetReps;

  if (reps > range.max || (hitTarget && reps + 1 > range.max)) {
    if (increment <= 0) {
      return { weight, reps: range.max, reason: 'top-hold' };
    }
    return { weight: bumpLoad(weight, increment), reps: range.min, reason: 'add-load' };
  }

  if (hitTarget) {
    return { weight, reps: reps + 1, reason: 'add-rep' };
  }

  return {
    weight,
    reps: clampReps(input.last.targetReps, range),
    reason: 'hold',
  };
}

/** Last completed programmed set. Carried and skipped sets do not qualify. */
export function progressionBasis(sets: PerformedSet[]): PerformedSet | null {
  const done = sets.filter((set) => set.status === 'done' && !set.isCarryOver);
  return done.length > 0 ? done[done.length - 1] : null;
}

function asSignal(value: number): Signal {
  return Math.max(0, Math.min(3, Math.round(value))) as Signal;
}

export function mergeFeedback(rows: RawFeedback[]): RawFeedback[] {
  const grouped = new Map<MuscleGroup, RawFeedback[]>();
  for (const row of rows) {
    const list = grouped.get(row.muscle) ?? [];
    list.push(row);
    grouped.set(row.muscle, list);
  }
  return [...grouped.entries()].map(([muscle, list]) => ({
    muscle,
    pump: asSignal(list.reduce((sum, row) => sum + row.pump, 0) / list.length),
    soreness: asSignal(Math.max(...list.map((row) => row.soreness))),
    joint: asSignal(Math.max(...list.map((row) => row.joint))),
    workload: asSignal(Math.max(...list.map((row) => row.workload))),
  }));
}

/**
 * Set change for one muscle before the next working week.
 * Returns -2, -1, 0, or +1. Joint pain is resolved before any increase.
 */
export function volumeDelta(feedback: RawFeedback): number {
  if (feedback.joint >= 3) return -2;
  if (feedback.joint >= 2) return -1;
  if (feedback.soreness >= 3 || feedback.workload >= 3) return -1;
  if (feedback.pump >= 3 && feedback.workload >= 2) return -1;
  if (feedback.pump === 0 && feedback.soreness === 0 && feedback.workload === 0) return 1;
  return 0;
}

export function distributeSetDelta<T extends { id: string; primaryMuscle: MuscleGroup; sets: number; order: number }>(
  lifts: T[],
  muscle: MuscleGroup,
  delta: number,
): T[] {
  const next = lifts.map((lift) => ({ ...lift }));
  const apply = (direction: 1 | -1) => {
    const pool = next.filter((lift) => lift.primaryMuscle === muscle);
    const ranked = [...pool].sort((a, b) => {
      if (a.sets !== b.sets) return direction === 1 ? a.sets - b.sets : b.sets - a.sets;
      return direction === 1 ? a.order - b.order : b.order - a.order;
    });
    const choice = ranked.find((lift) => {
      const updated = lift.sets + direction;
      return updated >= MIN_SETS && updated <= MAX_SETS;
    });
    if (choice) choice.sets += direction;
  };
  const direction: 1 | -1 = delta > 0 ? 1 : -1;
  for (let step = 0; step < Math.abs(delta); step += 1) apply(direction);
  return next;
}

export function setsForWeek(input: {
  lifts: Pick<LiftInput, 'id' | 'primaryMuscle' | 'startingSets' | 'order'>[];
  feedbackByWeek: Record<number, RawFeedback[]>;
  week: number;
  totalWeeks: number;
}): Map<string, number> {
  assertBlock(input.week, input.totalWeeks);
  let counts = input.lifts.map((lift) => ({
    id: lift.id,
    primaryMuscle: lift.primaryMuscle,
    sets: Math.max(MIN_SETS, Math.min(MAX_SETS, Math.round(lift.startingSets))),
    order: lift.order,
  }));

  // Fold feedback forward through the last week that still changes this one.
  // A deload request folds through the final working week, then halves.
  const through = input.week === input.totalWeeks ? input.totalWeeks - 1 : input.week;
  for (let loggedWeek = 1; loggedWeek < through; loggedWeek += 1) {
    const merged = mergeFeedback(input.feedbackByWeek[loggedWeek] ?? []);
    for (const feedback of merged) {
      const delta = volumeDelta(feedback);
      if (delta !== 0) counts = distributeSetDelta(counts, feedback.muscle, delta);
    }
  }

  if (input.week === input.totalWeeks) {
    counts = counts.map((lift) => ({
      ...lift,
      sets: Math.max(MIN_SETS, Math.floor(lift.sets / 2)),
    }));
  }

  return new Map(counts.map((lift) => [lift.id, lift.sets]));
}

export function extraSetsFor(
  plannedExerciseId: string,
  carries: { plannedExerciseId: string; sets: number; applied: boolean }[],
): number {
  const total = carries
    .filter((carry) => carry.plannedExerciseId === plannedExerciseId && !carry.applied)
    .reduce((sum, carry) => sum + Math.max(0, carry.sets), 0);
  return Math.min(MAX_CARRY_SETS, total);
}

export function buildSessionPlan(input: {
  week: number;
  totalWeeks: number;
  lifts: LiftInput[];
  previousSetsByLift: Record<string, PerformedSet[]>;
  feedbackByWeek: Record<number, RawFeedback[]>;
  carries: { plannedExerciseId: string; sets: number; applied: boolean }[];
  unit: Unit;
  /**
   * Programmed sets for the whole week. Pass this when a muscle is trained
   * on more than one day, so a +1 set is applied once across the week.
   */
  setCounts?: Map<string, number>;
}): SessionSetPlan[] {
  const setCounts =
    input.setCounts ??
    setsForWeek({
      lifts: input.lifts,
      feedbackByWeek: input.feedbackByWeek,
      week: input.week,
      totalWeeks: input.totalWeeks,
    });
  const rir = targetRir(input.week, input.totalWeeks);
  const deload = isDeloadWeek(input.week, input.totalWeeks);
  const lifts = [...input.lifts].sort((a, b) => a.order - b.order);
  const plans: SessionSetPlan[] = [];

  for (const lift of lifts) {
    const count = setCounts.get(lift.id) ?? MIN_SETS;
    const recommendation = recommendLoad({
      last: progressionBasis(input.previousSetsByLift[lift.id] ?? []),
      repRange: lift.repRange,
      equipment: lift.equipment,
      unit: input.unit,
      deload,
      startingWeight: lift.startingWeight,
      startingReps: lift.startingReps,
    });
    for (let setIndex = 0; setIndex < count; setIndex += 1) {
      plans.push({
        plannedExerciseId: lift.id,
        exerciseId: lift.exerciseId,
        setIndex,
        isCarryOver: false,
        targetWeight: recommendation.weight,
        targetReps: recommendation.reps,
        targetRir: rir,
        reason: recommendation.reason,
      });
    }
    const extra = extraSetsFor(lift.id, input.carries);
    for (let offset = 0; offset < extra; offset += 1) {
      plans.push({
        plannedExerciseId: lift.id,
        exerciseId: lift.exerciseId,
        setIndex: count + offset,
        isCarryOver: true,
        targetWeight: recommendation.weight,
        targetReps: recommendation.reps,
        targetRir: rir,
        reason: recommendation.reason,
      });
    }
  }

  return plans;
}

export function skippedSetGroups(
  sets: { exerciseId: string; plannedExerciseId: string; status: string }[],
): { exerciseId: string; plannedExerciseId: string; skippedSets: number }[] {
  const grouped = new Map<string, { exerciseId: string; plannedExerciseId: string; skippedSets: number }>();
  for (const set of sets) {
    if (set.status !== 'skipped') continue;
    const current = grouped.get(set.plannedExerciseId) ?? {
      exerciseId: set.exerciseId,
      plannedExerciseId: set.plannedExerciseId,
      skippedSets: 0,
    };
    current.skippedSets += 1;
    grouped.set(set.plannedExerciseId, current);
  }
  return [...grouped.values()];
}

export function nextOpenSlot(input: {
  totalWeeks: number;
  daysPerWeek: number;
  logs: { week: number; dayIndex: number; status: 'pending' | 'done' | 'skipped' }[];
}): { week: number; dayIndex: number; resume: boolean } | null {
  for (let week = 1; week <= input.totalWeeks; week += 1) {
    for (let dayIndex = 0; dayIndex < input.daysPerWeek; dayIndex += 1) {
      const rows = input.logs.filter((log) => log.week === week && log.dayIndex === dayIndex);
      if (rows.length === 0) return { week, dayIndex, resume: false };
      if (rows.some((row) => row.status === 'pending')) return { week, dayIndex, resume: true };
    }
  }
  return null;
}

/**
 * Unfinished sessions from `from` onward.
 * `finished` days already have every set done or skipped and are left alone.
 * Early deload keeps the final week so it can still be trained.
 */
export function slotsToSkip(input: {
  totalWeeks: number;
  daysPerWeek: number;
  finished: Slot[];
  from: Slot;
  mode: 'end' | 'early-deload';
}): Slot[] {
  const finished = new Set(input.finished.map((slot) => `${slot.week}:${slot.dayIndex}`));
  const slots: Slot[] = [];
  for (let week = 1; week <= input.totalWeeks; week += 1) {
    for (let dayIndex = 0; dayIndex < input.daysPerWeek; dayIndex += 1) {
      const before =
        week < input.from.week || (week === input.from.week && dayIndex < input.from.dayIndex);
      if (before) continue;
      if (finished.has(`${week}:${dayIndex}`)) continue;
      if (input.mode === 'early-deload' && week === input.totalWeeks) continue;
      slots.push({ week, dayIndex });
    }
  }
  return slots;
}

/** Best set e1RM. Epley: weight × (1 + reps / 30). Reps of 1 are the load itself. */
export function estimateE1rm(weight: number, reps: number): number | null {
  if (!(weight > 0) || !(reps > 0)) return null;
  if (reps === 1) return roundLoad(weight);
  return roundLoad(weight * (1 + reps / 30));
}

import type { Equipment, MuscleGroup, Signal, Unit } from '../engine/types';

export interface Exercise {
  id: string;
  name: string;
  /** First entry is the primary muscle. Set changes follow the primary. */
  muscles: MuscleGroup[];
  equipment: Equipment;
  compound: boolean;
  custom: boolean;
  createdAt: number;
}

export interface Mesocycle {
  id: string;
  name: string;
  weeks: number;
  daysPerWeek: number;
  status: 'active' | 'archived';
  createdAt: number;
  startedAt: number;
  endedAt: number | null;
  earlyDeload: boolean;
}

export interface MesoDay {
  id: string;
  mesoId: string;
  index: number;
  name: string;
}

export interface PlannedExercise {
  id: string;
  mesoId: string;
  dayId: string;
  exerciseId: string;
  order: number;
  startingSets: number;
  repMin: number;
  repMax: number;
  startingWeight: number;
  startingReps: number;
}

export interface SetLog {
  id: string;
  mesoId: string;
  week: number;
  dayIndex: number;
  plannedExerciseId: string;
  exerciseId: string;
  setIndex: number;
  targetWeight: number;
  targetReps: number;
  targetRir: number;
  reason: string;
  weight: number | null;
  reps: number | null;
  status: 'pending' | 'done' | 'skipped';
  isCarryOver: boolean;
  loggedAt: number | null;
}

export interface FeedbackRow {
  id: string;
  mesoId: string;
  week: number;
  dayIndex: number;
  muscle: MuscleGroup;
  pump: Signal;
  soreness: Signal;
  joint: Signal;
  workload: Signal;
}

export interface CarryOver {
  id: string;
  mesoId: string;
  plannedExerciseId: string;
  exerciseId: string;
  sets: number;
  /** 0 until the next session of this lift absorbs the sets. */
  applied: 0 | 1;
  createdAt: number;
  appliedAt: number | null;
}

export interface Settings {
  id: 'app';
  unit: Unit;
  restCompound: number;
  restIsolation: number;
}

export interface Bundle {
  meso: Mesocycle;
  days: MesoDay[];
  planned: PlannedExercise[];
  sets: SetLog[];
  feedback: FeedbackRow[];
  carries: CarryOver[];
  exercises: Exercise[];
  settings: Settings;
}

export interface DraftLift {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  startingWeight: number;
  startingReps: number;
}

export interface DraftDay {
  name: string;
  lifts: DraftLift[];
}

export interface DraftBlock {
  name: string;
  weeks: number;
  days: DraftDay[];
}

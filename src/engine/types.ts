/** Shared training vocabulary. Progression rules live in progression.ts. */

export const MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'traps',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'biceps',
  'triceps',
  'calves',
  'abs',
  'forearms',
] as const;

export type MuscleGroup = (typeof MUSCLES)[number];

export const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'] as const;

export type Equipment = (typeof EQUIPMENT)[number];

export type Unit = 'lb' | 'kg';

/** 0 is the low end of a scale, 3 is the high end. See volumeDelta. */
export type Signal = 0 | 1 | 2 | 3;

export interface RepRange {
  min: number;
  max: number;
}

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  traps: 'Traps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  adductors: 'Adductors',
  biceps: 'Biceps',
  triceps: 'Triceps',
  calves: 'Calves',
  abs: 'Abs',
  forearms: 'Forearms',
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
};

import Dexie, { type Table } from 'dexie';
import { SEED } from './seed';
import type { CarryOver, Exercise, FeedbackRow, MesoDay, Mesocycle, PlannedExercise, SetLog, Settings } from './types';

export class KilnDB extends Dexie {
  exercises!: Table<Exercise, string>;
  mesocycles!: Table<Mesocycle, string>;
  days!: Table<MesoDay, string>;
  planned!: Table<PlannedExercise, string>;
  sets!: Table<SetLog, string>;
  feedback!: Table<FeedbackRow, string>;
  carries!: Table<CarryOver, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('kiln');
    this.version(1).stores({
      exercises: 'id, name, custom',
      mesocycles: 'id, status, createdAt',
      days: 'id, mesoId',
      planned: 'id, mesoId, dayId, exerciseId',
      sets: 'id, mesoId, exerciseId, plannedExerciseId',
      feedback: 'id, mesoId',
      carries: 'id, mesoId, applied',
      settings: 'id',
    });
  }
}

export const db = new KilnDB();

export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get('app');
  if (existing) return existing;
  const fresh: Settings = { id: 'app', unit: 'lb', restCompound: 150, restIsolation: 90 };
  await db.settings.add(fresh);
  return fresh;
}

export async function ensureReady(): Promise<void> {
  const exerciseCount = await db.exercises.count();
  if (exerciseCount === 0) await db.exercises.bulkAdd(SEED);
  await getSettings();
}

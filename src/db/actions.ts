import { nextOpenSlot, slotsToSkip, type SessionSetPlan } from '../engine/progression';
import type { MuscleGroup, Signal } from '../engine/types';
import { continuationFor, planForDay } from '../lib/planForDay';
import { db, ensureReady, getSettings } from './db';
import type {
  Bundle,
  CarryOver,
  DraftBlock,
  Exercise,
  FeedbackRow,
  MesoDay,
  Mesocycle,
  PlannedExercise,
  SetLog,
  Settings,
} from './types';

const BLOCK_TABLES = [
  db.mesocycles,
  db.days,
  db.planned,
  db.sets,
  db.feedback,
  db.carries,
  db.exercises,
  db.settings,
] as const;

export async function readBundle(mesoId: string): Promise<Bundle | null> {
  const meso = await db.mesocycles.get(mesoId);
  if (!meso) return null;
  const [days, planned, sets, feedback, carries, exercises, settings] = await Promise.all([
    db.days.where('mesoId').equals(mesoId).toArray(),
    db.planned.where('mesoId').equals(mesoId).toArray(),
    db.sets.where('mesoId').equals(mesoId).toArray(),
    db.feedback.where('mesoId').equals(mesoId).toArray(),
    db.carries.where('mesoId').equals(mesoId).toArray(),
    db.exercises.toArray(),
    getSettings(),
  ]);
  days.sort((a, b) => a.index - b.index);
  planned.sort((a, b) => a.order - b.order);
  sets.sort((a, b) => a.setIndex - b.setIndex);
  return { meso, days, planned, sets, feedback, carries, exercises, settings };
}

export async function activeBundle(): Promise<Bundle | null> {
  const active = await db.mesocycles.filter((meso) => meso.status === 'active').first();
  if (!active) return null;
  return readBundle(active.id);
}

function newId(): string {
  return crypto.randomUUID();
}

function pendingRow(mesoId: string, week: number, dayIndex: number, plan: SessionSetPlan, status: SetLog['status']): SetLog {
  return {
    id: newId(),
    mesoId,
    week,
    dayIndex,
    plannedExerciseId: plan.plannedExerciseId,
    exerciseId: plan.exerciseId,
    setIndex: plan.setIndex,
    targetWeight: plan.targetWeight,
    targetReps: plan.targetReps,
    targetRir: plan.targetRir,
    reason: plan.reason,
    weight: null,
    reps: null,
    status,
    isCarryOver: plan.isCarryOver,
    loggedAt: status === 'pending' ? null : Date.now(),
  };
}

export async function createBlock(draft: DraftBlock): Promise<string> {
  const id = newId();
  const now = Date.now();
  await db.transaction('rw', [db.mesocycles, db.days, db.planned], async () => {
    const active = await db.mesocycles.filter((meso) => meso.status === 'active').count();
    if (active > 0) throw new Error('End the current block before starting another.');
    await db.mesocycles.add({
      id,
      name: draft.name.trim(),
      weeks: draft.weeks,
      daysPerWeek: draft.days.length,
      status: 'active',
      createdAt: now,
      startedAt: now,
      endedAt: null,
      earlyDeload: false,
    });
    for (let index = 0; index < draft.days.length; index += 1) {
      const day = draft.days[index];
      const dayId = newId();
      await db.days.add({ id: dayId, mesoId: id, index, name: day.name.trim() });
      for (let order = 0; order < day.lifts.length; order += 1) {
        const lift = day.lifts[order];
        await db.planned.add({
          id: newId(),
          mesoId: id,
          dayId,
          exerciseId: lift.exerciseId,
          order,
          startingSets: lift.sets,
          repMin: lift.repMin,
          repMax: lift.repMax,
          startingWeight: lift.startingWeight,
          startingReps: lift.startingReps,
        });
      }
    }
  });
  return id;
}

export async function draftFromBlock(mesoId: string): Promise<DraftBlock | null> {
  const bundle = await readBundle(mesoId);
  if (!bundle) return null;
  const exercises = new Map(bundle.exercises.map((exercise) => [exercise.id, exercise]));
  return {
    name: `${bundle.meso.name} · next`,
    weeks: bundle.meso.weeks,
    days: bundle.days.map((day) => ({
      name: day.name,
      lifts: bundle.planned
        .filter((row) => row.dayId === day.id)
        .sort((a, b) => a.order - b.order)
        .flatMap((row) => {
          const exercise = exercises.get(row.exerciseId);
          if (!exercise) return [];
          const next = continuationFor(bundle, row, exercise);
          return [
            {
              exerciseId: row.exerciseId,
              sets: next.sets,
              repMin: row.repMin,
              repMax: row.repMax,
              startingWeight: next.weight,
              startingReps: next.reps,
            },
          ];
        }),
    })),
  };
}

export async function ensureSession(mesoId: string, week: number, dayIndex: number): Promise<void> {
  await db.transaction('rw', [...BLOCK_TABLES], async () => {
    const bundle = await readBundle(mesoId);
    if (!bundle || bundle.meso.status !== 'active') return;
    if (week < 1 || week > bundle.meso.weeks || dayIndex < 0 || dayIndex >= bundle.meso.daysPerWeek) return;
    const exists = bundle.sets.some((set) => set.week === week && set.dayIndex === dayIndex);
    if (exists) return;
    const plans = planForDay(bundle, week, dayIndex, { includeCarries: true });
    if (plans.length === 0) return;
    await db.sets.bulkAdd(plans.map((plan) => pendingRow(mesoId, week, dayIndex, plan, 'pending')));
    const used = new Set(plans.filter((plan) => plan.isCarryOver).map((plan) => plan.plannedExerciseId));
    const now = Date.now();
    for (const carry of bundle.carries) {
      if (carry.applied === 0 && used.has(carry.plannedExerciseId)) {
        await db.carries.update(carry.id, { applied: 1, appliedAt: now });
      }
    }
  });
}

export async function markSet(
  id: string,
  patch: { status: SetLog['status']; weight: number | null; reps: number | null },
): Promise<void> {
  await db.sets.update(id, {
    status: patch.status,
    weight: patch.weight,
    reps: patch.reps,
    loggedAt: patch.status === 'pending' ? null : Date.now(),
  });
}

export async function addCarries(
  mesoId: string,
  groups: { exerciseId: string; plannedExerciseId: string; sets: number }[],
): Promise<void> {
  const rows: CarryOver[] = groups
    .filter((group) => group.sets > 0)
    .map((group) => ({
      id: newId(),
      mesoId,
      plannedExerciseId: group.plannedExerciseId,
      exerciseId: group.exerciseId,
      sets: group.sets,
      applied: 0,
      createdAt: Date.now(),
      appliedAt: null,
    }));
  if (rows.length) await db.carries.bulkAdd(rows);
}

export async function saveFeedback(
  mesoId: string,
  week: number,
  dayIndex: number,
  rows: { muscle: MuscleGroup; pump: Signal; soreness: Signal; joint: Signal; workload: Signal }[],
): Promise<void> {
  await db.transaction('rw', db.feedback, async () => {
    const existing = await db.feedback
      .where('mesoId')
      .equals(mesoId)
      .filter((row) => row.week === week && row.dayIndex === dayIndex)
      .toArray();
    if (existing.length) await db.feedback.bulkDelete(existing.map((row) => row.id));
    const next: FeedbackRow[] = rows.map((row) => ({
      id: newId(),
      mesoId,
      week,
      dayIndex,
      muscle: row.muscle,
      pump: row.pump,
      soreness: row.soreness,
      joint: row.joint,
      workload: row.workload,
    }));
    if (next.length) await db.feedback.bulkAdd(next);
  });
}

function finishedSlots(sets: SetLog[]) {
  const groups = new Map<string, SetLog[]>();
  for (const set of sets) {
    const key = `${set.week}:${set.dayIndex}`;
    const list = groups.get(key) ?? [];
    list.push(set);
    groups.set(key, list);
  }
  const slots: { week: number; dayIndex: number }[] = [];
  for (const [key, list] of groups) {
    if (list.every((set) => set.status === 'done' || set.status === 'skipped')) {
      const [week, dayIndex] = key.split(':').map(Number);
      slots.push({ week, dayIndex });
    }
  }
  return slots;
}

export async function skipRemaining(mesoId: string, mode: 'end' | 'early-deload'): Promise<void> {
  await db.transaction('rw', [...BLOCK_TABLES], async () => {
    const bundle = await readBundle(mesoId);
    if (!bundle || bundle.meso.status !== 'active') return;
    const open = nextOpenSlot({
      totalWeeks: bundle.meso.weeks,
      daysPerWeek: bundle.meso.daysPerWeek,
      logs: bundle.sets,
    });
    if (open) {
      const slots = slotsToSkip({
        totalWeeks: bundle.meso.weeks,
        daysPerWeek: bundle.meso.daysPerWeek,
        finished: finishedSlots(bundle.sets),
        from: { week: open.week, dayIndex: open.dayIndex },
        mode,
      });
      for (const slot of slots) {
        const existing = bundle.sets.filter((set) => set.week === slot.week && set.dayIndex === slot.dayIndex);
        if (existing.length === 0) {
          const plans = planForDay(bundle, slot.week, slot.dayIndex, { includeCarries: false });
          await db.sets.bulkAdd(plans.map((plan) => pendingRow(mesoId, slot.week, slot.dayIndex, plan, 'skipped')));
        } else {
          for (const set of existing) {
            if (set.status === 'pending') {
              await db.sets.update(set.id, { status: 'skipped', loggedAt: Date.now() });
            }
          }
        }
      }
    }
    if (mode === 'end') {
      await db.mesocycles.update(mesoId, { status: 'archived', endedAt: Date.now() });
    } else {
      await db.mesocycles.update(mesoId, { earlyDeload: true });
    }
  });
}

async function deleteRows(mesoId: string): Promise<void> {
  const [days, planned, sets, feedback, carries] = await Promise.all([
    db.days.where('mesoId').equals(mesoId).toArray(),
    db.planned.where('mesoId').equals(mesoId).toArray(),
    db.sets.where('mesoId').equals(mesoId).toArray(),
    db.feedback.where('mesoId').equals(mesoId).toArray(),
    db.carries.where('mesoId').equals(mesoId).toArray(),
  ]);
  await db.days.bulkDelete(days.map((row) => row.id));
  await db.planned.bulkDelete(planned.map((row) => row.id));
  await db.sets.bulkDelete(sets.map((row) => row.id));
  await db.feedback.bulkDelete(feedback.map((row) => row.id));
  await db.carries.bulkDelete(carries.map((row) => row.id));
  await db.mesocycles.delete(mesoId);
}

export async function discardActive(mesoId: string): Promise<void> {
  await db.transaction('rw', [...BLOCK_TABLES], async () => {
    const meso = await db.mesocycles.get(mesoId);
    if (!meso || meso.status !== 'active') return;
    const logged = await db.sets.where('mesoId').equals(mesoId).count();
    if (logged > 0) throw new Error('This block already has logs. End it instead.');
    await deleteRows(mesoId);
  });
}

export async function deleteArchive(mesoId: string): Promise<void> {
  await db.transaction('rw', [...BLOCK_TABLES], async () => {
    const meso = await db.mesocycles.get(mesoId);
    if (!meso || meso.status !== 'archived') return;
    await deleteRows(mesoId);
  });
}

export async function addExercise(input: Omit<Exercise, 'id' | 'custom' | 'createdAt'>): Promise<string> {
  const id = newId();
  await db.exercises.add({ ...input, id, custom: true, createdAt: Date.now() });
  return id;
}

export async function deleteExercise(id: string): Promise<void> {
  const exercise = await db.exercises.get(id);
  if (!exercise?.custom) return;
  const used = await db.planned.where('exerciseId').equals(id).count();
  if (used > 0) throw new Error('This lift is in a block, so it stays in the library.');
  await db.exercises.delete(id);
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'app' });
}

export interface BackupFile {
  app: 'kiln';
  version: 1;
  exportedAt: string;
  exercises: Exercise[];
  mesocycles: Mesocycle[];
  days: MesoDay[];
  planned: PlannedExercise[];
  sets: SetLog[];
  feedback: FeedbackRow[];
  carries: CarryOver[];
  settings: Settings | null;
}

export async function exportBackup(): Promise<BackupFile> {
  const [exercises, mesocycles, days, planned, sets, feedback, carries, settings] = await Promise.all([
    db.exercises.toArray(),
    db.mesocycles.toArray(),
    db.days.toArray(),
    db.planned.toArray(),
    db.sets.toArray(),
    db.feedback.toArray(),
    db.carries.toArray(),
    db.settings.get('app'),
  ]);
  return {
    app: 'kiln',
    version: 1,
    exportedAt: new Date().toISOString(),
    exercises,
    mesocycles,
    days,
    planned,
    sets,
    feedback,
    carries,
    settings: settings ?? null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseBackup(value: unknown): BackupFile {
  if (!isRecord(value) || value.app !== 'kiln' || value.version !== 1) {
    throw new Error('This file is not a Kiln backup.');
  }
  const keys = ['exercises', 'mesocycles', 'days', 'planned', 'sets', 'feedback', 'carries'] as const;
  for (const key of keys) {
    if (!Array.isArray(value[key])) throw new Error('This backup is missing data.');
  }
  return value as unknown as BackupFile;
}

export async function importBackup(value: unknown): Promise<void> {
  const data = parseBackup(value);
  await db.transaction('rw', [...BLOCK_TABLES], async () => {
    await db.exercises.clear();
    await db.mesocycles.clear();
    await db.days.clear();
    await db.planned.clear();
    await db.sets.clear();
    await db.feedback.clear();
    await db.carries.clear();
    await db.settings.clear();
    if (data.exercises.length) await db.exercises.bulkAdd(data.exercises);
    if (data.mesocycles.length) await db.mesocycles.bulkAdd(data.mesocycles);
    if (data.days.length) await db.days.bulkAdd(data.days);
    if (data.planned.length) await db.planned.bulkAdd(data.planned);
    if (data.sets.length) await db.sets.bulkAdd(data.sets);
    if (data.feedback.length) await db.feedback.bulkAdd(data.feedback);
    if (data.carries.length) await db.carries.bulkAdd(data.carries);
    if (data.settings) await db.settings.put({ ...data.settings, id: 'app' });
  });
  await ensureReady();
}

export async function listBlocks(): Promise<Mesocycle[]> {
  const rows = await db.mesocycles.toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

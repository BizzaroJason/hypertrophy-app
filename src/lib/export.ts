import type { Unit } from '../engine/types';
import type { Exercise, Mesocycle, MesoDay, SetLog } from '../db/types';

export interface CsvInput {
  sets: SetLog[];
  blocks: Mesocycle[];
  days: MesoDay[];
  exercises: Exercise[];
  unit: Unit;
}

function cell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function setsToCsv(input: CsvInput): string {
  const blocks = new Map(input.blocks.map((block) => [block.id, block]));
  const days = new Map(input.days.map((day) => [`${day.mesoId}:${day.index}`, day.name]));
  const exercises = new Map(input.exercises.map((exercise) => [exercise.id, exercise.name]));
  const header = [
    'date',
    'block',
    'week',
    'day',
    'exercise',
    'set_number',
    'target_weight',
    'target_reps',
    'target_rir',
    'weight',
    'reps',
    'status',
    'one_time',
    'unit',
    'note',
  ];
  const lines = [header.join(',')];
  const sorted = [...input.sets].sort((a, b) => (a.loggedAt ?? 0) - (b.loggedAt ?? 0) || a.week - b.week || a.setIndex - b.setIndex);
  for (const set of sorted) {
    const date = set.loggedAt ? new Date(set.loggedAt).toISOString() : '';
    lines.push(
      [
        cell(date),
        cell(blocks.get(set.mesoId)?.name ?? ''),
        cell(set.week),
        cell(days.get(`${set.mesoId}:${set.dayIndex}`) ?? `Day ${set.dayIndex + 1}`),
        cell(exercises.get(set.exerciseId) ?? ''),
        cell(set.setIndex + 1),
        cell(set.targetWeight),
        cell(set.targetReps),
        cell(set.targetRir),
        cell(set.weight),
        cell(set.reps),
        cell(set.status),
        cell(set.isCarryOver ? 'yes' : 'no'),
        cell(input.unit),
        cell(set.reason),
      ].join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}\n`;
}

export async function saveTextFile(filename: string, mime: string, contents: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([contents], filename, { type: mime });
  try {
    if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
  }
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return 'downloaded';
}

import { describe, expect, it } from 'vitest';
import type { Bundle } from '../db/types';
import { muscleSetTotals } from './planForDay';

function bundle(): Bundle {
  return {
    meso: {
      id: 'm',
      name: 'Test',
      weeks: 5,
      daysPerWeek: 2,
      status: 'active',
      createdAt: 1,
      startedAt: 1,
      endedAt: null,
      earlyDeload: false,
    },
    days: [
      { id: 'd0', mesoId: 'm', index: 0, name: 'A' },
      { id: 'd1', mesoId: 'm', index: 1, name: 'B' },
    ],
    planned: [
      {
        id: 'bench',
        mesoId: 'm',
        dayId: 'd0',
        exerciseId: 'bb-bench',
        order: 0,
        startingSets: 3,
        repMin: 6,
        repMax: 10,
        startingWeight: 135,
        startingReps: 6,
      },
      {
        id: 'incline',
        mesoId: 'm',
        dayId: 'd1',
        exerciseId: 'db-incline',
        order: 0,
        startingSets: 3,
        repMin: 8,
        repMax: 12,
        startingWeight: 40,
        startingReps: 8,
      },
    ],
    sets: [
      {
        id: 's1',
        mesoId: 'm',
        week: 1,
        dayIndex: 0,
        plannedExerciseId: 'bench',
        exerciseId: 'bb-bench',
        setIndex: 0,
        targetWeight: 135,
        targetReps: 6,
        targetRir: 3,
        reason: 'first-session',
        weight: 135,
        reps: 8,
        status: 'done',
        isCarryOver: false,
        loggedAt: 2,
      },
    ],
    feedback: [
      { id: 'f1', mesoId: 'm', week: 1, dayIndex: 0, muscle: 'chest', pump: 0, soreness: 0, joint: 0, workload: 0 },
      { id: 'f2', mesoId: 'm', week: 1, dayIndex: 1, muscle: 'chest', pump: 1, soreness: 1, joint: 0, workload: 1 },
    ],
    carries: [],
    exercises: [
      {
        id: 'bb-bench',
        name: 'Bench Press',
        muscles: ['chest', 'triceps', 'shoulders'],
        equipment: 'barbell',
        compound: true,
        custom: false,
        createdAt: 0,
      },
      {
        id: 'db-incline',
        name: 'Dumbbell Incline Press',
        muscles: ['chest', 'shoulders'],
        equipment: 'dumbbell',
        compound: true,
        custom: false,
        createdAt: 0,
      },
    ],
    settings: { id: 'app', unit: 'lb', restCompound: 150, restIsolation: 90 },
  };
}

describe('ratings from days that were not trained', () => {
  it('ignores a skipped day so it cannot cancel an under-stimulated muscle', () => {
    const totals = muscleSetTotals(bundle(), 2);
    expect(totals.get('chest')).toBe(7);
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildSessionPlan,
  bumpLoad,
  distributeSetDelta,
  easeLoad,
  estimateE1rm,
  extraSetsFor,
  isDeloadWeek,
  mergeFeedback,
  nextOpenSlot,
  plateIncrement,
  progressionBasis,
  recommendLoad,
  rirSchedule,
  setsForWeek,
  skippedSetGroups,
  slotsToSkip,
  suggestedRepRange,
  targetRir,
  volumeDelta,
  type LiftInput,
  type PerformedSet,
  type RawFeedback,
} from './progression';

const range = { min: 8, max: 12 };

function performed(partial: Partial<PerformedSet> & Pick<PerformedSet, 'reps' | 'targetReps'>): PerformedSet {
  return {
    weight: 100,
    status: 'done',
    isCarryOver: false,
    ...partial,
  };
}

function lift(partial: Partial<LiftInput> = {}): LiftInput {
  return {
    id: 'bench',
    exerciseId: 'bb-bench',
    primaryMuscle: 'chest',
    order: 0,
    startingSets: 3,
    repRange: { min: 6, max: 10 },
    equipment: 'barbell',
    startingWeight: 135,
    startingReps: 6,
    ...partial,
  };
}

describe('reps in reserve', () => {
  it('steps a 5-week block down 3, 2, 1, 0, then an easy deload', () => {
    expect(rirSchedule(5)).toEqual([
      { week: 1, rir: 3, deload: false },
      { week: 2, rir: 2, deload: false },
      { week: 3, rir: 1, deload: false },
      { week: 4, rir: 0, deload: false },
      { week: 5, rir: 4, deload: true },
    ]);
  });

  it('uses 2, 1, 0 for the working weeks of a 4-week block', () => {
    expect(rirSchedule(4).map((week) => week.rir)).toEqual([2, 1, 0, 4]);
  });

  it('caps the opening of a long block at 4', () => {
    expect(rirSchedule(6).map((week) => week.rir)).toEqual([4, 3, 2, 1, 0, 4]);
    expect(rirSchedule(8).map((week) => week.rir)).toEqual([4, 4, 4, 3, 2, 1, 0, 4]);
    expect(isDeloadWeek(8, 8)).toBe(true);
    expect(isDeloadWeek(7, 8)).toBe(false);
  });

  it('rejects weeks outside a 4 to 8 week block', () => {
    expect(() => targetRir(0, 5)).toThrow(/outside/);
    expect(() => targetRir(6, 5)).toThrow(/outside/);
    expect(() => targetRir(1, 3)).toThrow(/4 to 8/);
    expect(() => targetRir(1, 9)).toThrow(/4 to 8/);
  });
});

describe('plate steps', () => {
  it('uses a 5 lb barbell step and a 2.5 kg barbell step', () => {
    expect(plateIncrement('barbell', 'lb')).toBe(5);
    expect(plateIncrement('barbell', 'kg')).toBe(2.5);
    expect(plateIncrement('cable', 'lb')).toBe(5);
    expect(plateIncrement('machine', 'kg')).toBe(2.5);
  });

  it('uses the usual dumbbell jump and no jump for bodyweight', () => {
    expect(plateIncrement('dumbbell', 'lb')).toBe(5);
    expect(plateIncrement('dumbbell', 'kg')).toBe(2);
    expect(plateIncrement('bodyweight', 'lb')).toBe(0);
    expect(plateIncrement('bodyweight', 'kg')).toBe(0);
  });

  it('bumps partial plates up to the next step', () => {
    expect(bumpLoad(135, 5)).toBe(140);
    expect(bumpLoad(137.5, 5)).toBe(140);
    expect(bumpLoad(60, 2.5)).toBe(62.5);
    expect(bumpLoad(20, 2)).toBe(22);
    expect(bumpLoad(0, 5)).toBe(5);
  });

  it('eases a deload by about 10 percent and snaps down', () => {
    expect(easeLoad(135, 5)).toBe(120);
    expect(easeLoad(20, 2.5)).toBe(17.5);
    expect(easeLoad(50, 5)).toBe(45);
    expect(easeLoad(5, 5)).toBe(5);
    expect(easeLoad(0, 5)).toBe(0);
  });
});

describe('load and rep recommendations', () => {
  it('starts from the builder on week one', () => {
    expect(
      recommendLoad({
        last: null,
        repRange: range,
        equipment: 'barbell',
        unit: 'lb',
        deload: false,
        startingWeight: 95,
        startingReps: 8,
      }),
    ).toEqual({ weight: 95, reps: 8, reason: 'first-session' });
  });

  it('adds a rep when the target is hit inside the range', () => {
    const last = performed({ weight: 100, reps: 10, targetReps: 8 });
    expect(
      recommendLoad({
        last,
        repRange: range,
        equipment: 'barbell',
        unit: 'lb',
        deload: false,
        startingWeight: 95,
        startingReps: 8,
      }),
    ).toEqual({ weight: 100, reps: 11, reason: 'add-rep' });
  });

  it('adds load when reps pass the top of the range', () => {
    const last = performed({ weight: 100, reps: 13, targetReps: 10 });
    expect(
      recommendLoad({
        last,
        repRange: range,
        equipment: 'dumbbell',
        unit: 'lb',
        deload: false,
        startingWeight: 40,
        startingReps: 8,
      }),
    ).toEqual({ weight: 105, reps: 8, reason: 'add-load' });
  });

  it('adds load when one more rep would leave the range', () => {
    const last = performed({ weight: 60, reps: 12, targetReps: 12 });
    expect(
      recommendLoad({
        last,
        repRange: range,
        equipment: 'barbell',
        unit: 'kg',
        deload: false,
        startingWeight: 50,
        startingReps: 8,
      }),
    ).toEqual({ weight: 62.5, reps: 8, reason: 'add-load' });
  });

  it('holds the load when the rep target is missed', () => {
    const last = performed({ weight: 185, reps: 7, targetReps: 8 });
    expect(
      recommendLoad({
        last,
        repRange: range,
        equipment: 'barbell',
        unit: 'lb',
        deload: false,
        startingWeight: 135,
        startingReps: 8,
      }),
    ).toEqual({ weight: 185, reps: 8, reason: 'hold' });
  });

  it('keeps a bodyweight lift at the top of the range instead of inventing a load', () => {
    const last = performed({ weight: 0, reps: 16, targetReps: 15 });
    expect(
      recommendLoad({
        last,
        repRange: { min: 8, max: 15 },
        equipment: 'bodyweight',
        unit: 'lb',
        deload: false,
        startingWeight: 0,
        startingReps: 8,
      }),
    ).toEqual({ weight: 0, reps: 15, reason: 'top-hold' });
  });

  it('deload lightens the last load and returns to the bottom of the range', () => {
    const last = performed({ weight: 200, reps: 10, targetReps: 10 });
    expect(
      recommendLoad({
        last,
        repRange: { min: 6, max: 10 },
        equipment: 'barbell',
        unit: 'lb',
        deload: true,
        startingWeight: 135,
        startingReps: 6,
      }),
    ).toEqual({ weight: 180, reps: 6, reason: 'deload' });
  });

  it('suggests tighter ranges for barbell compounds', () => {
    expect(suggestedRepRange('barbell', true)).toEqual({ min: 6, max: 10 });
    expect(suggestedRepRange('dumbbell', true)).toEqual({ min: 8, max: 12 });
    expect(suggestedRepRange('cable', false)).toEqual({ min: 10, max: 15 });
  });
});

describe('what counts as last week', () => {
  it('uses the last programmed set and ignores carried or skipped sets', () => {
    const basis = progressionBasis([
      performed({ reps: 12, targetReps: 8, isCarryOver: true, weight: 110 }),
      performed({ reps: 8, targetReps: 8, weight: 100 }),
      performed({ reps: 0, targetReps: 8, status: 'skipped', weight: 100 }),
    ]);
    expect(basis).toMatchObject({ reps: 8, weight: 100, isCarryOver: false });
  });

  it('returns null when every set was carried or skipped', () => {
    expect(
      progressionBasis([
        performed({ reps: 12, targetReps: 8, isCarryOver: true }),
        performed({ reps: 0, targetReps: 8, status: 'skipped' }),
      ]),
    ).toBeNull();
  });
});

describe('weekly set changes from feedback', () => {
  const calm: RawFeedback = { muscle: 'chest', pump: 1, soreness: 1, joint: 0, workload: 1 };

  it('merges a week by worst fatigue and average pump', () => {
    expect(
      mergeFeedback([
        { muscle: 'chest', pump: 0, soreness: 1, joint: 0, workload: 0 },
        { muscle: 'chest', pump: 2, soreness: 3, joint: 2, workload: 1 },
        { muscle: 'back', pump: 2, soreness: 1, joint: 0, workload: 2 },
      ]),
    ).toEqual([
      { muscle: 'chest', pump: 1, soreness: 3, joint: 2, workload: 1 },
      { muscle: 'back', pump: 2, soreness: 1, joint: 0, workload: 2 },
    ]);
  });

  it('cuts sets for joint pain before it considers anything else', () => {
    expect(volumeDelta({ ...calm, joint: 3, pump: 0, soreness: 0, workload: 0 })).toBe(-2);
    expect(volumeDelta({ ...calm, joint: 2, pump: 0, soreness: 0, workload: 0 })).toBe(-1);
  });

  it('cuts for limiting soreness, too much work, or an excessive pump on a hard day', () => {
    expect(volumeDelta({ ...calm, soreness: 3 })).toBe(-1);
    expect(volumeDelta({ ...calm, workload: 3 })).toBe(-1);
    expect(volumeDelta({ ...calm, pump: 3, workload: 2 })).toBe(-1);
  });

  it('adds a set only when the muscle felt under-stimulated', () => {
    expect(volumeDelta({ muscle: 'quads', pump: 0, soreness: 0, joint: 0, workload: 0 })).toBe(1);
    expect(volumeDelta(calm)).toBe(0);
    expect(volumeDelta({ ...calm, pump: 0, workload: 2 })).toBe(0);
  });

  it('gives the extra set to the smallest primary lift and takes it from the largest', () => {
    const lifts = [
      { id: 'bench', primaryMuscle: 'chest' as const, sets: 3, order: 0 },
      { id: 'fly', primaryMuscle: 'chest' as const, sets: 2, order: 1 },
      { id: 'row', primaryMuscle: 'back' as const, sets: 3, order: 2 },
    ];
    expect(distributeSetDelta(lifts, 'chest', 1).map((row) => row.sets)).toEqual([3, 3, 3]);
    expect(distributeSetDelta(lifts, 'chest', -1).map((row) => row.sets)).toEqual([2, 2, 3]);
    expect(distributeSetDelta(lifts, 'biceps', 1).map((row) => row.sets)).toEqual([3, 2, 3]);
  });

  it('will not push a lift outside 1 to 6 sets', () => {
    const lifts = [{ id: 'curl', primaryMuscle: 'biceps' as const, sets: 1, order: 0 }];
    expect(distributeSetDelta(lifts, 'biceps', -2)[0].sets).toBe(1);
    expect(distributeSetDelta([{ ...lifts[0], sets: 6 }], 'biceps', 1)[0].sets).toBe(6);
  });

  it('folds feedback into later weeks and halves the deload', () => {
    const lifts = [{ id: 'squat', primaryMuscle: 'quads' as const, startingSets: 3, order: 0 }];
    const feedbackByWeek = {
      1: [{ muscle: 'quads' as const, pump: 0 as const, soreness: 0 as const, joint: 0 as const, workload: 0 as const }],
      2: [{ muscle: 'quads' as const, pump: 1 as const, soreness: 1 as const, joint: 3 as const, workload: 1 as const }],
    };
    expect(setsForWeek({ lifts, feedbackByWeek, week: 1, totalWeeks: 5 }).get('squat')).toBe(3);
    expect(setsForWeek({ lifts, feedbackByWeek, week: 2, totalWeeks: 5 }).get('squat')).toBe(4);
    expect(setsForWeek({ lifts, feedbackByWeek, week: 3, totalWeeks: 5 }).get('squat')).toBe(2);
    expect(setsForWeek({ lifts, feedbackByWeek, week: 4, totalWeeks: 5 }).get('squat')).toBe(2);
    expect(setsForWeek({ lifts, feedbackByWeek, week: 5, totalWeeks: 5 }).get('squat')).toBe(1);
  });
});

describe('session plans and one-time sets', () => {
  it('adds carried sets once and leaves them out of the standing count', () => {
    const plan = buildSessionPlan({
      week: 2,
      totalWeeks: 5,
      lifts: [lift()],
      previousSetsByLift: {
        bench: [performed({ weight: 135, reps: 8, targetReps: 6 })],
      },
      feedbackByWeek: {},
      carries: [{ plannedExerciseId: 'bench', sets: 2, applied: false }],
      unit: 'lb',
    });
    expect(plan.filter((set) => !set.isCarryOver)).toHaveLength(3);
    expect(plan.filter((set) => set.isCarryOver)).toHaveLength(2);
    expect(plan[0]).toMatchObject({ targetWeight: 135, targetReps: 9, targetRir: 2, reason: 'add-rep' });
    expect(plan.every((set) => set.targetWeight === 135 && set.targetReps === 9)).toBe(true);

    const again = buildSessionPlan({
      week: 3,
      totalWeeks: 5,
      lifts: [lift()],
      previousSetsByLift: {
        bench: [
          performed({ weight: 135, reps: 12, targetReps: 9, isCarryOver: true }),
          performed({ weight: 135, reps: 9, targetReps: 9 }),
        ],
      },
      feedbackByWeek: {},
      carries: [{ plannedExerciseId: 'bench', sets: 2, applied: true }],
      unit: 'lb',
    });
    expect(again.filter((set) => set.isCarryOver)).toHaveLength(0);
    expect(again[0]).toMatchObject({ targetReps: 10, reason: 'add-rep', targetRir: 1 });
    expect(extraSetsFor('bench', [{ plannedExerciseId: 'bench', sets: 9, applied: false }])).toBe(6);
  });

  it('groups skipped sets by lift', () => {
    expect(
      skippedSetGroups([
        { exerciseId: 'a', plannedExerciseId: 'p1', status: 'skipped' },
        { exerciseId: 'a', plannedExerciseId: 'p1', status: 'done' },
        { exerciseId: 'a', plannedExerciseId: 'p1', status: 'skipped' },
        { exerciseId: 'b', plannedExerciseId: 'p2', status: 'skipped' },
      ]),
    ).toEqual([
      { exerciseId: 'a', plannedExerciseId: 'p1', skippedSets: 2 },
      { exerciseId: 'b', plannedExerciseId: 'p2', skippedSets: 1 },
    ]);
  });
});

describe('deload, ending a block, and the next session', () => {
  it('finds the first day that is unlogged or still open', () => {
    expect(nextOpenSlot({ totalWeeks: 4, daysPerWeek: 2, logs: [] })).toEqual({
      week: 1,
      dayIndex: 0,
      resume: false,
    });
    expect(
      nextOpenSlot({
        totalWeeks: 4,
        daysPerWeek: 2,
        logs: [
          { week: 1, dayIndex: 0, status: 'done' },
          { week: 1, dayIndex: 1, status: 'pending' },
        ],
      }),
    ).toEqual({ week: 1, dayIndex: 1, resume: true });
    expect(
      nextOpenSlot({
        totalWeeks: 4,
        daysPerWeek: 1,
        logs: [
          { week: 1, dayIndex: 0, status: 'skipped' },
          { week: 2, dayIndex: 0, status: 'done' },
          { week: 3, dayIndex: 0, status: 'done' },
          { week: 4, dayIndex: 0, status: 'done' },
        ],
      }),
    ).toBeNull();
  });

  it('skips the rest of the block, or only the working weeks when deloading early', () => {
    const shared = {
      totalWeeks: 5,
      daysPerWeek: 2,
      finished: [{ week: 1, dayIndex: 0 }],
      from: { week: 1, dayIndex: 1 },
    };
    const early = slotsToSkip({ ...shared, mode: 'early-deload' });
    expect(early.some((slot) => slot.week === 5)).toBe(false);
    expect(early).toContainEqual({ week: 1, dayIndex: 1 });
    expect(early).toContainEqual({ week: 4, dayIndex: 1 });
    expect(early).not.toContainEqual({ week: 1, dayIndex: 0 });

    const ended = slotsToSkip({ ...shared, mode: 'end' });
    expect(ended).toContainEqual({ week: 5, dayIndex: 0 });
    expect(ended).toContainEqual({ week: 5, dayIndex: 1 });
  });
});

describe('estimated one-rep max', () => {
  it('uses the Epley formula and ignores empty loads', () => {
    expect(estimateE1rm(100, 1)).toBe(100);
    expect(estimateE1rm(100, 10)).toBe(133.33);
    expect(estimateE1rm(0, 10)).toBeNull();
    expect(estimateE1rm(100, 0)).toBeNull();
  });
});

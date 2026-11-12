import { describe, expect, it } from 'vitest';
import { SEED } from './seed';
import { TEMPLATES } from './templates';

describe('starter library and templates', () => {
  it('ships a unique library across barbell, dumbbell, cable, machine, and bodyweight', () => {
    const ids = SEED.map((exercise) => exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SEED.length).toBeGreaterThan(40);
    for (const equipment of ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'] as const) {
      expect(SEED.some((exercise) => exercise.equipment === equipment)).toBe(true);
    }
    for (const exercise of SEED) {
      expect(exercise.muscles.length).toBeGreaterThan(0);
      expect(exercise.custom).toBe(false);
    }
  });

  it('only references real lifts and stays inside a 4 to 8 week block', () => {
    const ids = new Set(SEED.map((exercise) => exercise.id));
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(3);
    for (const template of TEMPLATES) {
      expect(template.weeks).toBeGreaterThanOrEqual(4);
      expect(template.weeks).toBeLessThanOrEqual(8);
      expect(template.days.length).toBeGreaterThanOrEqual(2);
      expect(template.days.length).toBeLessThanOrEqual(6);
      for (const day of template.days) {
        expect(day.lifts.length).toBeGreaterThan(0);
        for (const lift of day.lifts) {
          expect(ids.has(lift.exerciseId)).toBe(true);
          expect(lift.sets).toBeGreaterThanOrEqual(1);
          expect(lift.repMax).toBeGreaterThanOrEqual(lift.repMin);
        }
      }
    }
  });
});

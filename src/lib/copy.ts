import { plateIncrement } from '../engine/progression';
import type { Equipment, Unit } from '../engine/types';
import { formatNumber } from './format';

export function effortLine(rir: number, deload: boolean): string {
  if (deload) return 'Easy week. Stop well before the set gets ugly.';
  if (rir <= 0) return 'Last hard week. Stop on the last clean rep.';
  if (rir === 1) return 'Leave about 1 rep in the tank.';
  return `Leave about ${rir} reps in the tank.`;
}

export function reasonLine(reason: string, unit: Unit, equipment: Equipment): string {
  const step = plateIncrement(equipment, unit);
  switch (reason) {
    case 'first-session':
      return 'First week. Log the load you actually use.';
    case 'add-rep':
      return 'Add a rep. You hit last week’s target.';
    case 'add-load':
      return `Add ${formatNumber(step)} ${unit}. You cleared the top of the range.`;
    case 'hold':
      return 'Same target. Last week came up short.';
    case 'deload':
      return 'Deload. Lighter load, half the sets, easy effort.';
    case 'top-hold':
      return 'Top of the range. Add load yourself when you can.';
    default:
      return '';
  }
}

export const RATING_SCALES = {
  pump: {
    label: 'Pump',
    hint: 'Right after the work',
    options: ['Low', 'Decent', 'Strong', 'Excessive'],
  },
  soreness: {
    label: 'Soreness',
    hint: 'How it feels today',
    options: ['None', 'Mild', 'Useful', 'Limiting'],
  },
  joint: {
    label: 'Joints',
    hint: 'The joint, not the muscle burn',
    options: ['Fine', 'Tight', 'Uncomfortable', 'Painful'],
  },
  workload: {
    label: 'Workload',
    hint: 'Could you have done more?',
    options: ['Easy', 'Solid', 'Hard', 'Too much'],
  },
} as const;

export type RatingKey = keyof typeof RATING_SCALES;

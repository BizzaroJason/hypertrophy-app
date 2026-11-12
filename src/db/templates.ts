export interface TemplateLift {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
}

export interface BlockTemplate {
  id: string;
  name: string;
  blurb: string;
  weeks: number;
  days: { name: string; lifts: TemplateLift[] }[];
}

const c = (exerciseId: string, sets: number, repMin: number, repMax: number): TemplateLift => ({
  exerciseId,
  sets,
  repMin,
  repMax,
});

export const TEMPLATES: BlockTemplate[] = [
  {
    id: 'full-body',
    name: 'Full body, three days',
    blurb: 'Squat, press, and pull every session, with a hinge day in the middle.',
    weeks: 5,
    days: [
      {
        name: 'Squat day',
        lifts: [
          c('bb-back-squat', 3, 6, 10),
          c('bb-bench', 3, 6, 10),
          c('bb-row', 3, 6, 10),
          c('db-lateral', 2, 10, 15),
          c('cbl-crunch', 2, 10, 15),
        ],
      },
      {
        name: 'Hinge day',
        lifts: [
          c('bb-rdl', 3, 6, 10),
          c('bb-ohp', 3, 6, 10),
          c('cbl-pulldown', 3, 8, 12),
          c('mch-leg-curl', 2, 10, 15),
          c('bb-calf-raise', 2, 10, 15),
        ],
      },
      {
        name: 'Press day',
        lifts: [
          c('mch-leg-press', 3, 8, 12),
          c('db-incline', 3, 8, 12),
          c('cbl-row', 3, 8, 12),
          c('cbl-face-pull', 2, 12, 15),
          c('db-hammer', 2, 10, 15),
        ],
      },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper and lower',
    blurb: 'Four days. Two upper days, two lower days, different lifts each time.',
    weeks: 5,
    days: [
      {
        name: 'Upper A',
        lifts: [
          c('bb-bench', 3, 6, 10),
          c('bb-row', 3, 6, 10),
          c('bb-ohp', 3, 6, 10),
          c('db-curl', 2, 10, 15),
          c('cbl-pushdown', 2, 10, 15),
        ],
      },
      {
        name: 'Lower A',
        lifts: [
          c('bb-back-squat', 3, 6, 10),
          c('bb-rdl', 3, 6, 10),
          c('mch-leg-curl', 2, 10, 15),
          c('bb-calf-raise', 2, 10, 15),
        ],
      },
      {
        name: 'Upper B',
        lifts: [
          c('db-incline', 3, 8, 12),
          c('cbl-pulldown', 3, 8, 12),
          c('db-shoulder-press', 3, 8, 12),
          c('cbl-face-pull', 2, 12, 15),
          c('db-hammer', 2, 10, 15),
        ],
      },
      {
        name: 'Lower B',
        lifts: [
          c('mch-leg-press', 3, 8, 12),
          c('bb-hip-thrust', 3, 8, 12),
          c('mch-leg-extension', 2, 10, 15),
          c('mch-seated-calf', 2, 10, 15),
        ],
      },
    ],
  },
  {
    id: 'push-pull-legs',
    name: 'Push, pull, legs',
    blurb: 'Six days. Each pattern comes around twice with a different emphasis.',
    weeks: 5,
    days: [
      {
        name: 'Push A',
        lifts: [
          c('bb-bench', 3, 6, 10),
          c('db-incline', 3, 8, 12),
          c('bb-ohp', 2, 6, 10),
          c('db-lateral', 2, 10, 15),
          c('cbl-pushdown', 2, 10, 15),
        ],
      },
      {
        name: 'Pull A',
        lifts: [
          c('bw-pullup', 3, 6, 10),
          c('bb-row', 3, 6, 10),
          c('cbl-face-pull', 2, 12, 15),
          c('bb-curl', 2, 10, 15),
          c('db-hammer', 2, 10, 15),
        ],
      },
      {
        name: 'Legs A',
        lifts: [
          c('bb-back-squat', 3, 6, 10),
          c('bb-rdl', 3, 6, 10),
          c('mch-leg-curl', 2, 10, 15),
          c('bb-calf-raise', 2, 10, 15),
          c('mch-leg-extension', 2, 10, 15),
        ],
      },
      {
        name: 'Push B',
        lifts: [
          c('db-bench', 3, 8, 12),
          c('mch-shoulder-press', 3, 8, 12),
          c('cbl-fly', 2, 10, 15),
          c('db-lateral', 2, 10, 15),
          c('db-oh-extension', 2, 10, 15),
        ],
      },
      {
        name: 'Pull B',
        lifts: [
          c('cbl-pulldown', 3, 8, 12),
          c('cbl-row', 3, 8, 12),
          c('cbl-straight-arm', 2, 10, 15),
          c('cbl-curl', 2, 10, 15),
          c('db-rear-delt', 2, 12, 15),
        ],
      },
      {
        name: 'Legs B',
        lifts: [
          c('mch-leg-press', 3, 8, 12),
          c('bb-hip-thrust', 3, 8, 12),
          c('db-lunge', 2, 8, 12),
          c('mch-seated-calf', 2, 10, 15),
          c('mch-leg-curl', 2, 10, 15),
        ],
      },
    ],
  },
  {
    id: 'focus-four',
    name: 'Press, pull, legs, arms',
    blurb: 'Four focused days when you want one pattern per session.',
    weeks: 5,
    days: [
      {
        name: 'Press',
        lifts: [
          c('bb-bench', 3, 6, 10),
          c('db-incline', 3, 8, 12),
          c('bb-ohp', 3, 6, 10),
          c('db-lateral', 2, 10, 15),
          c('cbl-pushdown', 2, 10, 15),
        ],
      },
      {
        name: 'Pull',
        lifts: [
          c('cbl-pulldown', 3, 8, 12),
          c('bb-row', 3, 6, 10),
          c('cbl-face-pull', 2, 12, 15),
          c('cbl-straight-arm', 2, 10, 15),
          c('bb-shrug', 2, 8, 12),
        ],
      },
      {
        name: 'Legs',
        lifts: [
          c('bb-back-squat', 3, 6, 10),
          c('bb-rdl', 3, 6, 10),
          c('mch-leg-press', 2, 8, 12),
          c('mch-leg-curl', 2, 10, 15),
          c('bb-calf-raise', 2, 10, 15),
        ],
      },
      {
        name: 'Arms',
        lifts: [
          c('bb-curl', 3, 8, 12),
          c('db-hammer', 2, 10, 15),
          c('bb-skull-crusher', 3, 8, 12),
          c('cbl-pushdown', 2, 10, 15),
          c('db-lateral', 2, 10, 15),
        ],
      },
    ],
  },
];

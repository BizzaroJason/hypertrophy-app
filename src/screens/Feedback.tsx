import { useEffect, useState } from 'react';
import { MUSCLE_LABEL, MUSCLES, type MuscleGroup, type Signal } from '../engine/types';
import { readBundle, saveFeedback } from '../db/actions';
import { RATING_SCALES, type RatingKey } from '../lib/copy';
import { go } from '../lib/router';
import { useDbQuery } from '../lib/useDbQuery';
import { Screen } from '../components/Shell';

type Scores = Record<RatingKey, Signal>;

const NEUTRAL: Scores = { pump: 1, soreness: 1, joint: 0, workload: 1 };

function musclesFor(bundle: NonNullable<Awaited<ReturnType<typeof readBundle>>>, dayIndex: number): MuscleGroup[] {
  const day = bundle.days.find((item) => item.index === dayIndex);
  if (!day) return [];
  const used = new Set<MuscleGroup>();
  for (const planned of bundle.planned.filter((row) => row.dayId === day.id)) {
    const exercise = bundle.exercises.find((item) => item.id === planned.exerciseId);
    exercise?.muscles.forEach((muscle) => used.add(muscle));
  }
  return MUSCLES.filter((muscle) => used.has(muscle));
}

export function Feedback({ mesoId, week, dayIndex }: { mesoId: string; week: number; dayIndex: number }) {
  const bundle = useDbQuery(() => readBundle(mesoId), [mesoId]);
  const [scores, setScores] = useState<Record<string, Scores>>({});
  const [saving, setSaving] = useState(false);

  const muscles = bundle ? musclesFor(bundle, dayIndex) : [];

  useEffect(() => {
    if (!bundle) return;
    setScores((current) => {
      const next = { ...current };
      for (const muscle of musclesFor(bundle, dayIndex)) {
        const existing = bundle.feedback.find((row) => row.week === week && row.dayIndex === dayIndex && row.muscle === muscle);
        if (!next[muscle]) {
          next[muscle] = existing
            ? { pump: existing.pump, soreness: existing.soreness, joint: existing.joint, workload: existing.workload }
            : { ...NEUTRAL };
        }
      }
      return next;
    });
  }, [bundle, week, dayIndex]);

  async function save() {
    if (!bundle) return;
    setSaving(true);
    const rows = muscles.map((muscle) => ({ muscle, ...(scores[muscle] ?? NEUTRAL) }));
    await saveFeedback(mesoId, week, dayIndex, rows);
    go('#/');
  }

  if (!bundle) {
    return (
      <Screen bare>
        <p className="kicker">Ratings</p>
      </Screen>
    );
  }

  const day = bundle.days.find((item) => item.index === dayIndex);

  return (
    <Screen bare>
      <a className="back" href="#/">
        Today
      </a>
      <p className="kicker">
        Week {week} · {day?.name ?? 'Session'}
      </p>
      <h1>How did it land?</h1>
      <p className="muted">
        These ratings change next week’s sets. Pain and “too much” take a set away. A muscle that felt easy, with no pump and no soreness, gains one.
      </p>
      <div className="stack">
        {muscles.map((muscle) => {
          const score = scores[muscle] ?? NEUTRAL;
          return (
            <section key={muscle} className="card">
              <h2>{MUSCLE_LABEL[muscle]}</h2>
              {(Object.keys(RATING_SCALES) as RatingKey[]).map((key) => (
                <fieldset key={key} className="scale">
                  <legend>
                    {RATING_SCALES[key].label}
                    <span>{RATING_SCALES[key].hint}</span>
                  </legend>
                  <div className="scale-options">
                    {RATING_SCALES[key].options.map((option, index) => (
                      <button
                        key={option}
                        type="button"
                        className={score[key] === index ? 'on' : undefined}
                        aria-pressed={score[key] === index}
                        data-testid={`${key}-${muscle}-${index}`}
                        onClick={() =>
                          setScores((current) => ({
                            ...current,
                            [muscle]: { ...(current[muscle] ?? NEUTRAL), [key]: index as Signal },
                          }))
                        }
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
            </section>
          );
        })}
      </div>
      <button type="button" className="btn btn-primary btn-block" data-testid="save-ratings" disabled={saving} onClick={() => void save()}>
        Save ratings
      </button>
    </Screen>
  );
}

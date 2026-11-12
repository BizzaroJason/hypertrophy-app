import { useEffect, useMemo, useRef, useState } from 'react';
import { isDeloadWeek, plateIncrement, skippedSetGroups } from '../engine/progression';
import type { Equipment } from '../engine/types';
import { addCarries, ensureSession, markSet, readBundle } from '../db/actions';
import type { Exercise, SetLog } from '../db/types';
import { beep } from '../lib/beep';
import { effortLine, reasonLine } from '../lib/copy';
import { formatClock, formatLoad, formatNumber, parseLoad, parseReps } from '../lib/format';
import { go } from '../lib/router';
import { useDbQuery } from '../lib/useDbQuery';
import { Screen } from '../components/Shell';
import { Sheet } from '../components/Ui';

export function Session({ mesoId, week, dayIndex }: { mesoId: string; week: number; dayIndex: number }) {
  const [bootError, setBootError] = useState<string | null>(null);
  const [carryGroups, setCarryGroups] = useState<{ exerciseId: string; plannedExerciseId: string; skippedSets: number }[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { weight: string; reps: string }>>({});
  const [timer, setTimer] = useState<{ endsAt: number; total: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const beeped = useRef(false);

  useEffect(() => {
    let cancel = false;
    ensureSession(mesoId, week, dayIndex).catch((error: unknown) => {
      if (!cancel) setBootError(error instanceof Error ? error.message : 'Could not open this session.');
    });
    return () => {
      cancel = true;
    };
  }, [mesoId, week, dayIndex]);

  const bundle = useDbQuery(() => readBundle(mesoId), [mesoId]);

  const sets = useMemo(() => {
    const order = new Map((bundle?.planned ?? []).map((row) => [row.id, row.order]));
    return (bundle?.sets ?? [])
      .filter((set) => set.week === week && set.dayIndex === dayIndex)
      .sort((a, b) => (order.get(a.plannedExerciseId) ?? 0) - (order.get(b.plannedExerciseId) ?? 0) || a.setIndex - b.setIndex);
  }, [bundle, week, dayIndex]);

  useEffect(() => {
    if (sets.length === 0) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const set of sets) {
        if (!next[set.id]) {
          next[set.id] = {
            weight: set.weight != null ? String(set.weight) : set.targetWeight > 0 ? String(set.targetWeight) : '',
            reps: set.reps != null ? String(set.reps) : String(set.targetReps),
          };
        }
      }
      return next;
    });
  }, [sets]);

  useEffect(() => {
    if (!timer) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (!timer || beeped.current) return;
    if (Date.now() >= timer.endsAt) {
      beeped.current = true;
      beep();
      setTimer(null);
    }
  }, [timer, now]);

  if (!bundle) {
    return (
      <Screen bare>
        <p className="kicker">Opening session</p>
      </Screen>
    );
  }

  if (!bundle.meso || Number.isNaN(week) || Number.isNaN(dayIndex)) {
    return (
      <Screen bare>
        <p>That session is not on this phone.</p>
        <a className="btn btn-primary" href="#/">
          Today
        </a>
      </Screen>
    );
  }

  const day = bundle.days.find((item) => item.index === dayIndex);
  const exercises = new Map(bundle.exercises.map((exercise) => [exercise.id, exercise]));
  const deload = week >= 1 && week <= bundle.meso.weeks ? isDeloadWeek(week, bundle.meso.weeks) : false;
  const groups: { plannedId: string; exercise: Exercise | undefined; sets: SetLog[] }[] = [];
  for (const set of sets) {
    const last = groups[groups.length - 1];
    if (!last || last.plannedId !== set.plannedExerciseId) {
      groups.push({ plannedId: set.plannedExerciseId, exercise: exercises.get(set.exerciseId), sets: [set] });
    } else {
      last.sets.push(set);
    }
  }
  const logged = sets.filter((set) => set.status !== 'pending').length;
  const remaining = timer ? Math.max(0, Math.ceil((timer.endsAt - now - 400) / 1000)) : 0;

  function startRest(compound: boolean) {
    const seconds = compound ? bundle!.settings.restCompound : bundle!.settings.restIsolation;
    beeped.current = false;
    setTimer({ endsAt: Date.now() + seconds * 1000, total: seconds });
  }

  async function complete(set: SetLog, status: 'done' | 'skipped') {
    const draft = drafts[set.id] ?? { weight: '', reps: '' };
    if (status === 'done') {
      const weight = parseLoad(draft.weight);
      const reps = parseReps(draft.reps);
      if (weight == null || reps == null) return;
      await markSet(set.id, { status, weight, reps });
      const exercise = exercises.get(set.exerciseId);
      startRest(exercise?.compound ?? true);
      return;
    }
    await markSet(set.id, { status: 'skipped', weight: null, reps: null });
  }

  function goFeedback(groupsToOffer: { exerciseId: string; plannedExerciseId: string; skippedSets: number }[]) {
    if (groupsToOffer.length > 0) {
      setCarryGroups(groupsToOffer);
      return;
    }
    go(`/feedback/${encodeURIComponent(mesoId)}/${week}/${dayIndex}`);
  }

  function finish() {
    if (sets.length === 0 || sets.some((set) => set.status === 'pending')) return;
    const alreadyRated = bundle!.feedback.some((row) => row.week === week && row.dayIndex === dayIndex);
    if (alreadyRated) {
      go('#/');
      return;
    }
    goFeedback(skippedSetGroups(sets));
  }

  async function skipRemainingSets() {
    const pending = sets.filter((set) => set.status === 'pending');
    for (const set of pending) await markSet(set.id, { status: 'skipped', weight: null, reps: null });
    const projected = sets.map((set) => (set.status === 'pending' ? { ...set, status: 'skipped' as const } : set));
    goFeedback(skippedSetGroups(projected));
  }

  return (
    <Screen bare>
      <header className="spread">
        <a className="back" href="#/">
          Today
        </a>
        <p className="kicker">
          Week {week} · {day?.name ?? 'Day'}
        </p>
      </header>
      <h1>{deload ? 'Deload session' : 'Session'}</h1>
      {week >= 1 && week <= bundle.meso.weeks && <p className="muted">{effortLine(sets[0]?.targetRir ?? 0, deload)}</p>}
      {bootError && <p className="error">{bootError}</p>}

      <div className="stack">
        {groups.map((group) => {
          const equipment: Equipment = group.exercise?.equipment ?? 'barbell';
          const increment = plateIncrement(equipment, bundle.settings.unit) || 1;
          const programmed = group.sets.find((set) => !set.isCarryOver) ?? group.sets[0];
          const lastWeek = bundle.sets
            .filter(
              (set) =>
                set.plannedExerciseId === group.plannedId &&
                set.week === week - 1 &&
                set.dayIndex === dayIndex &&
                set.status === 'done' &&
                !set.isCarryOver,
            )
            .sort((a, b) => a.setIndex - b.setIndex);
          return (
            <section key={group.plannedId} className="card">
              <div className="spread">
                <h2>{group.exercise?.name ?? 'Lift'}</h2>
                {group.sets.some((set) => set.isCarryOver) && <span className="badge">One-time</span>}
              </div>
              {programmed && <p className="reason">{reasonLine(programmed.reason, bundle.settings.unit, equipment)}</p>}
              <p className="faint">
                {lastWeek.length
                  ? `Last week ${lastWeek.map((set) => `${formatNumber(set.weight ?? 0)}×${set.reps}`).join(', ')}`
                  : 'No log last week'}
              </p>
              <ul className="sets">
                {group.sets.map((set) => {
                  const draft = drafts[set.id] ?? { weight: '', reps: '' };
                  const weightOk = parseLoad(draft.weight) != null;
                  const repsOk = parseReps(draft.reps) != null;
                  return (
                    <li key={set.id} className={`set set-${set.status}`}>
                      <div className="spread">
                        <strong>
                          Set {set.setIndex + 1}
                          {set.isCarryOver ? ' · once' : ''}
                        </strong>
                        <span className="faint">
                          Target {set.targetWeight > 0 ? formatLoad(set.targetWeight, bundle.settings.unit) : 'load'} × {set.targetReps}
                        </span>
                      </div>
                      {set.status === 'pending' ? (
                        <>
                          <div className="log-grid">
                            <div className="mini-step">
                              <button type="button" aria-label="Decrease weight" onClick={() => adjust(set.id, 'weight', -increment, draft)}>
                                −
                              </button>
                              <label>
                                <span className="sr">Weight</span>
                                <input
                                  data-testid="set-weight"
                                  inputMode="decimal"
                                  value={draft.weight}
                                  placeholder="0"
                                  onChange={(event) => updateDraft(set.id, { weight: event.target.value })}
                                />
                              </label>
                              <em>{bundle.settings.unit}</em>
                              <button type="button" aria-label="Increase weight" onClick={() => adjust(set.id, 'weight', increment, draft)}>
                                +
                              </button>
                            </div>
                            <div className="mini-step">
                              <button type="button" aria-label="Decrease reps" onClick={() => adjust(set.id, 'reps', -1, draft)}>
                                −
                              </button>
                              <label>
                                <span className="sr">Reps</span>
                                <input
                                  data-testid="set-reps"
                                  inputMode="numeric"
                                  value={draft.reps}
                                  onChange={(event) => updateDraft(set.id, { reps: event.target.value })}
                                />
                              </label>
                              <em>reps</em>
                              <button type="button" aria-label="Increase reps" onClick={() => adjust(set.id, 'reps', 1, draft)}>
                                +
                              </button>
                            </div>
                          </div>
                          <div className="btn-row">
                            <button
                              type="button"
                              className="btn btn-primary"
                              data-testid="set-done"
                              disabled={!weightOk || !repsOk}
                              onClick={() => void complete(set, 'done')}
                            >
                              Done
                            </button>
                            <button type="button" className="btn btn-ghost" data-testid="set-skip" onClick={() => void complete(set, 'skipped')}>
                              Skip
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="spread">
                          <p>{set.status === 'done' ? `${formatLoad(set.weight ?? 0, bundle.settings.unit)} × ${set.reps}` : 'Skipped'}</p>
                          <button
                            type="button"
                            className="text-btn"
                            onClick={() => void markSet(set.id, { status: 'pending', weight: set.weight, reps: set.reps })}
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {sets.length === 0 && <p className="muted">Nothing is planned for this day.</p>}

      <div className="dock">
        {timer && remaining > 0 && (
          <div className="timer" aria-live="polite">
            <div>
              <p className="kicker">Rest</p>
              <p className="timer-time">{formatClock(remaining)}</p>
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setTimer((current) => current && { ...current, endsAt: current.endsAt - 15000, total: current.total })}>
                −15
              </button>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setTimer((current) => current && { ...current, endsAt: current.endsAt + 15000, total: current.total + 15 })}>
                +15
              </button>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setTimer(null)}>
                Skip rest
              </button>
            </div>
          </div>
        )}
        <p className="faint">
          {logged}/{sets.length} sets logged
        </p>
        <button type="button" className="btn btn-primary btn-block" data-testid="finish-session" disabled={sets.length === 0 || sets.some((set) => set.status === 'pending')} onClick={finish}>
          Finish session
        </button>
        {sets.some((set) => set.status === 'pending') && (
          <button type="button" className="text-btn" data-testid="skip-remaining" onClick={() => void skipRemainingSets()}>
            Skip remaining sets
          </button>
        )}
      </div>

      {carryGroups && (
        <Sheet
          title="Carry skipped sets once?"
          confirmLabel="Carry once"
          cancelLabel="Leave them"
          onClose={() => {
            setCarryGroups(null);
            go(`/feedback/${encodeURIComponent(mesoId)}/${week}/${dayIndex}`);
          }}
          onConfirm={() => {
            void addCarries(
              mesoId,
              carryGroups.map((group) => ({
                exerciseId: group.exerciseId,
                plannedExerciseId: group.plannedExerciseId,
                sets: group.skippedSets,
              })),
            ).then(() => {
              setCarryGroups(null);
              go(`/feedback/${encodeURIComponent(mesoId)}/${week}/${dayIndex}`);
            });
          }}
        >
          <ul className="stack">
            {carryGroups.map((group) => (
              <li key={group.plannedExerciseId}>
                {group.skippedSets} skipped {group.skippedSets === 1 ? 'set' : 'sets'} of {exercises.get(group.exerciseId)?.name ?? 'a lift'}
              </li>
            ))}
          </ul>
          <p className="muted">They show up on the next session of that lift, then disappear. They do not change the plan after that.</p>
        </Sheet>
      )}
    </Screen>
  );

  function updateDraft(id: string, patch: Partial<{ weight: string; reps: string }>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  function adjust(id: string, field: 'weight' | 'reps', delta: number, draft: { weight: string; reps: string }) {
    if (field === 'weight') {
      const current = parseLoad(draft.weight) ?? 0;
      const next = Math.max(0, Math.round((current + delta) * 100) / 100);
      updateDraft(id, { weight: String(next) });
      return;
    }
    const current = parseReps(draft.reps) ?? 0;
    updateDraft(id, { reps: String(Math.max(1, Math.min(50, current + delta))) });
  }
}

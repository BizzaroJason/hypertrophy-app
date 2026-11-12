import { useState } from 'react';
import { isDeloadWeek, nextOpenSlot, rirSchedule } from '../engine/progression';
import { MUSCLE_LABEL, type MuscleGroup } from '../engine/types';
import { activeBundle, discardActive, skipRemaining } from '../db/actions';
import { dayState, muscleSetTotals, planForDay } from '../lib/planForDay';
import { useDbQuery } from '../lib/useDbQuery';
import { Screen } from '../components/Shell';
import { Sheet, WeekRail } from '../components/Ui';

export function Plan() {
  const bundle = useDbQuery(() => activeBundle(), []);
  const [pending, setPending] = useState<'end' | 'deload' | 'discard' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (bundle === undefined) {
    return (
      <Screen>
        <p className="kicker">Block</p>
      </Screen>
    );
  }

  if (!bundle) {
    return (
      <Screen>
        <p className="kicker">Block</p>
        <h1>No block yet.</h1>
        <p className="muted">A block is a few hard weeks and an easy one at the end. Templates cover the usual splits, or copy a block you already finished.</p>
        <a className="btn btn-primary btn-block" href="#/plan/new">
          Build a block
        </a>
        <a className="btn btn-ghost btn-block" href="#/archive">
          Archive
        </a>
      </Screen>
    );
  }

  const open = nextOpenSlot({
    totalWeeks: bundle.meso.weeks,
    daysPerWeek: bundle.meso.daysPerWeek,
    logs: bundle.sets,
  });
  const week = open?.week ?? bundle.meso.weeks;
  const names = new Map(bundle.exercises.map((exercise) => [exercise.id, exercise]));
  const schedule = rirSchedule(bundle.meso.weeks);
  const changes = volumeChanges(bundle, week);
  const loggedSets = bundle.sets.length;

  async function confirm() {
    try {
      if (pending === 'end') await skipRemaining(bundle!.meso.id, 'end');
      if (pending === 'deload') await skipRemaining(bundle!.meso.id, 'early-deload');
      if (pending === 'discard') await discardActive(bundle!.meso.id);
      setPending(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the block.');
      setPending(null);
    }
  }

  return (
    <Screen>
      <p className="kicker">Block</p>
      <div className="spread">
        <h1>{bundle.meso.name}</h1>
      </div>
      <p className="muted">
        Week {week} of {bundle.meso.weeks}
        {bundle.meso.earlyDeload ? ' · deload started early' : ''}
      </p>
      <WeekRail week={week} total={bundle.meso.weeks} />

      <ul className="rir-list">
        {schedule.map((item) => (
          <li key={item.week} className={item.week === week ? 'current' : undefined}>
            <span>Week {item.week}</span>
            <strong>{item.deload ? 'Deload' : `${item.rir} reps in reserve`}</strong>
          </li>
        ))}
      </ul>

      {changes.length > 0 && (
        <section className="card">
          <h2>Set changes</h2>
          <ul>
            {changes.map((change) => (
              <li key={change.muscle}>
                {MUSCLE_LABEL[change.muscle]} {change.from} → {change.to} sets
              </li>
            ))}
          </ul>
          <p className="faint">From ratings already saved. The deload still cuts sets in half.</p>
        </section>
      )}
      {open && isDeloadWeek(open.week, bundle.meso.weeks) && <p className="notice">This is the easy week. Sets are about half, and the load comes down a little.</p>}

      <div className="stack">
        {bundle.days.map((day) => {
          const state = dayState(bundle.sets, week, day.index);
          const lifts = bundle.planned.filter((row) => row.dayId === day.id).sort((a, b) => a.order - b.order);
          const opened = bundle.sets.some((set) => set.week === week && set.dayIndex === day.index);
          return (
            <section key={day.id} className="card">
              <div className="spread">
                <h2>{day.name}</h2>
                <span className="faint">{state === 'empty' ? 'Not started' : state === 'open' ? 'In progress' : state === 'skipped' ? 'Skipped' : 'Logged'}</span>
              </div>
              <ul>
                {lifts.map((lift) => {
                    const count = opened
                      ? bundle.sets.filter((set) => set.week === week && set.plannedExerciseId === lift.id && !set.isCarryOver).length
                      : planForDay(bundle, week, day.index, { includeCarries: false }).filter((set) => set.plannedExerciseId === lift.id).length;
                    return (
                      <li key={lift.id} className="spread quiet">
                        <span>{names.get(lift.exerciseId)?.name ?? 'Lift'}</span>
                        <span className="faint">{count} {count === 1 ? 'set' : 'sets'}</span>
                      </li>
                    );
                  })}
              </ul>
              {open && (state === 'empty' || state === 'open') && open.week === week && (
                <a className="btn btn-ghost btn-block" href={`#/session/${encodeURIComponent(bundle.meso.id)}/${week}/${day.index}`}>
                  {state === 'open' ? 'Resume' : 'Start'}
                </a>
              )}
            </section>
          );
        })}
      </div>

      <a className="btn btn-ghost btn-block" href="#/rules">
        How progression works
      </a>
      {error && <p className="error">{error}</p>}
      {!isDeloadWeek(week, bundle.meso.weeks) && open && (
        <button type="button" className="btn btn-ghost btn-block" onClick={() => setPending('deload')}>
          Start deload early
        </button>
      )}
      <button type="button" className="btn btn-danger btn-block" onClick={() => setPending('end')}>
        End block
      </button>
      {loggedSets === 0 && (
        <button type="button" className="text-btn" onClick={() => setPending('discard')}>
          Discard this block
        </button>
      )}

      {pending && (
        <Sheet
          title={pending === 'end' ? 'End this block?' : pending === 'deload' ? 'Start the deload now?' : 'Discard this block?'}
          confirmLabel={pending === 'end' ? 'End block' : pending === 'deload' ? 'Start deload' : 'Discard'}
          danger={pending !== 'deload'}
          onClose={() => setPending(null)}
          onConfirm={() => void confirm()}
        >
          <p>
            {pending === 'end' && 'Remaining days are marked skipped and the block moves to the archive. Logs you already saved stay put.'}
            {pending === 'deload' && 'Remaining hard weeks are marked skipped. The easy week stays open.'}
            {pending === 'discard' && 'Nothing has been logged. This removes the block.'}
          </p>
        </Sheet>
      )}
    </Screen>
  );
}

function volumeChanges(bundle: NonNullable<Awaited<ReturnType<typeof activeBundle>>>, week: number) {
  if (week >= bundle.meso.weeks) return [];
  const hasFeedback = bundle.feedback.some((row) => row.week < week);
  if (!hasFeedback) return [];
  const current = muscleSetTotals(bundle, week);
  const next = muscleSetTotals(bundle, week + 1);
  const muscles = new Set<MuscleGroup>([...current.keys(), ...next.keys()]);
  const changes: { muscle: MuscleGroup; from: number; to: number }[] = [];
  for (const muscle of muscles) {
    const from = current.get(muscle) ?? 0;
    const to = next.get(muscle) ?? 0;
    if (from !== to) changes.push({ muscle, from, to });
  }
  return changes;
}

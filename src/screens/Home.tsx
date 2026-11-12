import { useEffect, useState } from 'react';
import { isDeloadWeek, nextOpenSlot, targetRir } from '../engine/progression';
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '../engine/types';
import { activeBundle } from '../db/actions';
import { db, getSettings } from '../db/db';
import type { Bundle } from '../db/types';
import { dayState, planForDay } from '../lib/planForDay';
import { formatLoad } from '../lib/format';
import { effortLine } from '../lib/copy';
import { useDbQuery } from '../lib/useDbQuery';
import { Screen } from '../components/Shell';
import { Mark, WeekRail } from '../components/Ui';

interface PreviewSet {
  id: string;
  plannedExerciseId: string;
  exerciseId: string;
  targetWeight: number;
  targetReps: number;
  status: 'pending' | 'done' | 'skipped';
}

function previewRows(bundle: Bundle, week: number, dayIndex: number): PreviewSet[] {
  const existing = bundle.sets
    .filter((set) => set.week === week && set.dayIndex === dayIndex)
    .sort((a, b) => a.setIndex - b.setIndex);
  if (existing.length > 0) {
    return existing.map((set) => ({
      id: set.id,
      plannedExerciseId: set.plannedExerciseId,
      exerciseId: set.exerciseId,
      targetWeight: set.targetWeight,
      targetReps: set.targetReps,
      status: set.status,
    }));
  }
  return planForDay(bundle, week, dayIndex).map((plan, index) => ({
    id: `preview-${index}`,
    plannedExerciseId: plan.plannedExerciseId,
    exerciseId: plan.exerciseId,
    targetWeight: plan.targetWeight,
    targetReps: plan.targetReps,
    status: 'pending',
  }));
}

export function Home() {
  const data = useDbQuery(async () => {
    const settings = await getSettings();
    const bundle = await activeBundle();
    const archived = (await db.mesocycles.filter((meso) => meso.status === 'archived').toArray()).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
    return { settings, bundle, lastArchived: archived[0] ?? null };
  }, []);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setShowInstall(ios && !standalone && localStorage.getItem('kiln-install-dismissed') !== '1');
  }, []);

  if (!data) {
    return (
      <Screen>
        <Mark />
      </Screen>
    );
  }

  const { bundle, settings, lastArchived } = data;

  return (
    <Screen>
      <header className="brand">
        <Mark />
        <div>
          <p className="kicker">Kiln</p>
          <h1>Heat, then recover.</h1>
        </div>
      </header>

      {showInstall && (
        <aside className="install">
          <p>In Safari, tap Share, then Add to Home Screen. Kiln stays on the phone after that.</p>
          <button
            type="button"
            className="btn btn-small btn-ghost"
            onClick={() => {
              localStorage.setItem('kiln-install-dismissed', '1');
              setShowInstall(false);
            }}
          >
            Hide
          </button>
        </aside>
      )}

      {!bundle && (
        <section className="empty">
          <p>Build a block, train the days, and Kiln will name the next load.</p>
          <a className="btn btn-primary btn-block" href="#/plan/new" data-testid="build-block">
            Build a block
          </a>
          {lastArchived && (
            <a className="btn btn-ghost btn-block" href={`#/plan/new?from=${encodeURIComponent(lastArchived.id)}`}>
              Copy {lastArchived.name}
            </a>
          )}
          <p className="faint">Loads are in {settings.unit === 'lb' ? 'pounds' : 'kilograms'}. Change that in More before you log.</p>
        </section>
      )}

      {bundle && <ActiveHome bundle={bundle} unit={settings.unit} />}
    </Screen>
  );
}

function ActiveHome({ bundle, unit }: { bundle: Bundle; unit: Bundle['settings']['unit'] }) {
  const open = nextOpenSlot({
    totalWeeks: bundle.meso.weeks,
    daysPerWeek: bundle.meso.daysPerWeek,
    logs: bundle.sets,
  });
  const week = open?.week ?? bundle.meso.weeks;
  const deload = isDeloadWeek(week, bundle.meso.weeks);
  const day = open ? bundle.days.find((item) => item.index === open.dayIndex) : undefined;
  const names = new Map(bundle.exercises.map((exercise) => [exercise.id, exercise]));
  const rows = open && day ? previewRows(bundle, open.week, open.dayIndex) : [];
  const grouped = new Map<string, PreviewSet[]>();
  for (const row of rows) {
    const list = grouped.get(row.plannedExerciseId) ?? [];
    list.push(row);
    grouped.set(row.plannedExerciseId, list);
  }
  const doneSets = rows.filter((row) => row.status === 'done').length;

  return (
    <>
      <section className="card card-accent">
        <div className="spread">
          <div>
            <p className="kicker">{bundle.meso.name}</p>
            <h2>
              Week {week} of {bundle.meso.weeks}
            </h2>
          </div>
          <span className={`pill ${deload ? 'pill-sage' : 'pill-copper'}`}>{deload ? 'Deload' : `RIR ${targetRir(week, bundle.meso.weeks)}`}</span>
        </div>
        <WeekRail week={week} total={bundle.meso.weeks} />
        <p className="muted">{effortLine(targetRir(week, bundle.meso.weeks), deload)}</p>
        {bundle.meso.earlyDeload && <p className="faint">Deload started early.</p>}
      </section>

      <ol className="day-strip" aria-label={`Week ${week} days`}>
        {bundle.days.map((item) => {
          const state = dayState(bundle.sets, week, item.index);
          const current = open?.dayIndex === item.index;
          return (
            <li key={item.id} className={`day-pill ${state} ${current ? 'current' : ''}`}>
              <span>{item.name}</span>
              <small>{state === 'empty' ? 'Ready' : state === 'open' ? 'In progress' : state === 'skipped' ? 'Skipped' : 'Logged'}</small>
            </li>
          );
        })}
      </ol>

      {open && day && (
        <a
          className="btn btn-primary btn-block"
          data-testid="begin-session"
          href={`#/session/${encodeURIComponent(bundle.meso.id)}/${open.week}/${open.dayIndex}`}
        >
          {open.resume ? `Resume ${day.name}` : `Start ${day.name}`}
        </a>
      )}

      {open && day && (
        <section>
          <div className="spread">
            <h2>{day.name}</h2>
            <p className="faint">
              {doneSets}/{rows.length || 0} sets
            </p>
          </div>
          <ul className="stack">
            {[...grouped.entries()].map(([plannedId, sets]) => {
              const exercise = names.get(sets[0].exerciseId);
              const sample = sets[0];
              const load =
                sample.targetWeight > 0 ? `${formatLoad(sample.targetWeight, unit)} × ${sample.targetReps}` : `${sample.targetReps} reps · set the load`;
              return (
                <li key={plannedId} className="card lift-row">
                  <div>
                    <strong>{exercise?.name ?? 'Lift'}</strong>
                    <p className="faint">
                      {exercise ? `${MUSCLE_LABEL[exercise.muscles[0]]} · ${EQUIPMENT_LABEL[exercise.equipment]}` : ''}
                    </p>
                  </div>
                  <div className="lift-meta">
                    <span>{sets.length} sets</span>
                    <span>{load}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!open && (
        <section className="card">
          <h2>Block complete</h2>
          <p className="muted">Every day is logged. Archive it, or copy it into the next block from the archive.</p>
          <a className="btn btn-primary btn-block" href="#/plan">
            Review the block
          </a>
        </section>
      )}
    </>
  );
}

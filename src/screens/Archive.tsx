import { useState } from 'react';
import { deleteArchive, listBlocks, readBundle } from '../db/actions';
import { db } from '../db/db';
import { formatNumber, formatWhen } from '../lib/format';
import { go } from '../lib/router';
import { useDbQuery } from '../lib/useDbQuery';
import { Screen } from '../components/Shell';
import { Sheet } from '../components/Ui';

export function Archive() {
  const blocks = useDbQuery(async () => {
    const rows = await listBlocks();
    const sets = await db.sets.toArray();
    return rows
      .filter((block) => block.status === 'archived')
      .map((block) => ({
        block,
        done: sets.filter((set) => set.mesoId === block.id && set.status === 'done').length,
      }));
  }, []);

  if (!blocks) {
    return (
      <Screen>
        <p className="kicker">Archive</p>
      </Screen>
    );
  }

  return (
    <Screen>
      <a className="back" href="#/more">
        More
      </a>
      <p className="kicker">Archive</p>
      <h1>Past blocks</h1>
      {blocks.length === 0 && <p className="muted">Ended blocks land here. You can copy one into a new plan.</p>}
      <ul className="stack">
        {blocks.map(({ block, done }) => (
          <li key={block.id}>
            <a className="card link-card" href={`#/archive/${encodeURIComponent(block.id)}`}>
              <strong>{block.name}</strong>
              <span>
                {formatWhen(block.startedAt)}
                {block.endedAt ? ` – ${formatWhen(block.endedAt)}` : ''} · {block.weeks} weeks · {done} sets
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Screen>
  );
}

export function ArchiveDetail({ mesoId }: { mesoId: string }) {
  const bundle = useDbQuery(() => readBundle(mesoId), [mesoId]);
  const [confirming, setConfirming] = useState(false);

  if (!bundle) {
    return (
      <Screen>
        <p className="kicker">Archive</p>
      </Screen>
    );
  }

  const names = new Map(bundle.exercises.map((exercise) => [exercise.id, exercise.name]));

  return (
    <Screen>
      <a className="back" href="#/archive">
        Archive
      </a>
      <p className="kicker">{bundle.meso.status === 'archived' ? 'Archived' : 'Block'}</p>
      <h1>{bundle.meso.name}</h1>
      <p className="muted">
        {formatWhen(bundle.meso.startedAt)}
        {bundle.meso.endedAt ? ` – ${formatWhen(bundle.meso.endedAt)}` : ''}
      </p>
      {Array.from({ length: bundle.meso.weeks }, (_, index) => index + 1).map((week) => (
        <section key={week} className="card">
          <h2>
            Week {week}
            {week === bundle.meso.weeks ? ' · deload' : ''}
          </h2>
          {bundle.days.map((day) => {
            const sets = bundle.sets.filter((set) => set.week === week && set.dayIndex === day.index && set.status === 'done' && !set.isCarryOver);
            return (
              <div key={day.id}>
                <p className="label">{day.name}</p>
                {sets.length === 0 && <p className="faint">No completed sets.</p>}
                <ul>
                  {bundle.planned
                    .filter((row) => row.dayId === day.id)
                    .map((row) => {
                      const mine = sets.filter((set) => set.plannedExerciseId === row.id);
                      if (mine.length === 0) return null;
                      return (
                        <li key={row.id}>
                          {names.get(row.exerciseId) ?? 'Lift'} · {mine.map((set) => `${formatNumber(set.weight ?? 0)}×${set.reps}`).join(', ')}
                        </li>
                      );
                    })}
                </ul>
              </div>
            );
          })}
        </section>
      ))}
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => go(`/plan/new?from=${encodeURIComponent(mesoId)}`)}
      >
        Copy into a new block
      </button>
      {bundle.meso.status === 'archived' && (
        <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirming(true)}>
          Delete this archive
        </button>
      )}
      {confirming && (
        <Sheet
          title="Delete this archive?"
          confirmLabel="Delete"
          danger
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            void deleteArchive(mesoId).then(() => go('#/archive'));
          }}
        >
          <p>Logs in this block are removed from the phone. The lift library stays.</p>
        </Sheet>
      )}
    </Screen>
  );
}

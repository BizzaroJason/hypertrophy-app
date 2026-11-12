import { useState } from 'react';
import { MUSCLE_LABEL } from '../engine/types';
import { db } from '../db/db';
import { formatLoad, formatNumber, formatWhen } from '../lib/format';
import { strengthSeries, volumeByWeek } from '../lib/history';
import { useDbQuery } from '../lib/useDbQuery';
import { BarList, LineChart } from '../components/Charts';
import { Screen } from '../components/Shell';

export function History() {
  const data = useDbQuery(async () => {
    const [exercises, sets, blocks, settings] = await Promise.all([
      db.exercises.toArray(),
      db.sets.toArray(),
      db.mesocycles.toArray(),
      db.settings.get('app'),
    ]);
    blocks.sort((a, b) => b.createdAt - a.createdAt);
    return { exercises, sets, blocks, unit: settings?.unit ?? 'lb' };
  }, []);
  const [mode, setMode] = useState<'strength' | 'volume'>('strength');
  const [blockId, setBlockId] = useState<string | null>(null);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [week, setWeek] = useState(1);

  if (!data) {
    return (
      <Screen>
        <p className="kicker">History</p>
      </Screen>
    );
  }

  const block = data.blocks.find((item) => item.id === (blockId ?? data.blocks[0]?.id)) ?? null;
  const trainedIds = [...new Set(data.sets.filter((set) => set.status === 'done').map((set) => set.exerciseId))];
  const trained = data.exercises.filter((exercise) => trainedIds.includes(exercise.id)).sort((a, b) => a.name.localeCompare(b.name));
  const selectedExercise = trained.find((exercise) => exercise.id === exerciseId) ?? trained[0] ?? null;
  const strength = selectedExercise
    ? strengthSeries(data.sets.filter((set) => set.exerciseId === selectedExercise.id))
    : [];
  const primary = new Map(data.exercises.map((exercise) => [exercise.id, exercise.muscles[0]]));
  const volume = block ? volumeByWeek({ weeks: block.weeks, sets: data.sets.filter((set) => set.mesoId === block.id), primary }) : [];
  const selectedWeek = volume.find((item) => item.week === week) ?? volume[0];

  return (
    <Screen>
      <p className="kicker">History</p>
      <h1>What the work did.</h1>
      <div className="seg" role="tablist">
        <button type="button" className={mode === 'strength' ? 'on' : undefined} onClick={() => setMode('strength')}>
          Strength
        </button>
        <button type="button" className={mode === 'volume' ? 'on' : undefined} onClick={() => setMode('volume')}>
          Weekly sets
        </button>
      </div>

      {mode === 'strength' && (
        <section className="stack">
          {trained.length === 0 && <p className="muted">Log a session and the estimated 1RM chart will show up here.</p>}
          {trained.length > 0 && selectedExercise && (
            <>
              <label className="field">
                <span>Lift</span>
                <select value={selectedExercise.id} onChange={(event) => setExerciseId(event.target.value)}>
                  {trained.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
                </select>
              </label>
              <section className="card">
                <p className="kicker">Estimated 1RM</p>
                <LineChart points={strength.map((point) => ({ label: point.label, value: point.e1rm }))} />
                <p className="faint">Epley estimate from the best set in each session. Bodyweight sets without a load are left off.</p>
              </section>
              <ul className="list">
                {strength.map((point) => (
                  <li key={point.key}>
                    <div className="list-static">
                      <strong>{formatNumber(point.e1rm)}</strong>
                      <span>
                        {point.label} · {formatLoad(point.weight, data.unit)} × {point.reps}
                        {point.at > 10_000_000_000 ? ` · ${formatWhen(point.at)}` : ''}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {mode === 'volume' && (
        <section className="stack">
          {data.blocks.length === 0 && <p className="muted">Start a block to see weekly sets by muscle.</p>}
          {block && (
            <>
              <label className="field">
                <span>Block</span>
                <select
                  value={block.id}
                  onChange={(event) => {
                    setBlockId(event.target.value);
                    setWeek(1);
                  }}
                >
                  {data.blocks.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="chips">
                {volume.map((item) => (
                  <button key={item.week} type="button" className={`chip ${selectedWeek?.week === item.week ? 'on' : ''}`} onClick={() => setWeek(item.week)}>
                    W{item.week} · {item.total}
                  </button>
                ))}
              </div>
              <section className="card">
                <h2>Week {selectedWeek?.week ?? week}</h2>
                <BarList
                  rows={(selectedWeek?.byMuscle ?? []).map((row) => ({
                    label: MUSCLE_LABEL[row.muscle],
                    value: row.sets,
                  }))}
                />
                <p className="faint">Completed sets, counted once toward the lift’s primary muscle. One-time carried sets count here because you did them.</p>
              </section>
            </>
          )}
        </section>
      )}
    </Screen>
  );
}

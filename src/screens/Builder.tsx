import { useEffect, useMemo, useState } from 'react';
import { suggestedRepRange } from '../engine/progression';
import { EQUIPMENT, EQUIPMENT_LABEL, MUSCLE_LABEL, MUSCLES, type Equipment, type MuscleGroup } from '../engine/types';
import { activeBundle, addExercise, createBlock, draftFromBlock } from '../db/actions';
import { db, getSettings } from '../db/db';
import { TEMPLATES, type BlockTemplate } from '../db/templates';
import type { DraftBlock, DraftDay, DraftLift, Exercise } from '../db/types';
import { go } from '../lib/router';
import { useDbQuery } from '../lib/useDbQuery';
import { Screen } from '../components/Shell';
import { Notice, Stepper } from '../components/Ui';

function blankDraft(): DraftBlock {
  const stamp = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return {
    name: `Block · ${stamp}`,
    weeks: 5,
    days: [1, 2, 3, 4].map((number) => ({ name: `Day ${number}`, lifts: [] })),
  };
}

function fromTemplate(template: BlockTemplate): DraftBlock {
  return {
    name: template.name,
    weeks: template.weeks,
    days: template.days.map((day) => ({
      name: day.name,
      lifts: day.lifts.map((lift) => ({
        exerciseId: lift.exerciseId,
        sets: lift.sets,
        repMin: lift.repMin,
        repMax: lift.repMax,
        startingWeight: 0,
        startingReps: lift.repMin,
      })),
    })),
  };
}

function problem(draft: DraftBlock): string | null {
  if (!draft.name.trim()) return 'Name the block.';
  if (draft.weeks < 4 || draft.weeks > 8) return 'Use 4 to 8 weeks.';
  if (draft.days.length < 2 || draft.days.length > 6) return 'Train 2 to 6 days a week.';
  if (draft.days.some((day) => !day.name.trim())) return 'Name every day.';
  if (draft.days.some((day) => day.lifts.length === 0)) return 'Every day needs at least one lift.';
  for (const day of draft.days) {
    for (const lift of day.lifts) {
      if (lift.repMin < 1 || lift.repMax < lift.repMin || lift.repMax > 30) return 'Check the rep ranges.';
      if (lift.startingWeight < 0) return 'Starting load can’t be negative.';
    }
  }
  return null;
}

export function Builder({ fromId }: { fromId: string | null }) {
  const data = useDbQuery(async () => {
    const [exercises, active, settings] = await Promise.all([db.exercises.toArray(), activeBundle(), getSettings()]);
    exercises.sort((a, b) => a.name.localeCompare(b.name));
    return { exercises, active, settings };
  }, []);
  const [draft, setDraft] = useState<DraftBlock>(() => blankDraft());
  const [revision, setRevision] = useState(0);
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!fromId || loadedFrom === fromId) return;
    let cancel = false;
    draftFromBlock(fromId)
      .then((next) => {
        if (!cancel && next) {
          setDraft(next);
          setLoadedFrom(fromId);
          setRevision((value) => value + 1);
        }
      })
      .catch((reason: unknown) => {
        if (!cancel) setError(reason instanceof Error ? reason.message : 'Could not copy that block.');
      });
    return () => {
      cancel = true;
    };
  }, [fromId, loadedFrom]);

  const exercises = data?.exercises ?? [];
  const byId = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
  const issue = problem(draft);

  function updateDay(index: number, patch: (day: DraftDay) => DraftDay) {
    setDraft((current) => ({
      ...current,
      days: current.days.map((day, dayIndex) => (dayIndex === index ? patch(day) : day)),
    }));
  }

  function setDayCount(count: number) {
    setDraft((current) => {
      const days = current.days.slice(0, count);
      while (days.length < count) days.push({ name: `Day ${days.length + 1}`, lifts: [] });
      return { ...current, days };
    });
  }

  function addLift(dayIndex: number, exercise: Exercise) {
    const range = suggestedRepRange(exercise.equipment, exercise.compound);
    updateDay(dayIndex, (day) => {
      if (day.lifts.some((lift) => lift.exerciseId === exercise.id)) return day;
      const lift: DraftLift = {
        exerciseId: exercise.id,
        sets: exercise.compound ? 3 : 2,
        repMin: range.min,
        repMax: range.max,
        startingWeight: 0,
        startingReps: range.min,
      };
      return { ...day, lifts: [...day.lifts, lift] };
    });
    setPicking(null);
  }

  async function start() {
    if (issue) {
      setError(issue);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createBlock(draft);
      go('#/');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start the block.');
      setSaving(false);
    }
  }

  return (
    <Screen>
      <a className="back" href="#/plan">
        Block
      </a>
      <p className="kicker">New block</p>
      <h1>Plan the weeks.</h1>
      <p className="muted">The last week is a deload. Set a starting load if you know it — you can also type it on the first session.</p>
      {data?.active && <Notice>A block is already running. End it on the Block tab before this one can start.</Notice>}

      <label className="field">
        <span>Name</span>
        <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
      </label>

      <div className="split">
        <div>
          <p className="label">Weeks</p>
          <Stepper label="Weeks" min={4} max={8} value={draft.weeks} onChange={(weeks) => setDraft((current) => ({ ...current, weeks }))} />
        </div>
        <div>
          <p className="label">Days / week</p>
          <Stepper label="Days per week" min={2} max={6} value={draft.days.length} onChange={setDayCount} />
        </div>
      </div>

      <p className="label">Templates</p>
      <div className="chips">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="chip"
            data-testid={`template-${template.id}`}
            onClick={() => {
              setDraft(fromTemplate(template));
              setRevision((value) => value + 1);
            }}
          >
            {template.name}
          </button>
        ))}
      </div>
      <p className="faint">A template replaces the days below. You can still edit every lift.</p>

      <div className="stack">
        {draft.days.map((day, dayIndex) => (
          <section key={dayIndex} className="card">
            <label className="field">
              <span>Day {dayIndex + 1}</span>
              <input
                value={day.name}
                onChange={(event) => updateDay(dayIndex, (current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <ul className="stack">
              {day.lifts.map((lift, liftIndex) => {
                const exercise = byId.get(lift.exerciseId);
                return (
                  <li key={`${revision}-${lift.exerciseId}-${liftIndex}`} className="lift-edit">
                    <div className="spread">
                      <strong>{exercise?.name ?? 'Missing lift'}</strong>
                      <span className="faint">{exercise ? EQUIPMENT_LABEL[exercise.equipment] : ''}</span>
                    </div>
                    <div className="split">
                      <div>
                        <p className="label">Sets</p>
                        <Stepper
                          label={`Sets for ${exercise?.name ?? 'lift'}`}
                          min={1}
                          max={6}
                          value={lift.sets}
                          onChange={(sets) =>
                            updateDay(dayIndex, (current) => ({
                              ...current,
                              lifts: current.lifts.map((item, index) => (index === liftIndex ? { ...item, sets } : item)),
                            }))
                          }
                        />
                      </div>
                      <WeightInput
                        label={`Start ${data?.settings.unit ?? 'lb'}`}
                        value={lift.startingWeight}
                        onChange={(startingWeight) =>
                          updateDay(dayIndex, (current) => ({
                            ...current,
                            lifts: current.lifts.map((item, index) => (index === liftIndex ? { ...item, startingWeight } : item)),
                          }))
                        }
                      />
                    </div>
                    <div className="split">
                      <div>
                        <p className="label">Reps from</p>
                        <Stepper
                          label="Minimum reps"
                          min={1}
                          max={lift.repMax}
                          value={lift.repMin}
                          onChange={(repMin) =>
                            updateDay(dayIndex, (current) => ({
                              ...current,
                              lifts: current.lifts.map((item, index) =>
                                index === liftIndex ? { ...item, repMin, startingReps: Math.max(repMin, Math.min(item.startingReps, item.repMax)) } : item,
                              ),
                            }))
                          }
                        />
                      </div>
                      <div>
                        <p className="label">Reps to</p>
                        <Stepper
                          label="Maximum reps"
                          min={lift.repMin}
                          max={30}
                          value={lift.repMax}
                          onChange={(repMax) =>
                            updateDay(dayIndex, (current) => ({
                              ...current,
                              lifts: current.lifts.map((item, index) => (index === liftIndex ? { ...item, repMax } : item)),
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn btn-small btn-ghost"
                        disabled={liftIndex === 0}
                        onClick={() =>
                          updateDay(dayIndex, (current) => {
                            const lifts = [...current.lifts];
                            [lifts[liftIndex - 1], lifts[liftIndex]] = [lifts[liftIndex], lifts[liftIndex - 1]];
                            return { ...current, lifts };
                          })
                        }
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="btn btn-small btn-ghost"
                        disabled={liftIndex === day.lifts.length - 1}
                        onClick={() =>
                          updateDay(dayIndex, (current) => {
                            const lifts = [...current.lifts];
                            [lifts[liftIndex + 1], lifts[liftIndex]] = [lifts[liftIndex], lifts[liftIndex + 1]];
                            return { ...current, lifts };
                          })
                        }
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="btn btn-small btn-danger"
                        onClick={() =>
                          updateDay(dayIndex, (current) => ({
                            ...current,
                            lifts: current.lifts.filter((_, index) => index !== liftIndex),
                          }))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setPicking(dayIndex)}>
              Add a lift
            </button>
          </section>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {issue && <p className="faint">{issue}</p>}
      <button type="button" className="btn btn-primary btn-block" data-testid="start-block" disabled={Boolean(issue) || saving || Boolean(data?.active)} onClick={() => void start()}>
        Start block
      </button>

      {picking !== null && (
        <Picker
          exercises={exercises}
          taken={new Set(draft.days[picking]?.lifts.map((lift) => lift.exerciseId))}
          onClose={() => setPicking(null)}
          onPick={(exercise) => addLift(picking, exercise)}
          onCreated={(exercise) => addLift(picking, exercise)}
        />
      )}
    </Screen>
  );
}

function WeightInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(value > 0 ? String(value) : '');
  return (
    <label className="field compact">
      <span>{label}</span>
      <input
        inputMode="decimal"
        value={text}
        placeholder="Optional"
        onChange={(event) => {
          const next = event.target.value.replace(',', '.');
          if (next !== '' && !/^\d*\.?\d*$/.test(next)) return;
          setText(next);
          if (next.trim() === '' || next === '.') {
            onChange(0);
            return;
          }
          const parsed = Number(next);
          if (Number.isFinite(parsed)) onChange(Math.round(parsed * 100) / 100);
        }}
      />
    </label>
  );
}

function Picker({
  exercises,
  taken,
  onClose,
  onPick,
  onCreated,
}: {
  exercises: Exercise[];
  taken: Set<string>;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
  onCreated: (exercise: Exercise) => void;
}) {
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<Equipment | 'all'>('all');
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const filtered = exercises.filter((exercise) => {
    if (equipment !== 'all' && exercise.equipment !== equipment) return false;
    if (muscle !== 'all' && !exercise.muscles.includes(muscle)) return false;
    if (query && !exercise.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div className="picker">
      <header className="spread">
        <h2>Add a lift</h2>
        <button type="button" className="text-btn" onClick={onClose}>
          Close
        </button>
      </header>
      <input placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search lifts" />
      <div className="chips">
        <button type="button" className={`chip ${equipment === 'all' ? 'on' : ''}`} onClick={() => setEquipment('all')}>
          All gear
        </button>
        {EQUIPMENT.map((item) => (
          <button key={item} type="button" className={`chip ${equipment === item ? 'on' : ''}`} onClick={() => setEquipment(item)}>
            {EQUIPMENT_LABEL[item]}
          </button>
        ))}
      </div>
      <div className="chips">
        <button type="button" className={`chip ${muscle === 'all' ? 'on' : ''}`} onClick={() => setMuscle('all')}>
          All muscles
        </button>
        {MUSCLES.map((item) => (
          <button key={item} type="button" className={`chip ${muscle === item ? 'on' : ''}`} onClick={() => setMuscle(item)}>
            {MUSCLE_LABEL[item]}
          </button>
        ))}
      </div>
      <ul className="list">
        {filtered.map((exercise) => (
          <li key={exercise.id}>
            <button type="button" disabled={taken.has(exercise.id)} onClick={() => onPick(exercise)}>
              <strong>{exercise.name}</strong>
              <span>
                {MUSCLE_LABEL[exercise.muscles[0]]} · {EQUIPMENT_LABEL[exercise.equipment]}
                {taken.has(exercise.id) ? ' · already on this day' : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && <p className="muted">No lifts match.</p>}
      <button type="button" className="btn btn-ghost btn-block" onClick={() => setCreating((value) => !value)}>
        {creating ? 'Hide custom lift' : 'New custom lift'}
      </button>
      {creating && <CustomLift onCreated={onCreated} />}
    </div>
  );
}

function CustomLift({ onCreated }: { onCreated: (exercise: Exercise) => void }) {
  const [name, setName] = useState('');
  const [equipment, setEquipment] = useState<Equipment>('dumbbell');
  const [compound, setCompound] = useState(false);
  const [primary, setPrimary] = useState<MuscleGroup>('chest');
  const [secondary, setSecondary] = useState<MuscleGroup[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError('Name the lift.');
      return;
    }
    const muscles = [primary, ...secondary.filter((muscle) => muscle !== primary)];
    const id = await addExercise({ name: name.trim(), equipment, compound, muscles });
    onCreated({ id, name: name.trim(), equipment, compound, muscles, custom: true, createdAt: Date.now() });
  }

  return (
    <div className="card">
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="field">
        <span>Equipment</span>
        <select value={equipment} onChange={(event) => setEquipment(event.target.value as Equipment)}>
          {EQUIPMENT.map((item) => (
            <option key={item} value={item}>
              {EQUIPMENT_LABEL[item]}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className={`chip ${compound ? 'on' : ''}`} aria-pressed={compound} onClick={() => setCompound((value) => !value)}>
        {compound ? 'Compound' : 'Isolation'}
      </button>
      <p className="label">Primary muscle</p>
      <div className="chips">
        {MUSCLES.map((muscle) => (
          <button key={muscle} type="button" className={`chip ${primary === muscle ? 'on' : ''}`} onClick={() => setPrimary(muscle)}>
            {MUSCLE_LABEL[muscle]}
          </button>
        ))}
      </div>
      <p className="label">Also hits</p>
      <div className="chips">
        {MUSCLES.filter((muscle) => muscle !== primary).map((muscle) => (
          <button
            key={muscle}
            type="button"
            className={`chip ${secondary.includes(muscle) ? 'on' : ''}`}
            onClick={() =>
              setSecondary((current) => (current.includes(muscle) ? current.filter((item) => item !== muscle) : [...current, muscle]))
            }
          >
            {MUSCLE_LABEL[muscle]}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button type="button" className="btn btn-primary btn-block" onClick={() => void save()}>
        Save lift
      </button>
    </div>
  );
}

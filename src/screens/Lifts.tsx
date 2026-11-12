import { useState } from 'react';
import { EQUIPMENT, EQUIPMENT_LABEL, MUSCLE_LABEL, MUSCLES, type Equipment, type MuscleGroup } from '../engine/types';
import { addExercise, deleteExercise } from '../db/actions';
import { db } from '../db/db';
import { useDbQuery } from '../lib/useDbQuery';
import { Screen } from '../components/Shell';

export function Lifts() {
  const exercises = useDbQuery(async () => {
    const rows = await db.exercises.toArray();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, []);
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<Equipment | 'all'>('all');
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = (exercises ?? []).filter((exercise) => {
    if (equipment !== 'all' && exercise.equipment !== equipment) return false;
    if (muscle !== 'all' && !exercise.muscles.includes(muscle)) return false;
    if (query && !exercise.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <Screen>
      <p className="kicker">Library</p>
      <h1>Lifts</h1>
      <label className="field">
        <span className="sr">Search lifts</span>
        <input placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="chips">
        <FilterChip on={equipment === 'all'} onClick={() => setEquipment('all')}>
          All gear
        </FilterChip>
        {EQUIPMENT.map((item) => (
          <FilterChip key={item} on={equipment === item} onClick={() => setEquipment(item)}>
            {EQUIPMENT_LABEL[item]}
          </FilterChip>
        ))}
      </div>
      <div className="chips">
        <FilterChip on={muscle === 'all'} onClick={() => setMuscle('all')}>
          All muscles
        </FilterChip>
        {MUSCLES.map((item) => (
          <FilterChip key={item} on={muscle === item} onClick={() => setMuscle(item)}>
            {MUSCLE_LABEL[item]}
          </FilterChip>
        ))}
      </div>
      <p className="faint">{filtered.length} lifts</p>
      <ul className="list">
        {filtered.map((exercise) => (
          <li key={exercise.id}>
            <div className="list-static">
              <strong>{exercise.name}</strong>
              <span>
                {exercise.muscles.map((item) => MUSCLE_LABEL[item]).join(', ')} · {EQUIPMENT_LABEL[exercise.equipment]}
                {exercise.custom ? ' · custom' : ''}
              </span>
            </div>
            {exercise.custom && (
              <button
                type="button"
                className="text-btn"
                onClick={() => {
                  deleteExercise(exercise.id).catch((reason: unknown) => {
                    setError(reason instanceof Error ? reason.message : 'Could not remove that lift.');
                  });
                }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="error">{error}</p>}
      <button type="button" className="btn btn-primary btn-block" onClick={() => setCreating((value) => !value)}>
        {creating ? 'Close' : 'Add a custom lift'}
      </button>
      {creating && (
        <CustomForm
          onSaved={() => {
            setCreating(false);
            setError(null);
          }}
        />
      )}
    </Screen>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

function CustomForm({ onSaved }: { onSaved: () => void }) {
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
    await addExercise({
      name: name.trim(),
      equipment,
      compound,
      muscles: [primary, ...secondary.filter((muscle) => muscle !== primary)],
    });
    onSaved();
  }

  return (
    <form
      className="card stack"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
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
        {compound ? 'Compound lift' : 'Isolation lift'}
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
      <button type="submit" className="btn btn-primary btn-block">
        Save lift
      </button>
    </form>
  );
}

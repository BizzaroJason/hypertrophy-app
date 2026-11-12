import { useState } from 'react';
import type { Unit } from '../engine/types';
import { exportBackup, importBackup, parseBackup, updateSettings } from '../db/actions';
import { db, getSettings } from '../db/db';
import { saveTextFile, setsToCsv } from '../lib/export';
import { useDbQuery } from '../lib/useDbQuery';
import { Screen } from '../components/Shell';
import { Sheet, Stepper } from '../components/Ui';

export function More() {
  const data = useDbQuery(async () => {
    const [settings, setCount] = await Promise.all([getSettings(), db.sets.count()]);
    return { settings, setCount };
  }, []);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingUnit, setPendingUnit] = useState<Unit | null>(null);
  const [pendingBackup, setPendingBackup] = useState<unknown>(null);

  if (!data) {
    return (
      <Screen>
        <p className="kicker">More</p>
      </Screen>
    );
  }

  const { settings, setCount } = data;

  async function chooseUnit(unit: Unit) {
    if (unit === settings.unit) return;
    if (setCount > 0) {
      setPendingUnit(unit);
      return;
    }
    await updateSettings({ unit });
  }

  async function exportCsv() {
    const [sets, blocks, days, exercises] = await Promise.all([
      db.sets.toArray(),
      db.mesocycles.toArray(),
      db.days.toArray(),
      db.exercises.toArray(),
    ]);
    const csv = setsToCsv({ sets, blocks, days, exercises, unit: settings.unit });
    const result = await saveTextFile(`kiln-sets-${stamp()}.csv`, 'text/csv', csv);
    if (result !== 'cancelled') setMessage(result === 'shared' ? 'CSV ready to share.' : 'CSV downloaded.');
  }

  async function backup() {
    const file = await exportBackup();
    const result = await saveTextFile(`kiln-backup-${stamp()}.json`, 'application/json', JSON.stringify(file, null, 2));
    if (result !== 'cancelled') setMessage(result === 'shared' ? 'Backup ready to share.' : 'Backup downloaded.');
  }

  async function restore(file: File) {
    try {
      const parsed = parseBackup(JSON.parse(await file.text()));
      setPendingBackup(parsed);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not read that file.');
    }
  }

  return (
    <Screen>
      <p className="kicker">More</p>
      <h1>On this phone.</h1>
      <p className="muted">Kiln has no account. The library, blocks, and logs live in this browser until you export them.</p>

      <section className="card">
        <h2>Units</h2>
        <div className="seg">
          <button type="button" className={settings.unit === 'lb' ? 'on' : undefined} onClick={() => void chooseUnit('lb')}>
            Pounds
          </button>
          <button type="button" className={settings.unit === 'kg' ? 'on' : undefined} onClick={() => void chooseUnit('kg')}>
            Kilograms
          </button>
        </div>
        <p className="faint">Switching units does not convert numbers already logged.</p>
      </section>

      <section className="card">
        <h2>Rest timer</h2>
        <p className="label">Compounds</p>
        <Stepper
          label="Compound rest seconds"
          min={30}
          max={300}
          step={15}
          suffix="sec"
          value={settings.restCompound}
          onChange={(restCompound) => void updateSettings({ restCompound })}
        />
        <p className="label">Isolations</p>
        <Stepper
          label="Isolation rest seconds"
          min={30}
          max={300}
          step={15}
          suffix="sec"
          value={settings.restIsolation}
          onChange={(restIsolation) => void updateSettings({ restIsolation })}
        />
      </section>

      <section className="card stack">
        <h2>Your data</h2>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => void exportCsv().catch(() => setError('Could not export the CSV.'))}>
          Export sets as CSV
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => void backup().catch(() => setError('Could not save the backup.'))}>
          Back up everything as JSON
        </button>
        <label className="btn btn-ghost btn-block file-btn">
          Restore a backup
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void restore(file);
            }}
          />
        </label>
        <a className="btn btn-ghost btn-block" href="#/archive">
          Archive
        </a>
      </section>

      <section className="card">
        <h2>Install</h2>
        <p>On iPhone, open this site in Safari, tap Share, then Add to Home Screen. Open Kiln from the icon once while you are online. After that it runs without a connection.</p>
        <a className="text-btn" href="#/rules">
          Read the progression rules
        </a>
      </section>

      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}

      {pendingUnit && (
        <Sheet
          title={`Switch to ${pendingUnit}?`}
          confirmLabel="Switch"
          onClose={() => setPendingUnit(null)}
          onConfirm={() => {
            void updateSettings({ unit: pendingUnit }).then(() => setPendingUnit(null));
          }}
        >
          <p>Numbers stay as entered. A 100 you logged in {settings.unit} will read as 100 {pendingUnit}. Plate jumps follow the new unit from the next recommendation.</p>
        </Sheet>
      )}

      {pendingBackup != null && (
        <Sheet
          title="Replace everything on this phone?"
          confirmLabel="Restore"
          danger
          onClose={() => setPendingBackup(null)}
          onConfirm={() => {
            void importBackup(pendingBackup)
              .then(() => {
                setPendingBackup(null);
                setMessage('Backup restored.');
              })
              .catch((reason: unknown) => {
                setPendingBackup(null);
                setError(reason instanceof Error ? reason.message : 'Could not restore that backup.');
              });
          }}
        >
          <p>
            This backup includes {(pendingBackup as { sets?: unknown[] }).sets?.length ?? 0} set logs and{' '}
            {(pendingBackup as { mesocycles?: unknown[] }).mesocycles?.length ?? 0} blocks. Current data on this phone will be replaced.
          </p>
        </Sheet>
      )}
    </Screen>
  );
}

function stamp(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}${month}${day}`;
}

import { liveQuery } from 'dexie';
import { useEffect, useRef, useState, type DependencyList } from 'react';

export function useDbQuery<T>(querier: () => Promise<T>, deps: DependencyList): T | undefined {
  const latest = useRef(querier);
  latest.current = querier;
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const subscription = liveQuery(() => latest.current()).subscribe({
      next: (next) => {
        if (active) setValue(next);
      },
      error: (error) => {
        console.error(error);
      },
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // The caller supplies the dependency list for the query closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}

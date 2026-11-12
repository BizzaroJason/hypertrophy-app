import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'session'; mesoId: string; week: number; dayIndex: number }
  | { name: 'feedback'; mesoId: string; week: number; dayIndex: number }
  | { name: 'plan' }
  | { name: 'builder'; fromId: string | null }
  | { name: 'lifts' }
  | { name: 'history' }
  | { name: 'archive' }
  | { name: 'archiveDetail'; mesoId: string }
  | { name: 'more' }
  | { name: 'rules' };

export function parseRoute(hash: string): Route {
  const raw = (hash || '#/').replace(/^#/, '');
  const [pathPart, queryPart] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const query = new URLSearchParams(queryPart ?? '');
  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'session' && parts[1]) {
    return { name: 'session', mesoId: decodeURIComponent(parts[1]), week: Number(parts[2]), dayIndex: Number(parts[3]) };
  }
  if (parts[0] === 'feedback' && parts[1]) {
    return { name: 'feedback', mesoId: decodeURIComponent(parts[1]), week: Number(parts[2]), dayIndex: Number(parts[3]) };
  }
  if (parts[0] === 'plan' && parts[1] === 'new') return { name: 'builder', fromId: query.get('from') };
  if (parts[0] === 'plan') return { name: 'plan' };
  if (parts[0] === 'lifts') return { name: 'lifts' };
  if (parts[0] === 'history') return { name: 'history' };
  if (parts[0] === 'archive' && parts[1]) return { name: 'archiveDetail', mesoId: decodeURIComponent(parts[1]) };
  if (parts[0] === 'archive') return { name: 'archive' };
  if (parts[0] === 'more') return { name: 'more' };
  if (parts[0] === 'rules') return { name: 'rules' };
  return { name: 'home' };
}

export function go(path: string): void {
  const next = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`;
  if (window.location.hash !== next) window.location.hash = next;
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return parseRoute(hash);
}

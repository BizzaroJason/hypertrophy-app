import type { ReactNode } from 'react';
import type { Route } from '../lib/router';

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ITEMS: { href: string; label: string; testId: string; match: (route: Route) => boolean; icon: string }[] = [
  {
    href: '#/',
    label: 'Today',
    testId: 'nav-today',
    match: (route) => route.name === 'home',
    icon: 'M12 4v16M5 12h14',
  },
  {
    href: '#/plan',
    label: 'Block',
    testId: 'nav-plan',
    match: (route) => route.name === 'plan' || route.name === 'builder',
    icon: 'M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z',
  },
  {
    href: '#/lifts',
    label: 'Lifts',
    testId: 'nav-lifts',
    match: (route) => route.name === 'lifts',
    icon: 'M4 12h16M7 8v8M17 8v8M10 10v4M14 10v4',
  },
  {
    href: '#/history',
    label: 'History',
    testId: 'nav-history',
    match: (route) => route.name === 'history',
    icon: 'M4 16l5-5 3 3 7-7M4 20h16',
  },
  {
    href: '#/more',
    label: 'More',
    testId: 'nav-more',
    match: (route) => route.name === 'more' || route.name === 'rules' || route.name === 'archive' || route.name === 'archiveDetail',
    icon: 'M6 12h.01M12 12h.01M18 12h.01',
  },
];

export function Nav({ route }: { route: Route }) {
  return (
    <nav className="nav" aria-label="Primary">
      {ITEMS.map((item) => (
        <a key={item.href} href={item.href} data-testid={item.testId} className={item.match(route) ? 'active' : undefined} aria-current={item.match(route) ? 'page' : undefined}>
          <Icon d={item.icon} />
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

export function Screen({
  children,
  bare = false,
}: {
  children: ReactNode;
  bare?: boolean;
}) {
  return <main className={bare ? 'screen screen-bare' : 'screen'}>{children}</main>;
}

import { Nav, Screen } from './components/Shell';
import { useRoute } from './lib/router';
import { Archive, ArchiveDetail } from './screens/Archive';
import { Builder } from './screens/Builder';
import { Feedback } from './screens/Feedback';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Lifts } from './screens/Lifts';
import { More } from './screens/More';
import { Plan } from './screens/Plan';
import { Rules } from './screens/Rules';
import { Session } from './screens/Session';

export function App() {
  const route = useRoute();
  const bare = route.name === 'session' || route.name === 'feedback';

  let body = (
    <Screen>
      <p>That page is not in Kiln.</p>
    </Screen>
  );
  if (route.name === 'home') body = <Home />;
  if (route.name === 'session') body = <Session mesoId={route.mesoId} week={route.week} dayIndex={route.dayIndex} />;
  if (route.name === 'feedback') body = <Feedback mesoId={route.mesoId} week={route.week} dayIndex={route.dayIndex} />;
  if (route.name === 'plan') body = <Plan />;
  if (route.name === 'builder') body = <Builder fromId={route.fromId} />;
  if (route.name === 'lifts') body = <Lifts />;
  if (route.name === 'history') body = <History />;
  if (route.name === 'archive') body = <Archive />;
  if (route.name === 'archiveDetail') body = <ArchiveDetail mesoId={route.mesoId} />;
  if (route.name === 'more') body = <More />;
  if (route.name === 'rules') body = <Rules />;

  return (
    <div className="app-frame">
      {body}
      {!bare && <Nav route={route} />}
    </div>
  );
}

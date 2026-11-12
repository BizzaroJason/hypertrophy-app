import { Screen } from '../components/Shell';

export function Rules() {
  return (
    <Screen>
      <a className="back" href="#/more">
        More
      </a>
      <p className="kicker">Rules</p>
      <h1>How a block moves.</h1>
      <section className="card">
        <h2>Weeks</h2>
        <p>A block is 4 to 8 weeks. The last week is always a deload: about half the sets, roughly 10% less load, and an easy effort. A 5-week block asks you to leave 3, then 2, then 1, then 0 reps in the tank before that easy week.</p>
      </section>
      <section className="card">
        <h2>Reps and load</h2>
        <p>Kiln looks at the last programmed set you completed for that lift. One-time carried sets do not count.</p>
        <ul>
          <li>Hit the target inside the rep range, and the next target is one rep higher.</li>
          <li>Go past the top of the range, and the load goes up one step while reps return to the bottom.</li>
          <li>Miss the target, and the same load and reps come back.</li>
        </ul>
        <p>Barbell, cable, and machine steps are 5 lb or 2.5 kg. Dumbbells jump 5 lb or 2 kg. Bodyweight work climbs by reps only.</p>
      </section>
      <section className="card">
        <h2>Sets</h2>
        <p>After a session, rate pump, soreness, joints, and workload. Next week’s sets move for lifts whose primary muscle matches the rating.</p>
        <ul>
          <li>Painful joints take two sets off. Uncomfortable joints take one.</li>
          <li>Limiting soreness, too much work, or an excessive pump on a hard day takes one set off.</li>
          <li>Low pump, no soreness, and easy work add one set.</li>
          <li>Anything else holds.</li>
        </ul>
        <p>A lift stays between 1 and 6 sets. Extra sets land on the smallest lift for that muscle. Cuts come off the largest.</p>
      </section>
      <section className="card">
        <h2>Skipped sets</h2>
        <p>If you skip sets, Kiln can carry them once to the next time that lift appears. They do not join the standing set count, and they do not change the following week’s load.</p>
      </section>
    </Screen>
  );
}

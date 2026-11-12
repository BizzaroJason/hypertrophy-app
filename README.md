# Kiln

Kiln is a free, offline hypertrophy trainer. You pick lifts, build a block of 4–8 weeks, log the work, and the next session already has a load and a rep target. Everything stays in the browser. There is no account, no server, and nothing to pay for.

The app is a static site. It installs on an iPhone from Safari with **Add to Home Screen**. No Apple developer account is required.

## What it does

- A built-in library of barbell, dumbbell, cable, machine, and bodyweight lifts, each tagged with muscles and equipment. Add your own.
- A block builder: 4–8 weeks (the last week is a deload), 2–6 training days, a name for each day, and a starting set count per lift. Four templates are included, and a finished block can be copied into the next one.
- Session logging with the target load and reps, last week’s sets beside them, done or skipped, and a rest timer.
- A progression engine for effort, load, reps, and weekly set counts. The rules are below and in [`src/engine/progression.ts`](src/engine/progression.ts).
- Skipped sets can be carried once to the next session of that lift. They do not become part of the ongoing plan.
- Start the deload early, or end the block. Ending marks the remaining days skipped and archives it.
- History: an estimated 1RM chart per lift, and completed sets per muscle for each week.
- Export every logged set as CSV. Back up or restore the whole database as JSON.

## Progression rules

These match the code. A block is 4 to 8 weeks. The last week is always a deload.

### Effort

Working weeks step down toward 0 reps in reserve on the final hard week, and the opening week is capped at 4 so a long block does not start too easy.

| Block | Week targets |
| --- | --- |
| 4 weeks | 2, 1, 0, deload |
| 5 weeks | 3, 2, 1, 0, deload |
| 6 weeks | 4, 3, 2, 1, 0, deload |
| 8 weeks | 4, 4, 4, 3, 2, 1, 0, deload |

The deload is easy: leave about 4 reps in the tank. Kiln does not ask you to type a reserve number after the set. The rep target is the prescription. If you miss it, the load does not go up.

### Load and reps

Each week looks at the last programmed set you actually completed for that lift. One-time carried sets are ignored. The load you lifted is what progresses, even if it was not the suggested number.

- Hit the target and another rep still fits in the range: next week’s rep target is the reps you did, plus one. The load stays.
- Clear the top of the range, or one more rep would leave the range: add one equipment step and aim at the bottom of the range.
- Miss the target: same load, same rep target.
- First week: the starting load and reps from the builder. Leave the load blank and type it during the first session if you do not know it yet.

Equipment steps:

| Equipment | Pounds | Kilograms |
| --- | --- | --- |
| Barbell, cable, machine | 5 lb | 2.5 kg |
| Dumbbell | 5 lb | 2 kg |
| Bodyweight | reps only | reps only |

A step up lands on the next multiple above the load you used. 137 lb with a 5 lb step becomes 140. A deload takes about 10% off, rounds down to a step, and never rounds a real load down to zero. Deload reps go to the bottom of the range, and the set count is cut in half (at least 1 set remains).

Suggested ranges when you add a lift: barbell compounds 6–10, other compounds 8–12, isolations 10–15. Templates and the builder can override those.

### Sets, from the post-workout ratings

Week 1 uses the set counts you chose (1–6 per lift). After a session you rate pump, soreness, joints, and workload for every muscle that day trained. Several ratings for the same muscle in one week are merged: joints, soreness, and workload keep the worst score, and pump is the average.

A rating counts only when that muscle was actually trained that day (at least one completed set on a lift that tags it). Skipping a day and saving the screen does not water down a real rating from another day.

That merged rating changes the **next working week** for lifts whose **primary** muscle is the one you rated:

| What you reported | Next week |
| --- | --- |
| Painful joints | −2 sets |
| Uncomfortable joints | −1 set |
| Limiting soreness, or too much work | −1 set |
| Excessive pump on a hard day | −1 set |
| Low pump, no soreness, and easy work | +1 set |
| Anything else | hold |

Joint pain is decided first, so a sore joint never gains a set. An added set goes to that muscle’s primary lift with the fewest sets. A removed set comes off the primary lift with the most. Nothing leaves the 1–6 range. A muscle that only showed up as a secondary mover does not change a lift’s count.

The deload does not take a feedback bump. It halves whatever the last hard week had programmed.

Neutral ratings (a decent pump, mild soreness, fine joints, solid work) hold the sets, so saving the screen without changes does not inflate volume.

### Skipped sets

Finishing a session that has skipped sets offers to carry them once. They appear on the next session of that same lift, tagged as one-time, with that day’s target. They are not part of the standing set count, they do not move the following week’s load, and they do not come back unless you skip and carry again. A session will not add more than 6 one-time sets.

### Ending a block, or deloading early

**Start deload early** marks the remaining hard sessions skipped and opens the deload week.

**End block** marks every unfinished session skipped and archives the block. Archived blocks stay available to review, to include in the charts, and to copy.

## Local development

Requirements: Node.js 20 or newer. No API keys.

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:5173/hypertrophy-app/](http://localhost:5173/hypertrophy-app/). The `/hypertrophy-app/` base path matches GitHub Pages.

```bash
npm run build
npm run preview
```

The production build is served at [http://localhost:4173/hypertrophy-app/](http://localhost:4173/hypertrophy-app/). `npm test` runs the progression engine tests in Vitest. `npm run build` typechecks, then builds the static site and the service worker.

## Deploy on GitHub Pages for free

The repo is published as a project site, so the public URL is:

`https://<your-user>.github.io/hypertrophy-app/`

Vite’s `base` is already `/hypertrophy-app/`. If the GitHub repository is not named `hypertrophy-app`, either rename it or change `base` in `vite.config.ts` to `/<repository-name>/` and update the manifest `start_url` and `scope` to the same path.

The workflow in [`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs on every push to `main`. It installs dependencies, runs the tests, builds the site, and deploys the `dist` folder with GitHub’s official Pages actions. That path does not use a paid plan, a custom server, or a third-party host.

Enable it once:

1. Push this project to the `main` branch of the GitHub repository.
2. Open the repository on GitHub.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Open the **Actions** tab. The “Deploy GitHub Pages” workflow should run. If it does not, use **Run workflow**.
6. When the deploy job finishes, the site URL is on the workflow summary and under **Settings → Pages**.

The first successful online visit stores the app shell in the service worker. After that, the installed app opens without a network. Open it online again when you want a newly published version.

GitHub Pages on a public repository is free. Private repositories can also use Pages on the free tier for personal accounts, with the same workflow.

## Install on an iPhone

Use Safari. Chrome on iOS will not add a proper home-screen app.

1. Deploy the site, or open the GitHub Pages URL above. You can also use a computer on the same Wi-Fi only if you have another way to reach it; the phone needs the real URL in Safari.
2. Open the site **once while online** so Safari can save the offline copy.
3. Tap the **Share** button (the square with the arrow).
4. Scroll the share sheet and tap **Add to Home Screen**.
5. The name should read **Kiln**. Tap **Add**.
6. Open Kiln from the home screen. It runs full screen, without Safari’s address bar.
7. Turn on airplane mode and open Kiln again. The library, the block, and the logs are on the phone.

A few iPhone notes:

- Add it to the home screen. Safari can delete website data for sites you only visit in a tab. An installed app is much more likely to keep IndexedDB.
- The backup button is still the durable copy. Use **More → Back up everything as JSON** and keep that file somewhere else (Files, iCloud Drive, a computer). **Restore a backup** replaces whatever is on the phone.
- **More → Export sets as CSV** writes every logged set. On iOS, the share sheet is the reliable way to save it.
- There is no App Store listing and no developer certificate. Home Screen is the install.

## Data

Kiln uses IndexedDB in the browser (via Dexie). Nothing is uploaded. Uninstalling the home-screen icon, or clearing Safari website data, can delete the logs. Export a JSON backup when a block matters.

Switching pounds and kilograms does not convert numbers already stored. A `100` logged as pounds will read as `100` if you later switch to kilograms. Pick the unit in **More** before the first session.

## Project layout

```
src/engine/progression.ts   rules and pure functions
src/engine/progression.test.ts
src/db/                     IndexedDB, seed library, templates, backup
src/screens/                phone UI
public/                     icons, including apple-touch-icon
.github/workflows/pages.yml GitHub Pages deploy
```

## License

Use it however you like. It is a personal training log, not a medical device.

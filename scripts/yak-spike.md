# Yak styling spike

This spike migrates the same 16 components as [the Linaria spike](https://github.com/getsentry/sentry/pull/127144): Container, Flex, Grid, Stack, Surface, Text, Heading, Separator, Quote, IndeterminateLoader, InlineCode, Kbd, Button, LinkButton, DropdownButton, and Link.

It uses [Yak](https://github.com/galaxuslabs/yak), published as `@yak/react@10.0.0`, with its official Rsbuild plugin. See the [Yak documentation](https://yak.js.org/) and [styled-components migration guide](https://yak.js.org/docs/migration-from-styled-components).

## Migration approach

Static declarations and conditional style blocks use native Yak `styled`, `css`, and `keyframes`. Layout and text primitives keep their open-ended values through extracted selectors and inline CSS variables. The `.yak.ts` module generates the property and breakpoint rules at build time. Run `pnpm gen:yak-layout` when the breakpoint scales change. Adding breakpoint keys also requires updating `YAK_RESPONSIVE_KEYS`.

The existing Emotion theme context supplies live tokens to Yak components. This preserves nested color overrides during the partial migration. Emotion style helpers remain exported for components outside the scope. The app still includes Emotion; this spike does not measure a complete removal of its runtime.

Small adapters preserve DOM prop filtering and the public `as` API. The menu wrapper must pass `as` through to Flex; otherwise Emotion can replace the element and skip the new layout implementation. Render-prop callers must forward both `className` and `style`. The tag drawer combines both style objects from its nested render props.

This is not an import-only migration from Emotion. Yak cannot export dynamic `css` mixins. The shared button implementation instead exports a styled component with local conditions. Dynamic lookups of mixins from an object did not produce the expected rules during the spike; the implementation uses explicit conditions with static mixin references.

The app preserves the official Yak preloader when Sentry replaces the default Rsbuild rules. A loader and collector add the extracted styles from all compiled chunks to the existing `sentry.css`, in component dependency order. This preserves the Django asset contract and loads the styles before Emotion overrides. The replay runner rejects a page with missing extracted layout styles. The unbundled Scraps package build collects the compiled CSS data imports into `dist/styles.css`. Package consumers must import `@sentry/scraps/styles.css` in their browser entry. JavaScript exports can load in Node without importing a stylesheet. Existing Emotion `css` prop usage remains enabled through `strictCssProp: false`.

## Measurement method

Both variants use base `587e422c88aaf34ea81fb81ea2fec2662c3f5102` and the same dependency installation. The Yak variant was measured from the working tree. The results file records the exact source list and digest used for those measurements.

Measurements were taken on 2026-10-29: Apple M3 Pro, 11 logical CPUs, 36 GiB RAM, Node 26.12.1, pnpm 12.10.1, Chromium 149.0.7827.55, 1440 × 900 viewport, 1× CPU. Both builds use production React, no React Compiler, and no JavaScript minification. Development checks and build work stopped before timing. IntelliJ indexing was closed. Other desktop apps remained open. The page test was later repeated after other agent/build jobs were paused. Ordinary desktop applications remained open. The two page build servers remained idle during page measurements.

These are controlled Emotion/Yak comparisons on the current base. The historical Linaria and StyleX timing tables use different revisions and are not a direct comparison with these numbers.

## Component benchmark

The fixture and measurement loop come from the Linaria spike. Each value is the median of 15 runs. Variant order rotates. Each run mounts, changes props, then returns to the first props for a cached update. Timing includes synchronous React work and forced layout. It excludes navigation and initial asset loading.

| Workload | Operation    | Emotion ms | Yak ms | Yak change |
| -------- | ------------ | ---------: | -----: | ---------: |
| layout   | mount        |       87.9 |   68.2 |     -22.4% |
| layout   | update       |       67.4 |   46.9 |     -30.4% |
| layout   | cachedUpdate |       60.9 |   46.7 |     -23.3% |
| mixed    | mount        |      162.3 |  142.5 |     -12.2% |
| mixed    | update       |       78.1 |   64.7 |     -17.2% |
| mixed    | cachedUpdate |       80.0 |   70.0 |     -12.5% |

The layout fixture has 750 rows and 7,503 elements. The mixed fixture has 250 rows and 8,253 elements and exercises all 16 components. Element counts and heights match. Computed-style checks match at widths of 600 and 1,440 pixels in light and dark themes. The checks include responsive container and viewport gaps, nested theme overrides, render props, Emotion wrappers, dropdown icons and variants, routed LinkButtons, and 72 button size/variant/state combinations. The same checks pass with the stylesheet collected by the real app build.

Yak made zero runtime `CSSStyleSheet.insertRule` calls. Emotion made 45 calls on layout mount and 97 on mixed mount, rising to 49 and 138 after updates. These counts are cumulative within each run.

Yak reduces median render time by 12–30% in this fixture. Browser style recalculation increases: layout mount is 4.0 → 7.9 ms, and mixed mount is 14.2 → 22.9 ms. The layout updates also spend more time on style recalculation. Extracted CSS removes runtime rule insertion but does not remove browser style work.

| Component bundle, gzip bytes | Emotion |     Yak |
| ---------------------------- | ------: | ------: |
| JavaScript                   | 404,605 | 413,056 |
| Extracted CSS                |       0 |  16,338 |
| Total                        | 404,605 | 429,394 |

The Yak total adds 24,789 gzip bytes (+6.1%). Its extracted CSS is 180,887 bytes before gzip. The generated responsive vocabulary contributes to this cost. These are component fixture sizes, not full app sizes. Emotion runtime styles are carried in JavaScript.

## Explore → Traces

The benchmark follows [Billy's instructions](https://github.com/getsentry/sentry/pull/127144#issuecomment-6151608770). It replays the same 28 recorded API responses to both builds. The recording and login state remain in ignored local files.

The page benchmark was repeated after IntelliJ and other agent/build jobs were paused. The application code, benchmark code, dependencies, and API recording are unchanged. The component benchmark above was not rerun.

These are 40 fresh page runs: two batches of 10 runs per build, with reverse order in the second batch. The runner also alternates order within each batch. Each run warms the page, reloads, waits for the spans table, and performs six interactions. Every run passes the extracted-style check, has zero missing API responses, and completes all interactions without a timeout.

| Metric                      | Emotion ms | Yak ms | Yak change |      p | Batch A change | Batch B change |
| --------------------------- | ---------: | -----: | ---------: | -----: | -------------: | -------------: |
| App shell                   |        768 |    770 |      +0.4% |  0.925 |          +0.8% |          -0.1% |
| Spans table                 |       2405 |   2403 |      -0.1% |  0.465 |          -0.4% |          +0.1% |
| LCP                         |        782 |    784 |      +0.3% |  0.913 |          +1.0% |          -0.3% |
| Total Blocking Time         |       1658 |   1650 |      -0.5% |  0.223 |          -0.1% |          -1.0% |
| Long tasks total            |       2083 |   2081 |      -0.1% |  0.465 |          -0.1% |          -0.4% |
| Long animation frames total |       2234 |   2204 |      -1.4% |  0.871 |          -0.7% |          -1.0% |
| LoAF blocking               |       1670 |   1661 |      -0.5% |  0.204 |          -0.2% |          -1.0% |
| Worst LoAF                  |        938 |    941 |      +0.4% |  0.256 |          +1.0% |          +0.1% |
| tab: Trace Samples          |        576 |    576 |      +0.0% |  0.934 |          -0.7% |          +0.7% |
| tab: Aggregates             |        604 |    608 |      +0.7% |  0.488 |          +1.3% |          -0.7% |
| tab: Span Samples           |        672 |    664 |      -1.2% |  0.192 |          -1.8% |          +0.0% |
| open: project filter        |         64 |     64 |      +0.0% |  0.168 |          +0.0% |          +0.0% |
| open: date filter           |         40 |     40 |      +0.0% |  0.938 |          +0.0% |          +0.0% |
| open: Edit Table modal      |        304 |    292 |      -3.9% | <0.001 |          -3.9% |          -5.3% |
| Worst scripted interaction  |        672 |    664 |      -1.2% |  0.192 |          -1.8% |          +0.0% |

Positive changes mean longer durations. The p-values use the runner's two-sided Mann–Whitney U normal approximation with tie correction. They have no multiple-comparison correction. The worst scripted interaction is an INP-like diagnostic, not field INP.

The earlier 5.6% table-ready gap did not repeat. The new medians are 2,405 ms for Emotion and 2,403 ms for Yak (−0.1%, p = 0.465). TBT is 1,658 → 1,650 ms (−0.5%, p = 0.223). These results do not show a load-time penalty for Yak. They also do not establish a load-time improvement.

Edit Table is faster with Yak: 304 → 292 ms (−3.9%, p < 0.001). Both batches point in the same direction: −3.9% and −5.3%. None of the other measured page metrics has p < 0.05.

| Session                       | Emotion table-ready ms | Yak table-ready ms | Yak change |     p |
| ----------------------------- | ---------------------: | -----------------: | ---------: | ----: |
| Initial session               |                  2,607 |              2,753 |      +5.6% | 0.417 |
| Repeat with other jobs paused |                  2,405 |              2,403 |      −0.1% | 0.465 |

The first session did not establish that Yak was slower. The repeat is much closer and shows a small modal improvement. Cross-session changes cannot isolate the contribution of other jobs, so the comparisons within each session remain the main evidence.

The asset and geometry measurements below are from the initial session. Their source code is unchanged.

| Loaded page assets        |    Emotion |        Yak |
| ------------------------- | ---------: | ---------: |
| JavaScript decoded bytes  | 30,465,625 | 30,466,017 |
| CSS decoded bytes         |    105,023 |    285,930 |
| JavaScript transfer bytes |  6,741,804 |  6,749,156 |
| CSS transfer bytes        |     39,638 |     61,234 |
| Emotion rules (top level) |      1,060 |        425 |
| Static rules (top level)  |        683 |        733 |
| Elements                  |      4,794 |      4,794 |

Both builds load 114 JavaScript resources and one CSS resource. Total JS/CSS transfer grows by 28,948 bytes (+0.43%). Transfer bytes include HTTP overhead and differ from the component gzip table. Rule counts are top-level CSSOM entries; nested rules are not expanded.

The component test shows lower rendering cost, and the repeated page test shows a small improvement for Edit Table. A general page-load improvement is not established. The generated CSS size and migration adapters still need review before a rollout.

The [results file](yak-spike-results.json) contains the latest repeat in `page`, and the initial valid session in `page.previousRun`. It includes per-run samples and per-batch statistics. The two sessions are not pooled. API data and session cookies are excluded.

## Comparison with StyleX and Linaria

All three spikes move the same 16 components away from runtime style generation. Their API and build costs differ.

| Area                  | StyleX (#126763)                                                                          | Linaria (#127144)                                              | Yak (this spike)                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Style authoring       | Atomic styles from `stylex.create`                                                        | `css` tags produce class strings                               | `styled`, `css`, and `keyframes` extracted by SWC                                                             |
| Composition           | The spike passes classes; reliable property-level composition still needs an `xstyle` API | Keeps `className`; normal CSS cascade                          | Keeps `className`; normal CSS cascade                                                                         |
| Dynamic layout values | Inline CSS variables; common values use static classes                                    | Inline CSS variables and generated selectors                   | Inline CSS variables and generated selectors                                                                  |
| Theme handling        | Generated variables and a global dark class; nested overrides remain a reported gap       | Generated theme values; nested overrides remain a reported gap | Reads the current Emotion theme; nested colors are checked, but button dimensions and motion remain snapshots |
| Build integration     | Babel extraction plus a custom CSS collector                                              | WyW/static evaluation plus custom loaders and CSS collection   | Official SWC preloader plus a collector for the existing global stylesheet                                    |
| Published package     | CSS delivery is a reported gap                                                            | Exports `styles.css`; Node imports checked                     | Exports `styles.css`; packed Node imports and SSR checked                                                     |

Yak is closer to Linaria in public API and cascade behavior. It keeps more styled-component syntax and uses SWC extraction. Emotion object styles, shared dynamic helpers, DOM prop filtering, and `as` still require manual changes. Yak does not add StyleX's property-level conflict resolution.

### Published component results

The table below compares each spike with the Emotion baseline from its own study. Negative values mean shorter render times. StyleX and Linaria are from the [Linaria PR's 15-run component test](https://github.com/getsentry/sentry/pull/127144); Yak is from this report.

**These are historical results, not a controlled three-way comparison.** The published StyleX/Linaria test used older source revisions and a different dependency baseline. The shared fixture has the same row and element counts, but normalization against Emotion does not remove these differences.

| Workload | Operation     | StyleX vs its Emotion baseline | Linaria vs its Emotion baseline | Yak vs its Emotion baseline |
| -------- | ------------- | -----------------------------: | ------------------------------: | --------------------------: |
| Layout   | mount         |                         -45.2% |                          -43.1% |                      -22.4% |
| Layout   | update        |                         -58.9% |                          -56.3% |                      -30.4% |
| Layout   | Cached update |                         -57.3% |                          -54.5% |                      -23.3% |
| Mixed    | mount         |                         -25.8% |                          -41.0% |                      -12.2% |
| Mixed    | update        |                         -38.3% |                          -53.6% |                      -17.2% |
| Mixed    | Cached update |                         -26.4% |                          -47.0% |                      -12.5% |

The published StyleX/Linaria study shows larger component reductions than this Yak study. This does not establish how the three libraries rank on the current base.

### Published page results

The [later three-way page test](https://github.com/getsentry/sentry/pull/127144#issuecomment-6151607709) ran StyleX and Linaria on master `035fd0e68c0`, on an 8-core Linux machine. Both used the same recording within that study. Yak uses base `587e422c88aaf34ea81fb81ea2fec2662c3f5102`, a new recording, and the M3 Pro machine described above. Each study uses 20 runs per build at 1× CPU.

| Change against that study's Emotion baseline | StyleX, historical | Linaria, historical | Yak, latest repeat |
| -------------------------------------------- | -----------------: | ------------------: | -----------------: |
| Spans table ready                            |                −8% |                −11% |   −0.1%, p = 0.465 |
| Total Blocking Time                          |                −9% |                −12% |   −0.5%, p = 0.223 |
| Worst scripted interaction                   |               −11% |                −12% |   −1.2%, p = 0.192 |
| Edit Table                                   |               −13% |                −19% |   −3.9%, p < 0.001 |

StyleX and Linaria showed page-load improvements over Emotion in that earlier study. This Yak spike did not reproduce a general load-time gain; it showed an Edit Table improvement. The different bases, recordings, hardware, and sessions prevent a direct performance ranking. A controlled ranking still requires all three spikes on one base, one recording, and one machine.

The older component bundles added 55,274 gzip bytes for StyleX (+17.2%) and 45,472 for Linaria (+14.2%) against their 320,731-byte Emotion baseline. Yak adds 24,789 bytes (+6.1%) against its 404,605-byte baseline. The different baselines also prevent a direct total-size ranking. All three component tests counted zero runtime rule insertions for the migrated fixtures.

## Reproduce

Install the repository dependencies and Playwright Chromium. Use the Node version from the development environment.

```sh
BENCHMARK_RUNS=15 node scripts/runYakBenchmark.mjs
```

This writes the component samples and computed-style checks to ignored `.artifacts/yak-benchmark/results.json`. The runner extracts the base source from the local Git object database and builds it with the same installed dependencies.

For the page comparison, prepare an Emotion checkout at the base above with the repository dependencies. Serve that checkout and this working tree in separate terminals. Choose unused ports.

```sh
node scripts/exploreBenchmark.ts serve /path/to/emotion-base 7276
node scripts/exploreBenchmark.ts serve /path/to/yak-spike 7254
```

Set `BENCH_ORG` to an internal organization. Use a locally saved, approved Playwright login state only for recording. Keep the state and recording in ignored storage. The runner maps the hosted Sentry cookie domain to the local dev-ui domain.

```sh
BENCH_STATE=.artifacts/benchmark-state.json node scripts/exploreBenchmark.ts record 7276 .artifacts/explore-recording.json
node scripts/exploreBenchmark.ts run .artifacts/explore-recording.json .artifacts/explore-a 10 1 emotion:7276 yak:7254
node scripts/exploreBenchmark.ts run .artifacts/explore-recording.json .artifacts/explore-b 10 1 yak:7254 emotion:7276
node scripts/exploreBenchmark.ts compare emotion yak .artifacts/explore-a/results.json .artifacts/explore-b/results.json
node scripts/exploreBenchmark.ts bytes .artifacts/explore-recording.json emotion:7276 yak:7254
```

Wait for both app builds before measuring. Stop builds, tests, indexing, and other heavy work. Verify every replay has zero missing API requests, a populated table, and all six successful interactions. Compare each batch separately as well as the pooled samples.

## Compiler note

Emotion creates styled wrappers in dependency code. Sentry's SWC rule disables React Compiler for `node_modules`, so these generated wrappers can lack the compiler badge even when their parent is compiled. A parent can still cache child JSX and skip work below it. See React's [memoization explanation](https://react.dev/learn/react-compiler/introduction) and [compiler skip behavior](https://react.dev/learn/react-compiler/debugging). The compiler is disabled for both builds in these benchmarks.

## Validation and limits

All 584 Scraps tests pass (66 suites). The 52 app tests for menu, tag drawer, and LinkButton integration pass. Type checking, Scraps lint, changed root-file lint, package build with declarations, full app/worker builds, and explicit changed-file prek checks pass. The compiled package also passes a Chromium stylesheet smoke check. Actual package tarballs and compiled icon dependencies load all migrated exports in Node and server-render buttons with icons and links. The chart configuration also builds and loads in Node. Browser parity checks run against the real compiled styles; Jest removes CSS data imports and cannot validate CSS layout.

Button dimensions, radii, font weight, and motion values are copied from the current baseline. Color tokens are live, but arbitrary overrides of those numeric and motion theme values are not covered by this spike.

A full rollout still needs an agreed policy for the generated vocabulary and stylesheet size, a complete consumer audit for render-prop style forwarding and `as` wrappers, and coverage for styles outside these 16 components. The current implementation preserves the existing class cascade; class string order does not define property-level override order. Scalar render-prop values use inline styles, so they take priority over ordinary class rules.

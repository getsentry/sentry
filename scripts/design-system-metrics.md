# Design system metrics

Run `node scripts/collectDesignSystemMetrics.ts` from the repository root. It writes
`.artifacts/design-system-metrics.json` without sending data. `--output PATH` selects a
different artifact. `--publish` sends gauges to `DESIGN_SYSTEM_METRICS_DSN` and fails if
a batch cannot flush or its transport response does not acknowledge all metrics.
The daily/manual workflow always checks out the default branch
and keeps its snapshot for 90 days, including when publication fails. Configure the
repository secret before expecting dashboard data. Artifacts are not permanent storage.

The versioned snapshot retains commit, collection time, collector/policy/CODEOWNERS
hashes, per-file facts, lint findings, component catalog, repository totals and owner
breakdowns. Source roots include `static/app`, optional `static/gsApp` and
`static/gsAdmin`, and Scraps. Tests, stories, fixtures, declarations and generated files
are excluded. Core and Scraps implementations have a separate `design-system` scope;
use `application` for consumer adoption.

CODEOWNERS uses the last matching rule, including ownerless clearing. A file counts
once in `owner=all`, once for each of its owners, or in `owner=unowned`. Owner totals
overlap and must not be summed. The owner catalog contains owners of scanned source
files. Unsupported CODEOWNERS pattern syntax fails collection instead of guessing.

Scraps component counts measure opening/self-closing JSX using imported symbols.
Aliases, namespaces, compound components, shadowing and local re-exports are resolved
by TypeScript. Identity follows the implementation export. `source=scraps` means the
public `@sentry/scraps` API, `core` means a legacy `sentry/components/core` import,
and `internal` covers other imports of those implementations. Raw import specifiers
stay in per-file facts. Third-party re-exports use the local public module/export
identity. This is static JSX usage, not runtime renders; dynamic component selection,
`createElement`, and passing components as values are outside this measurement.

`design_system.scrapsFiles / design_system.jsxFiles` is public Scraps file reach.
It is not an overall percentage of UI migrated. Emotion usage overlaps Scraps usage.
`emotionFiles` counts actual Emotion import references or JSX `css` props; `styled`,
`css`, and `cssProps` count styled definitions, css helper expressions, and attributes.

`--report-scraps` in the lint wrapper reports all enabled custom Scraps rules with
`incubator`/`enforced` stages. It preserves rule options, per-file overrides and inline
disables while bypassing native debt budgets using the existing restoring transaction.
No suppression budgets change. Scan failures fail collection; only successful scans
emit zeros. Rule gauges use `scope=repository` and include all live findings,
including tests and stories.
The separate `ruleBuckets` retain all CODEOWNERS owners, even when their last violation
is fixed. Source-bucket rule counts remain available in the artifact.
Artifact `excludedFindings` counts findings outside the adoption source inventory;
these remain included in repository rule totals.

Gauges use `owner`, `scope`, `component`, `source`, `rule` and `stage` attributes.
No per-file attributes are sent. Component uses/files and rule violations/files share
the artifact's aggregates. Scraps component zeros are emitted for application owners
and the repository design-system total, using exported component candidates plus
observed JSX components.
Removing the last use still emits zero while its definition remains in the catalog;
deleting an owner or component definition removes that series. Outside-Scraps shared
components are ranked by consuming files in each artifact bucket, without a changing
top-N telemetry series or a rule that treats their use as a violation.

Every gauge includes `ci.commit` for the scanned checkout. GitHub Actions snapshots
also retain `run.url` and `run.attempt`, published as `ci.github_actions_run` and
`ci.github_run_attempt`. These are omitted unless all four GitHub run environment
variables are present. Republishing uses the snapshot's metadata, not the current run.

Use last/max/average values within daily time buckets; never sum daily snapshots.
`design_system.collected_at` records the latest successful publisher completion's
snapshot time. SDK gauges have ingestion timestamps, so batches span a short interval.
A publishing failure can leave a partial day's gauges; check collection freshness.
Rule/config/ownership changes can move counts without code migration. Compare artifact
hashes when interpreting a jump. Refactor-task creation is outside this collector.

Verify with `node --test scripts/collectDesignSystemMetrics.test.ts scripts/customOxlint.test.ts`.

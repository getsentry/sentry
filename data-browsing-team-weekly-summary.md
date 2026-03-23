# Data Browsing Tools Team - Weekly Activity Summary

**Period:** March 16 - 23, 2026

---

## Active Projects

| Project                                  | Status          | Lead            | Description                                                                               |
| ---------------------------------------- | --------------- | --------------- | ----------------------------------------------------------------------------------------- |
| **Insights --> Dashboards UI Migration** | In Progress     | George Gritsouk | Final GA/polish work to fully remove Insights and make them into Dashboards               |
| **Agentic Dashboards in Seer Explorer**  | In Progress     | James Keane     | Agentic workflow for AI-powered dashboard creation, editing, and conversational rendering |
| **Data Browsing Without Span Buffer**    | In Progress     | Matt Quinn      | Exploring alternatives to the operationally expensive Kafka span buffer                   |
| **Attributes! :)**                       | Requires Signal | -               | User-facing attribute exploration and management                                          |

---

## Completed Issues This Week (20 issues closed)

### Insights --> Dashboards UI Migration (12 completed)

| Issue                                                       | Assignee            | Summary                                                            |
| ----------------------------------------------------------- | ------------------- | ------------------------------------------------------------------ |
| [BROWSE-283](https://linear.app/getsentry/issue/BROWSE-283) | Dominik Buszowiecki | Add `legendType` configuration to widgets                          |
| [BROWSE-242](https://linear.app/getsentry/issue/BROWSE-242) | Dominik Buszowiecki | Fix: don't open explore compare view unnecessarily                 |
| [BROWSE-437](https://linear.app/getsentry/issue/BROWSE-437) | Dominik Buszowiecki | Reduce fractional digits for "number" data type to 4               |
| [BROWSE-248](https://linear.app/getsentry/issue/BROWSE-248) | Dominik Buszowiecki | Add starred transaction field to widget builder                    |
| [BROWSE-441](https://linear.app/getsentry/issue/BROWSE-441) | Dominik Buszowiecki | Internal release of linked dashboards                              |
| [BROWSE-443](https://linear.app/getsentry/issue/BROWSE-443) | Dominik Buszowiecki | Release linked dashboards to EA                                    |
| [BROWSE-448](https://linear.app/getsentry/issue/BROWSE-448) | Dominik Buszowiecki | Support linked dashboards in timeseries widgets                    |
| [BROWSE-450](https://linear.app/getsentry/issue/BROWSE-450) | Dominik Buszowiecki | Fix: linked dashboards modal not populating with pre-existing link |
| [BROWSE-451](https://linear.app/getsentry/issue/BROWSE-451) | Dominik Buszowiecki | Restrict insights + dashboards to EAP only                         |
| [BROWSE-452](https://linear.app/getsentry/issue/BROWSE-452) | Dominik Buszowiecki | Show hidden dashboards in linked dashboards list                   |
| [BROWSE-456](https://linear.app/getsentry/issue/BROWSE-456) | Dominik Buszowiecki | Add info tooltip explaining dashboard links                        |
| [BROWSE-458](https://linear.app/getsentry/issue/BROWSE-458) | Dominik Buszowiecki | Add all datasets to linked dashboards feature                      |
| [BROWSE-459](https://linear.app/getsentry/issue/BROWSE-459) | Dominik Buszowiecki | Fix duplicate table in full-screen mode with legend breakdown      |

### Agentic Dashboards in Seer Explorer (3 completed)

| Issue                                                       | Assignee   | Summary                                                        |
| ----------------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| [BROWSE-438](https://linear.app/getsentry/issue/BROWSE-438) | Edward Gou | Track metrics for dashboard generation validation success rate |
| [BROWSE-442](https://linear.app/getsentry/issue/BROWSE-442) | Edward Gou | Create dashboard dry run param                                 |
| [BROWSE-439](https://linear.app/getsentry/issue/BROWSE-439) | Edward Gou | Chat panel for generated dashboard refinement                  |

### Data Browsing Without Span Buffer (4 completed)

| Issue                                                       | Assignee   | Summary                                                       |
| ----------------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| [BROWSE-445](https://linear.app/getsentry/issue/BROWSE-445) | Matt Quinn | Test OpenTelemetry ingestion in s4s2's `skip-enrichment`      |
| [BROWSE-453](https://linear.app/getsentry/issue/BROWSE-453) | Matt Quinn | Add segment metadata to OTLP segment spans in Relay           |
| [BROWSE-455](https://linear.app/getsentry/issue/BROWSE-455) | Matt Quinn | Fix: `epm()` returns null for OTLP data that skips enrichment |

---

## In-Progress / Active Issues

| Issue                                                       | Assignee            | Status      | Summary                                                                  |
| ----------------------------------------------------------- | ------------------- | ----------- | ------------------------------------------------------------------------ |
| [BROWSE-464](https://linear.app/getsentry/issue/BROWSE-464) | Matt Quinn          | In Progress | Fix transaction filtering on transaction summary page (dataset mismatch) |
| [BROWSE-444](https://linear.app/getsentry/issue/BROWSE-444) | Matt Quinn          | In Progress | Document features that depend on the span buffer                         |
| [BROWSE-199](https://linear.app/getsentry/issue/BROWSE-199) | Dominik Buszowiecki | In Progress | New charts do not update URL with legend selection                       |
| [BROWSE-409](https://linear.app/getsentry/issue/BROWSE-409) | Nicholas Deschenes  | In Progress | Improve attribute sort behavior for better visibility                    |
| [BROWSE-454](https://linear.app/getsentry/issue/BROWSE-454) | Matt Quinn          | Waiting     | Minimize usage of `span.self_time` in prebuilt dashboards                |

### Newly Created Issues (backlog)

- [BROWSE-463](https://linear.app/getsentry/issue/BROWSE-463) - Fix filtering on transaction summary sample events tab
- [BROWSE-462](https://linear.app/getsentry/issue/BROWSE-462) - Design updates for agentic dashboards
- [BROWSE-461](https://linear.app/getsentry/issue/BROWSE-461) - Investigate rate limiting
- [BROWSE-460](https://linear.app/getsentry/issue/BROWSE-460) - Investigate tracking seer runs for cost usage

---

## GitHub PR Activity (March 16-23)

### Dominik Buszowiecki (DominikB2014) - 25 PRs

**Most active contributor.** Focused on linked dashboards, widget builder improvements, and Insights migration polish.

| #                                                          | Title                                                                       | State  |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- | ------ |
| [#111291](https://github.com/getsentry/sentry/pull/111291) | Set breakdown legend widget limit to 3 in prebuilt configs                  | Merged |
| [#111245](https://github.com/getsentry/sentry/pull/111245) | Extract breakdown table matching and support multi-groupBy                  | Open   |
| [#111237](https://github.com/getsentry/sentry/pull/111237) | Hide breakdown legend in full screen widget view                            | Merged |
| [#111232](https://github.com/getsentry/sentry/pull/111232) | Declare `http.response_status_code` as integer attribute                    | Merged |
| [#111200](https://github.com/getsentry/sentry/pull/111200) | Default to 10 dashboards when planDetails is null                           | Merged |
| [#111194](https://github.com/getsentry/sentry/pull/111194) | Pass widget and dashboardFilters to getFieldRenderer in all dataset configs | Merged |
| [#111139](https://github.com/getsentry/sentry/pull/111139) | Add tooltips explaining dashboard linking                                   | Merged |
| [#111131](https://github.com/getsentry/sentry/pull/111131) | Replace renderExtraActions function prop with component                     | Merged |
| [#111108](https://github.com/getsentry/sentry/pull/111108) | Show hidden dashboards in linked dashboards list                            | Merged |
| [#111094](https://github.com/getsentry/sentry/pull/111094) | Respect `usePlatformizedView=0` query param                                 | Merged |
| [#111085](https://github.com/getsentry/sentry/pull/111085) | Populate linked dashboard in widget builder edit modal                      | Merged |
| [#111078](https://github.com/getsentry/sentry/pull/111078) | Support linked dashboards in timeseries widgets                             | Merged |
| [#111016](https://github.com/getsentry/sentry/pull/111016) | Widget footer table errors on missing value                                 | Merged |
| [#110906](https://github.com/getsentry/sentry/pull/110906) | Add legendType configuration to widget builder                              | Merged |
| [#110887](https://github.com/getsentry/sentry/pull/110887) | Use PREBUILT_DASHBOARD_LABEL for owner tooltip                              | Merged |
| [#110884](https://github.com/getsentry/sentry/pull/110884) | Consolidate HTTP status code queries into single query                      | Merged |
| [#110880](https://github.com/getsentry/sentry/pull/110880) | Add banner to Mobile Overview linking to Mobile Vitals Dashboard            | Merged |
| [#110862](https://github.com/getsentry/sentry/pull/110862) | Fix trace preview not opening in fullscreen widget viewer                   | Open   |
| [#110859](https://github.com/getsentry/sentry/pull/110859) | Add auto height mode for full-width table widgets                           | Open   |
| [#110858](https://github.com/getsentry/sentry/pull/110858) | Reduce max fractional digits for number type to 4                           | Merged |
| [#110852](https://github.com/getsentry/sentry/pull/110852) | Clarify pre-built dashboard UI                                              | Merged |
| [#110765](https://github.com/getsentry/sentry/pull/110765) | Use VisualizationWidget in fullscreen widget viewer                         | Merged |
| [#110741](https://github.com/getsentry/sentry/pull/110741) | Add missing referrers to Referrer enum                                      | Merged |
| [#110739](https://github.com/getsentry/sentry/pull/110739) | Navigate to prebuilt dashboards from trace view and span summary            | Open   |

### George Gritsouk (gggritso) - 18 PRs

**Heavy focus on dashboard polish**, bug fixes, feature flag cleanup, and quality improvements.

| #                                                          | Title                                                                  | State  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- | ------ |
| [#111258](https://github.com/getsentry/sentry/pull/111258) | Fix performance score widget layout and sizing                         | Open   |
| [#111238](https://github.com/getsentry/sentry/pull/111238) | Cap global filter trigger width to prevent layout shifts               | Open   |
| [#111228](https://github.com/getsentry/sentry/pull/111228) | Show <0.0001 for very small numeric values instead of 0                | Open   |
| [#111222](https://github.com/getsentry/sentry/pull/111222) | Right-align perf score empty state in transactions table               | Merged |
| [#111140](https://github.com/getsentry/sentry/pull/111140) | Replace ugly red dashboard widget error states                         | Open   |
| [#111127](https://github.com/getsentry/sentry/pull/111127) | Remove chart-legend-component feature flag (backend)                   | Open   |
| [#111126](https://github.com/getsentry/sentry/pull/111126) | Remove chart-legend-component feature flag (frontend)                  | Open   |
| [#111029](https://github.com/getsentry/sentry/pull/111029) | Linkify replay.id and profile.id columns in table widgets              | Merged |
| [#111022](https://github.com/getsentry/sentry/pull/111022) | Prevent double HTML-escaping in chart tooltips                         | Merged |
| [#111017](https://github.com/getsentry/sentry/pull/111017) | Copy saved filters when duplicating prebuilt dashboards                | Merged |
| [#110920](https://github.com/getsentry/sentry/pull/110920) | Use normalizeUrl when navigating after pre-built dashboard duplication | Merged |
| [#110914](https://github.com/getsentry/sentry/pull/110914) | Remove hard-coded fieldMeta from prebuilt configs                      | Merged |
| [#110913](https://github.com/getsentry/sentry/pull/110913) | Use firstTransactionEvent for overview onboarding conditions           | Merged |
| [#110908](https://github.com/getsentry/sentry/pull/110908) | Disambiguate unaliased filters in widget legends                       | Merged |
| [#110891](https://github.com/getsentry/sentry/pull/110891) | Remove dashboards-prebuilt-controls feature flag (backend)             | Merged |
| [#110885](https://github.com/getsentry/sentry/pull/110885) | Remove dashboards-prebuilt-controls feature flag (frontend)            | Merged |
| [#110828](https://github.com/getsentry/sentry/pull/110828) | Prevent long dashboard names from overflowing in list view             | Merged |
| [#110802](https://github.com/getsentry/sentry/pull/110802) | Resolve prebuilt dashboard placeholder IDs before duplication          | Merged |

### Edward Gou (edwardgou-sentry) - 16 PRs

**Focused on agentic dashboard generation.** Built the chat panel, validation hooks, metrics tracking, and generation improvements.

| #                                                          | Title                                                                    | State  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ | ------ |
| [#111242](https://github.com/getsentry/sentry/pull/111242) | Move to dropdown                                                         | Merged |
| [#111199](https://github.com/getsentry/sentry/pull/111199) | Improvements to Dashboard generation tracking                            | Open   |
| [#111197](https://github.com/getsentry/sentry/pull/111197) | Fix double nested query param when creating dashboard                    | Merged |
| [#111196](https://github.com/getsentry/sentry/pull/111196) | Fix Create Dashboard with Seer button styling                            | Merged |
| [#111138](https://github.com/getsentry/sentry/pull/111138) | Move dashboard generation metric to after polling settled state          | Merged |
| [#111059](https://github.com/getsentry/sentry/pull/111059) | Add serializer check to dashboards generation on completion hook         | Merged |
| [#111027](https://github.com/getsentry/sentry/pull/111027) | Continue polling after completion on validation errors resuming seer run | Merged |
| [#110999](https://github.com/getsentry/sentry/pull/110999) | Add interval to dashboard artifact schema                                | Merged |
| [#110998](https://github.com/getsentry/sentry/pull/110998) | Fix empty interval in generated dashboards                               | Merged |
| [#110960](https://github.com/getsentry/sentry/pull/110960) | Dashboards generation chat panel improvements                            | Merged |
| [#110958](https://github.com/getsentry/sentry/pull/110958) | Track dashboard generation validation success and fail metrics           | Merged |
| [#110957](https://github.com/getsentry/sentry/pull/110957) | Update sendMessage to use fetchMutation                                  | Merged |
| [#110903](https://github.com/getsentry/sentry/pull/110903) | Add validation completion hook to generate dashboards endpoint           | Merged |
| [#110881](https://github.com/getsentry/sentry/pull/110881) | Tighten generated dashboard artifact model                               | Merged |
| [#110746](https://github.com/getsentry/sentry/pull/110746) | Add validateOnly param to dry run dashboard save                         | Merged |
| [#110725](https://github.com/getsentry/sentry/pull/110725) | Add chat panel to generate dashboards flow                               | Merged |

### Matt Quinn (mjq) - 7 PRs

**Focused on span buffer removal and EAP migration.** Replaced `span.self_time` with `span.duration`, fixed OTLP data issues.

| #                                                          | Title                                                       | State  |
| ---------------------------------------------------------- | ----------------------------------------------------------- | ------ |
| [#111176](https://github.com/getsentry/sentry/pull/111176) | Replace exclusive time as attribute for count functions     | Merged |
| [#111153](https://github.com/getsentry/sentry/pull/111153) | Use span.duration in HTTP and FE dashboards                 | Merged |
| [#111125](https://github.com/getsentry/sentry/pull/111125) | Use span.duration in Queries dashboards                     | Merged |
| [#110984](https://github.com/getsentry/sentry/pull/110984) | Remove `organizations:span-v2-otlp-processing` feature flag | Merged |
| [#110771](https://github.com/getsentry/sentry/pull/110771) | Rename HTTP method attribute for EAP txn summary profiles   | Merged |
| [#110767](https://github.com/getsentry/sentry/pull/110767) | Add `is_transaction` filter to FailureRateWidget queries    | Merged |
| [#110743](https://github.com/getsentry/sentry/pull/110743) | Add Apdex chart to EAP transaction summary sidebar          | Open   |

### Nikki Kapadia (nikkikapadia) - 5 PRs

**Text widgets and spans migration.** Added text widget support to dashboard builder and handled self-hosted migration flags.

| #                                                          | Title                                            | State  |
| ---------------------------------------------------------- | ------------------------------------------------ | ------ |
| [#111150](https://github.com/getsentry/sentry/pull/111150) | Add flag bypass for self-hosted spans migrations | Merged |
| [#111019](https://github.com/getsentry/sentry/pull/111019) | Text widget add to dashboard flow                | Merged |
| [#110980](https://github.com/getsentry/sentry/pull/110980) | Skip flakey widget builder test                  | Merged |
| [#110800](https://github.com/getsentry/sentry/pull/110800) | Text widget in widget builder + edit flows       | Merged |

### Shaun Kaasten (skaasten) - 3 PRs

**Performance instrumentation.** Added performance metrics for dashboard full-screen widget views.

| #                                                          | Title                                                  | State  |
| ---------------------------------------------------------- | ------------------------------------------------------ | ------ |
| [#111290](https://github.com/getsentry/sentry/pull/111290) | Measure re-render duration on full-screen widget view  | Open   |
| [#111089](https://github.com/getsentry/sentry/pull/111089) | Track window resize render duration via Sentry metrics | Merged |

---

## Key Themes & Highlights

### 1. Linked Dashboards Feature (Major Push)

The linked dashboards feature went through a full release cycle this week:

- **Internal release** → **EA release** within the week
- Support was extended to timeseries widgets, all datasets, and hidden dashboards
- Multiple UX polish items: tooltips, pre-existing link population, info tooltips
- Dominik Buszowiecki drove the majority of this effort

### 2. Agentic Dashboard Generation (Seer Integration)

Edward Gou shipped significant progress on AI-powered dashboard creation:

- Built a conversational chat panel for dashboard refinement
- Added validation hooks and dry-run capabilities
- Implemented metrics tracking for generation success rates
- Improved the artifact model and polling behavior for reliability

### 3. Span Buffer Removal (Data Browsing Without Span Buffer)

Matt Quinn led an investigation and migration effort to reduce reliance on the expensive Kafka span buffer:

- Tested OTLP ingestion in a buffer-less environment
- Added segment metadata to OTLP spans in Relay to enable Insights pages without the buffer
- Fixed `epm()` returning null for non-enriched OTLP data
- Replaced `span.self_time` with `span.duration` across multiple prebuilt dashboards

### 4. Dashboard Platform Polish & GA Readiness

George Gritsouk and others focused heavily on polish:

- Feature flag cleanup (`dashboards-prebuilt-controls`, `chart-legend-component`)
- Fixed HTML-escaping bugs, tooltip issues, overflow issues
- Improved prebuilt dashboard duplication, onboarding conditions
- Added replay.id and profile.id linkification in table widgets
- Performance score widget fixes and layout improvements

### 5. Text Widgets

Nikki Kapadia shipped the ability to add and edit text widgets in the dashboard builder, including the add-to-dashboard flow.

### 6. Performance Instrumentation

Shaun Kaasten added performance tracking for full-screen widget views and window resize render durations.

---

## By the Numbers

| Metric                  | Count |
| ----------------------- | ----- |
| Linear issues completed | 20    |
| Linear issues created   | ~10   |
| GitHub PRs opened       | ~74   |
| GitHub PRs merged       | ~55   |
| Active contributors     | 7     |

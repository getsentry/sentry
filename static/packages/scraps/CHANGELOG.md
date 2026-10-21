# Changelog

## 0.2.0

### New Features ✨

#### Aci

- Invalidate cache on post_update signal to prevent stale data by @RudraPatel2003 in [#128126](https://github.com/getsentry/sentry/pull/128126)
- Require 24 hours in OK state before metric monitor opens new issues by @RudraPatel2003 in [#127910](https://github.com/getsentry/sentry/pull/127910)
- Handle overlapping open periods in incident bridge in [#127897](https://github.com/getsentry/sentry/pull/127897)
- Add flag to allow us to disable alert rule UI redirects in [#127909](https://github.com/getsentry/sentry/pull/127909)
- Link the firing alert in Slack metric issue notifications by @sentry-junior in [#127307](https://github.com/getsentry/sentry/pull/127307)
- Add issue short id to open periods response by @RudraPatel2003 in [#127441](https://github.com/getsentry/sentry/pull/127441)
- Update backend to support fetching open periods across groups in [#126786](https://github.com/getsentry/sentry/pull/126786)

#### Ai

- Process LLM cache projects by @vgrozdanic in [#127026](https://github.com/getsentry/sentry/pull/127026)
- Resolve LLM cache candidates by @vgrozdanic in [#127025](https://github.com/getsentry/sentry/pull/127025)
- Build LLM cache shadow reports by @vgrozdanic in [#127024](https://github.com/getsentry/sentry/pull/127024)
- Estimate LLM cache savings by @vgrozdanic in [#127023](https://github.com/getsentry/sentry/pull/127023)
- Query LLM cache validation probes by @vgrozdanic in [#127022](https://github.com/getsentry/sentry/pull/127022)
- Query LLM cache call sites by @vgrozdanic in [#127021](https://github.com/getsentry/sentry/pull/127021)
- Parse LLM cache aggregates by @vgrozdanic in [#127018](https://github.com/getsentry/sentry/pull/127018)
- Validate LLM cache findings by @vgrozdanic in [#127017](https://github.com/getsentry/sentry/pull/127017)
- Classify LLM cache usage by @vgrozdanic in [#127015](https://github.com/getsentry/sentry/pull/127015)
- Add LLM cache call-site domain by @vgrozdanic in [#127014](https://github.com/getsentry/sentry/pull/127014)
- Add error stats to conversation details by @vgrozdanic in [#126706](https://github.com/getsentry/sentry/pull/126706)

#### Ai Monitoring

- Add conversation cost breakdowns in [#127360](https://github.com/getsentry/sentry/pull/127360)
- Add conversation token breakdowns by @vgrozdanic in [#127009](https://github.com/getsentry/sentry/pull/127009)
- Return gen_ai.memory.records from the conversation endpoint in [#126719](https://github.com/getsentry/sentry/pull/126719)
- Return gen_ai memory attributes from the conversation endpoint by @ArthurKnaus in [#126691](https://github.com/getsentry/sentry/pull/126691)

#### Api

- Let getsentry add API authentication classes by @scttcper in [#127086](https://github.com/getsentry/sentry/pull/127086)
- Rename events-dropped summary for Seer discovery by @manessaraj in [#127261](https://github.com/getsentry/sentry/pull/127261)

#### Artifact Bundles

- Tag the bundle upload metric with whether the bundle is new in [#126865](https://github.com/getsentry/sentry/pull/126865)
- Log placeholder-release decisions and truncated URL lookups by @mwarkentin in [#126714](https://github.com/getsentry/sentry/pull/126714)

#### Auth

- Identify Sentry OAuth applications by @evanpurkhiser in [#128370](https://github.com/getsentry/sentry/pull/128370)
- Add cached service account RPC for cells by @sentry-junior in [#128182](https://github.com/getsentry/sentry/pull/128182)
- Add ServiceAccount and ServiceAccountProject models by @sentry-junior in [#128049](https://github.com/getsentry/sentry/pull/128049)
- Gate OAuth React entry points behind an option by @evanpurkhiser in [#128288](https://github.com/getsentry/sentry/pull/128288)
- Render the OAuth device consent flow by @evanpurkhiser in [#128127](https://github.com/getsentry/sentry/pull/128127)
- Add typed OAuth queries and mutations by @evanpurkhiser in [#128117](https://github.com/getsentry/sentry/pull/128117)
- Add mocked service account APIs by @gricha in [#127588](https://github.com/getsentry/sentry/pull/127588)
- Replace branded artwork with animated illustrations by @evanpurkhiser in [#126709](https://github.com/getsentry/sentry/pull/126709)
- Enable React authentication by default by @evanpurkhiser in [#126486](https://github.com/getsentry/sentry/pull/126486)

#### Autofix

- Pass code change file URLs to the frontend in [#126766](https://github.com/getsentry/sentry/pull/126766)
- Send PR context tools option for PR iteration in [#126743](https://github.com/getsentry/sentry/pull/126743)
- Route PR iteration through the Seer feature by @NicoHinderling in [#126645](https://github.com/getsentry/sentry/pull/126645)

#### Crons

- Backfill check-in config snapshot references by @wedamija in [#126542](https://github.com/getsentry/sentry/pull/126542)
- Store check-in config snapshots by reference by @wedamija in [#126539](https://github.com/getsentry/sentry/pull/126539)
- Add table for deduplicated check-in config snapshots by @wedamija in [#126541](https://github.com/getsentry/sentry/pull/126541)
- Track usage of deprecated alertRule on Cron Monitor endpoints by @sentry-junior in [#126666](https://github.com/getsentry/sentry/pull/126666)

#### Digests

- Count digests served by each MigratingBackend side in [#128062](https://github.com/getsentry/sentry/pull/128062)
- Add MigratingBackend to move digests between clusters in [#127905](https://github.com/getsentry/sentry/pull/127905)
- Prefer workflow notification context in [#126677](https://github.com/getsentry/sentry/pull/126677)

#### Explore

- Apply per-axis timeseries transformations by @nsdeschenes in [#127804](https://github.com/getsentry/sentry/pull/127804)
- Classify configured dropped events as intentional in [#128138](https://github.com/getsentry/sentry/pull/128138)
- Tag dropped events as intentional vs unintentional by @manessaraj in [#127850](https://github.com/getsentry/sentry/pull/127850)
- Persist errorsOnly on conversations saved queries by @sentry-junior in [#127439](https://github.com/getsentry/sentry/pull/127439)
- Emit json expansion project option into relay config by @k-fish in [#126236](https://github.com/getsentry/sentry/pull/126236)
- Add filtering/searching to merged attributes endpoint in [#126507](https://github.com/getsentry/sentry/pull/126507)
- Add merged trace item attributes endpoint in [#126502](https://github.com/getsentry/sentry/pull/126502)
- Add interpolation and smoothing feature flag by @nsdeschenes in [#126721](https://github.com/getsentry/sentry/pull/126721)

#### Formulas

- Add description to formulas in [#128199](https://github.com/getsentry/sentry/pull/128199)
- Add user attrs in [#128108](https://github.com/getsentry/sentry/pull/128108)
- Add formulas to timeseries by @wmak in [#127810](https://github.com/getsentry/sentry/pull/127810)
- Add prebuilt to serializer by @wmak in [#127643](https://github.com/getsentry/sentry/pull/127643)
- Add prebuilts by @wmak in [#127560](https://github.com/getsentry/sentry/pull/127560)
- Add a delete column by @wmak in [#127558](https://github.com/getsentry/sentry/pull/127558)
- Add prebuilt column by @wmak in [#127411](https://github.com/getsentry/sentry/pull/127411)

#### Inbound Filters

- Don't allow changes on custom inbound filters without plan by @shellmayr in [#126860](https://github.com/getsentry/sentry/pull/126860)
- Register the inbound-filters-in-product-flows flag by @shellmayr in [#126851](https://github.com/getsentry/sentry/pull/126851)

#### Ingest

- Measure latency from save_event start in [#127896](https://github.com/getsentry/sentry/pull/127896)
- Measure Nodestore-to-post-process latency by @yuvmen in [#127431](https://github.com/getsentry/sentry/pull/127431)
- Enable zstd compression for error ingestion tasks by @sentry-junior in [#127202](https://github.com/getsentry/sentry/pull/127202)
- Inline event payloads through the processing pipeline by @jan-auer in [#126198](https://github.com/getsentry/sentry/pull/126198)

#### Investigations

- Let Seer Agent read and change investigations in [#128065](https://github.com/getsentry/sentry/pull/128065)
- Add comment counts endpoint by @wedamija in [#127340](https://github.com/getsentry/sentry/pull/127340)

#### Issues

- Validate derived features with failure containment by @shashjar in [#125253](https://github.com/getsentry/sentry/pull/125253)
- Show activity sources as stacked avatars in [#127715](https://github.com/getsentry/sentry/pull/127715)
- Add context to derived feature failures by @shashjar in [#125252](https://github.com/getsentry/sentry/pull/125252)

#### Lint

- Scope incubator suppressions to workspace projects in [#127579](https://github.com/getsentry/sentry/pull/127579)
- Enable typescript/no-generated-empty-object-type by @scttcper in [#127785](https://github.com/getsentry/sentry/pull/127785)
- Enable react/incompatible-library and react/void-use-memo by @scttcper in [#127775](https://github.com/getsentry/sentry/pull/127775)
- Enable react/todo by @scttcper in [#127771](https://github.com/getsentry/sentry/pull/127771)
- Require scoped fake timer cleanup by @natemoo-re in [#126956](https://github.com/getsentry/sentry/pull/126956)
- Prefer fake timers for explicit test waits by @natemoo-re in [#126957](https://github.com/getsentry/sentry/pull/126957)
- Enable prefer-primitives in the incubator by @natemoo-re in [#125873](https://github.com/getsentry/sentry/pull/125873)
- Run native lint ratcheting in prek and CI by @natemoo-re in [#125802](https://github.com/getsentry/sentry/pull/125802)

#### Logs

- Request timestamp_precise as int to avoid float precision loss by @manessaraj in [#126879](https://github.com/getsentry/sentry/pull/126879)
- Add the any function by @wmak in [#127413](https://github.com/getsentry/sentry/pull/127413)

#### Np

- Add middleware for notification platform link tracking in [#127698](https://github.com/getsentry/sentry/pull/127698)
- Track links in notifications rendered by custom renderers by @hobzcalvin in [#126922](https://github.com/getsentry/sentry/pull/126922)
- Track links in notifications rendered by default renderers by @hobzcalvin in [#126921](https://github.com/getsentry/sentry/pull/126921)
- Add notification link decoration and classification by @hobzcalvin in [#126920](https://github.com/getsentry/sentry/pull/126920)

#### Oauth

- Describe resource-specific consent access in [#128082](https://github.com/getsentry/sentry/pull/128082)
- Return structured consent permission groups in [#128068](https://github.com/getsentry/sentry/pull/128068)
- Add device consent decision API in [#127824](https://github.com/getsentry/sentry/pull/127824)
- Add authenticated device consent GET API in [#127822](https://github.com/getsentry/sentry/pull/127822)
- Add public device request context API in [#127821](https://github.com/getsentry/sentry/pull/127821)
- Add authorization consent decision API in [#127819](https://github.com/getsentry/sentry/pull/127819)
- Add authenticated authorization consent GET API in [#127818](https://github.com/getsentry/sentry/pull/127818)
- Add public authorization request context API in [#127817](https://github.com/getsentry/sentry/pull/127817)

#### Opsgenie

- Include feature flags in issue alert payload details in [#126698](https://github.com/getsentry/sentry/pull/126698)
- Link issue alerts only to workflows by @sentry-junior in [#126625](https://github.com/getsentry/sentry/pull/126625)

#### Preprod

- Align build details and comparison headers with the page frame by @Jesse-Box in [#127729](https://github.com/getsentry/sentry/pull/127729)
- Track accepted snapshot image outcomes by @jamieQ in [#124818](https://github.com/getsentry/sentry/pull/124818)

#### Releases

- Add new_release_id shadow column to grouprelease by @ldelvoye in [#127661](https://github.com/getsentry/sentry/pull/127661)
- Validate the foreign keys into sentry_release by @ldelvoye in [#127327](https://github.com/getsentry/sentry/pull/127327)

#### Router

- Enable React Router v8 in production by @nsdeschenes in [#128160](https://github.com/getsentry/sentry/pull/128160)
- Enable React Router v8 in preview deploys by @nsdeschenes in [#127745](https://github.com/getsentry/sentry/pull/127745)
- Enable React Router v8 in development by @nsdeschenes in [#127030](https://github.com/getsentry/sentry/pull/127030)

#### Scraps

- Add a lint rule flagging hand-rolled / manual tables by @JoshuaKGoldberg in [#127760](https://github.com/getsentry/sentry/pull/127760)
- Require-field-component lint rule by @TkDodo in [#127515](https://github.com/getsentry/sentry/pull/127515)
- Add magma sequential color scales in [#126947](https://github.com/getsentry/sentry/pull/126947)
- Sync ANSI colors with Figma in [#126948](https://github.com/getsentry/sentry/pull/126948)

#### Seer

- Grant seer:write to Seer agent tokens by default by @sebastianv1 in [#127503](https://github.com/getsentry/sentry/pull/127503)
- Let seer:write run Autofix analysis steps by @sebastianv1 in [#127502](https://github.com/getsentry/sentry/pull/127502)
- Expose configurable workflows through the API by @trevor-e in [#128140](https://github.com/getsentry/sentry/pull/128140)
- Export automation configs in organization relocation by @trevor-e in [#127893](https://github.com/getsentry/sentry/pull/127893)
- Add SeerWorkflow for default seeding and project scope by @trevor-e in [#127892](https://github.com/getsentry/sentry/pull/127892)
- Add automation config scope fields and legacy-only uniqueness by @trevor-e in [#127891](https://github.com/getsentry/sentry/pull/127891)
- Send investigation updates to entrypoints by @alexsohn1126 in [#127263](https://github.com/getsentry/sentry/pull/127263)
- Add seer:read and seer:write scopes by @sebastianv1 in [#127501](https://github.com/getsentry/sentry/pull/127501)
- Gate Autofix code mode by organization by @NicoHinderling in [#127655](https://github.com/getsentry/sentry/pull/127655)
- Register automations feature flag by @trevor-e in [#127437](https://github.com/getsentry/sentry/pull/127437)
- Let Ask Seer open PRs with ask-seer-create-pr by @joseph-sentry in [#126872](https://github.com/getsentry/sentry/pull/126872)
- Add investigation entrypoint and operator scaffolding by @alexsohn1126 in [#126900](https://github.com/getsentry/sentry/pull/126900)
- Add ask-seer-create-pr flag to turn off chat coding by @joseph-sentry in [#126870](https://github.com/getsentry/sentry/pull/126870)
- React to PR review summaries during PR iteration by @joseph-sentry in [#126760](https://github.com/getsentry/sentry/pull/126760)
- Log first-assignment summary dispatch decisions by @cvxluo in [#127066](https://github.com/getsentry/sentry/pull/127066)
- Accept an allowlisted referrer on search-agent/start by @sentry-junior in [#126849](https://github.com/getsentry/sentry/pull/126849)

#### Slack

- Post the investigation conclusion in the alert thread in [#127617](https://github.com/getsentry/sentry/pull/127617)
- Add the investigation conclusion notification template in [#127774](https://github.com/getsentry/sentry/pull/127774)
- Add a progress task card to the investigation status in [#127403](https://github.com/getsentry/sentry/pull/127403)
- Post live investigation status in the alert thread in [#127280](https://github.com/getsentry/sentry/pull/127280)
- Build the investigation status from the run projection by @alexsohn1126 in [#127641](https://github.com/getsentry/sentry/pull/127641)
- Add the investigation status notification template by @alexsohn1126 in [#127640](https://github.com/getsentry/sentry/pull/127640)
- Start Seer investigations from metric alert button by @alexsohn1126 in [#126751](https://github.com/getsentry/sentry/pull/126751)
- Add Investigate with Seer button to metric alerts by @alexsohn1126 in [#126723](https://github.com/getsentry/sentry/pull/126723)

#### Smoothing

- Add automatic ASAP window selection by @nsdeschenes in [#127533](https://github.com/getsentry/sentry/pull/127533)
- Add exponential moving average support by @nsdeschenes in [#127278](https://github.com/getsentry/sentry/pull/127278)
- Add simple moving average smoothing by @nsdeschenes in [#126913](https://github.com/getsentry/sentry/pull/126913)

#### Spans

- Migrate saved queries with \_if combinators by @wmak in [#120696](https://github.com/getsentry/sentry/pull/120696)
- Read attributes in enrichment using deprecation-aware accessor by @mjq in [#126638](https://github.com/getsentry/sentry/pull/126638)

#### Timeseries

- Parse transformation functions and modes by @nsdeschenes in [#127531](https://github.com/getsentry/sentry/pull/127531)
- Decode indexed transformations query parameters by @nsdeschenes in [#127057](https://github.com/getsentry/sentry/pull/127057)

#### Other

- (✂️) Enable knip cycle detection in CI by @TkDodo in [#127728](https://github.com/getsentry/sentry/pull/127728)
- (action-log) Log FIRST_SEEN action when a group is created by @sentry-junior in [#126942](https://github.com/getsentry/sentry/pull/126942)
- (agents) Add cached Code Mode explanation endpoint in [#128019](https://github.com/getsentry/sentry/pull/128019)
- (alerts) Add crons-disable-alert-rule feature to disable deprecated fields in [#126756](https://github.com/getsentry/sentry/pull/126756)
- (attachments) Option to set desired chunk size for TUS uploads by @tobias-wilfert in [#127217](https://github.com/getsentry/sentry/pull/127217)
- (bootstrap) Include the original error in preload request results by @billyvg in [#126745](https://github.com/getsentry/sentry/pull/126745)
- (ci) Add sherif to validate dependencies in [#126892](https://github.com/getsentry/sentry/pull/126892)
- (code-mappings) Add directory prefix ranking helper in [#126209](https://github.com/getsentry/sentry/pull/126209)
- (combinators) Add deprecation flag by @wmak in [#127273](https://github.com/getsentry/sentry/pull/127273)
- (dashboards) Migrate saved span widgets to filter-first \_if syntax by @wmak in [#127068](https://github.com/getsentry/sentry/pull/127068)
- (eap) Gate occurrences dataset access behind test-occurrences-dataset flag by @manessaraj in [#128269](https://github.com/getsentry/sentry/pull/128269)
- (filters) Add geo_country_code condition to custom inbound filters by @shellmayr in [#126683](https://github.com/getsentry/sentry/pull/126683)
- (forms) Add checkbox group fields in [#127989](https://github.com/getsentry/sentry/pull/127989)
- (inbox) Add desktop app logos to the handoff menu by @cvxluo in [#127337](https://github.com/getsentry/sentry/pull/127337)
- (insights) Publish starred service spans endpoints in [#126775](https://github.com/getsentry/sentry/pull/126775)
- (integrations) Resolve issue actions from workflows in [#126617](https://github.com/getsentry/sentry/pull/126617)
- (interpolation) Add timeseries filling helpers in [#126912](https://github.com/getsentry/sentry/pull/126912)
- (locks) Use RedisClusterLockBackend for default locks by @strongs in [#128089](https://github.com/getsentry/sentry/pull/128089)
- (mcp) Add flag for Seer translation in search_events by @sentry-junior in [#127059](https://github.com/getsentry/sentry/pull/127059)
- (notifications) Log every shadow comparison and widen the variant key in [#126737](https://github.com/getsentry/sentry/pull/126737)
- (onboarding) Allow the Pi Durable project platform by @cleptric in [#128015](https://github.com/getsentry/sentry/pull/128015)
- (ourlogs) Add if combinators to ourlogs by @wmak in [#126633](https://github.com/getsentry/sentry/pull/126633)
- (pr-iter) Cap total PR iterations per run at 25 in [#126605](https://github.com/getsentry/sentry/pull/126605)
- (scm) Pass GitLab repository paths to scm-platform by @vaind in [#128198](https://github.com/getsentry/sentry/pull/128198)
- (sdk) Use `data_collection` instead of `send_default_pii` by @sentrivana in [#127229](https://github.com/getsentry/sentry/pull/127229)
- (search) Add private elapsed aggregate formula by @vgrozdanic in [#126456](https://github.com/getsentry/sentry/pull/126456)
- (seer-chat-suggestions) Add endpoint for Seer chat empty state suggestions by @srest2021 in [#126739](https://github.com/getsentry/sentry/pull/126739)
- (sentry-apps) Return installation UUID with org components by @sentry-junior in [#127591](https://github.com/getsentry/sentry/pull/127591)
- (settings) Register settings v3 feature flag by @priscilawebdev in [#127183](https://github.com/getsentry/sentry/pull/127183)
- (sourcemaps) Log the placeholder release name on artifact bundle assembly by @mwarkentin in [#127101](https://github.com/getsentry/sentry/pull/127101)
- (tags) Add flag for selecting tag values by count before the limit by @roggenkemper in [#126747](https://github.com/getsentry/sentry/pull/126747)
- (taskworker) Propagate system viewer context from scheduler by @sehr-m in [#126890](https://github.com/getsentry/sentry/pull/126890)
- (tracemetrics) Add allow_list to sentry sdk metrics backend by @k-fish in [#127851](https://github.com/getsentry/sentry/pull/127851)
- (TUS) Add feature for enabling resumable uploads by @tobias-wilfert in [#127352](https://github.com/getsentry/sentry/pull/127352)
- (ui) Replace popper with floating-ui by @scttcper in [#127137](https://github.com/getsentry/sentry/pull/127137)
- (vercel) Rate limit extra API authentication per org by @scttcper in [#127459](https://github.com/getsentry/sentry/pull/127459)
- (workflow_engine) Store all evaluations in EAP by @saponifi3d in [#125683](https://github.com/getsentry/sentry/pull/125683)
- Send group status updates to snuba when archiving/unarchiving issues by @RudraPatel2003 in [#127454](https://github.com/getsentry/sentry/pull/127454)

### Bug Fixes 🐛

#### Agents

- Add elapsed conversation time span in [#126188](https://github.com/getsentry/sentry/pull/126188)
- Use tracing illustration in empty states in [#126823](https://github.com/getsentry/sentry/pull/126823)

#### Ai

- Improve LLM cache detector confidence by @vgrozdanic in [#127380](https://github.com/getsentry/sentry/pull/127380)
- Avoid direct hits for negated conversation ID searches by @obostjancic in [#127169](https://github.com/getsentry/sentry/pull/127169)

#### Ai Monitoring

- Keep LLM cache sample calls out of log scrubbing by @ArthurKnaus in [#128338](https://github.com/getsentry/sentry/pull/128338)
- Detect cache reuse by conversation by @vgrozdanic in [#127555](https://github.com/getsentry/sentry/pull/127555)

#### Alerts

- Scope firing history to accessible projects in [#128069](https://github.com/getsentry/sentry/pull/128069)
- Keep action IDs server-generated in [#128059](https://github.com/getsentry/sentry/pull/128059)
- Exclude deprecated alert rule params from Monitor API docs in [#126738](https://github.com/getsentry/sentry/pull/126738)
- Clean up unused workflow_engine migration code by @kcons in [#126628](https://github.com/getsentry/sentry/pull/126628)
- Generate modern monitor UI links in broken monitors notifications by @kcons in [#126095](https://github.com/getsentry/sentry/pull/126095)

#### Api

- Return installing org from org index for integration tokens by @sentry-junior in [#127981](https://github.com/getsentry/sentry/pull/127981)
- Validate integer path ids in convert_args by @sentry-junior in [#128227](https://github.com/getsentry/sentry/pull/128227)
- Return no content for empty bulk issue updates in [#128109](https://github.com/getsentry/sentry/pull/128109)
- Verify offset paginator cursor value and offsets by @kcons in [#127885](https://github.com/getsentry/sentry/pull/127885)

#### Auth

- Carry approved superuser access in ViewerContext by @gricha in [#126126](https://github.com/getsentry/sentry/pull/126126)
- Encode channel login redirect destinations in [#126862](https://github.com/getsentry/sentry/pull/126862)
- Correct platform stacking in branded artwork by @evanpurkhiser in [#126732](https://github.com/getsentry/sentry/pull/126732)

#### Bitbucket Server

- Match source URLs by host and path, not raw prefix by @vaind in [#128173](https://github.com/getsentry/sentry/pull/128173)
- Create repository webhooks with a secret by @giovanni-guidini in [#127267](https://github.com/getsentry/sentry/pull/127267)
- Verify webhook signatures against repo secret by @giovanni-guidini in [#127266](https://github.com/getsentry/sentry/pull/127266)

#### Ci

- Give each per-worker Snuba its own Redis DB by @sentry-junior in [#128256](https://github.com/getsentry/sentry/pull/128256)
- Tag final pytest-sentry attempts and stop re-sending earlier ones by @sentry-junior in [#128233](https://github.com/getsentry/sentry/pull/128233)
- Keep event-file readers out of parallel and background steps by @billyvg in [#127616](https://github.com/getsentry/sentry/pull/127616)
- Cache node_modules of all packages by @TkDodo in [#127219](https://github.com/getsentry/sentry/pull/127219)
- Fall back when getsentry dispatch inputs are too large in [#126906](https://github.com/getsentry/sentry/pull/126906)
- Avoid E2BIG in impacted-files oxlint step in [#126758](https://github.com/getsentry/sentry/pull/126758)

#### Crons

- Backfill detector enabled from monitor status in [#127129](https://github.com/getsentry/sentry/pull/127129)
- Keep detector enabled in sync with monitor status in [#127128](https://github.com/getsentry/sentry/pull/127128)

#### Dashboards

- Get last position was only getting favourites by @wmak in [#127559](https://github.com/getsentry/sentry/pull/127559)
- Wait for dashboard widget deletion to save by @scttcper in [#126679](https://github.com/getsentry/sentry/pull/126679)

#### Digests

- Standardize notification records on workflow IDs by @kcons in [#127499](https://github.com/getsentry/sentry/pull/127499)
- Make it impossible to create a Rule-based Record by @kcons in [#127310](https://github.com/getsentry/sentry/pull/127310)

#### Events

- Remove unneccesary key change by @wmak in [#127783](https://github.com/getsentry/sentry/pull/127783)
- Handle 408s from snuba by @wmak in [#127547](https://github.com/getsentry/sentry/pull/127547)

#### Formulas

- Handle casing by @wmak in [#127767](https://github.com/getsentry/sentry/pull/127767)
- Permissions were wrong so you had to be admin by @wmak in [#127660](https://github.com/getsentry/sentry/pull/127660)
- Prevent empty references by @wmak in [#127254](https://github.com/getsentry/sentry/pull/127254)
- Prevent calculations on columns by @wmak in [#127091](https://github.com/getsentry/sentry/pull/127091)

#### Github

- Stop one org's integration from claiming another org's links by @vaind in [#128171](https://github.com/getsentry/sentry/pull/128171)
- Align webhook secret check with GHE by @giovanni-guidini in [#127191](https://github.com/getsentry/sentry/pull/127191)

#### Gitlab

- Match source URLs against the instance's base URL in [#128168](https://github.com/getsentry/sentry/pull/128168)
- Reject reinstalls during pending deletion in [#127544](https://github.com/getsentry/sentry/pull/127544)
- Preserve full release commit messages by @giovanni-guidini in [#127520](https://github.com/getsentry/sentry/pull/127520)

#### Hybridcloud

- Make backfill watermark test independent of model order by @gricha in [#127827](https://github.com/getsentry/sentry/pull/127827)
- Retry PROVISION_ORGANIZATION drain after DB disconnect by @JoshuaMoelans in [#127251](https://github.com/getsentry/sentry/pull/127251)

#### Integrations

- Use standard form layout for custom integration credentials by @sentry-junior in [#127983](https://github.com/getsentry/sentry/pull/127983)
- Use workflow URL exclusively in ticket descriptions by @sentry-junior in [#127718](https://github.com/getsentry/sentry/pull/127718)
- Run on_create_repository when reactivating repos by @giovanni-guidini in [#127268](https://github.com/getsentry/sentry/pull/127268)
- Use workflow IDs for issue alert links by @kcons in [#127343](https://github.com/getsentry/sentry/pull/127343)

#### Issues

- Rename claude-desktop MCP client family to claude by @sentry-junior in [#127717](https://github.com/getsentry/sentry/pull/127717)
- Build activity feeds from live comments and non-comment GALEs in [#127677](https://github.com/getsentry/sentry/pull/127677)
- Read comment lists directly from `Activity` in [#125947](https://github.com/getsentry/sentry/pull/125947)
- Validate update bodies before reading discard by @yuvmen in [#127342](https://github.com/getsentry/sentry/pull/127342)

#### Lint

- Pass file lists to lint scripts as separate arguments by @JoshuaKGoldberg in [#128363](https://github.com/getsentry/sentry/pull/128363)
- Handle file URLs in oxlint diagnostics in [#126827](https://github.com/getsentry/sentry/pull/126827)
- Don't fail CI on stale suppression budgets inherited from master in [#126882](https://github.com/getsentry/sentry/pull/126882)
- Make ratchet failures actionable in [#126784](https://github.com/getsentry/sentry/pull/126784)

#### Notifications

- Recheck the group after the shadow platform render by @sentry-junior in [#128096](https://github.com/getsentry/sentry/pull/128096)
- Mask relative first-seen times in shadow compares by @sentry-junior in [#128095](https://github.com/getsentry/sentry/pull/128095)
- Ignore dropped count stats at a group's first event in [#128093](https://github.com/getsentry/sentry/pull/128093)
- Report shadow group stats drift as group_changed in [#128088](https://github.com/getsentry/sentry/pull/128088)
- Add issue title to subject by @leeandher in [#127318](https://github.com/getsentry/sentry/pull/127318)
- Remove Rule support in URL generation by @kcons in [#127127](https://github.com/getsentry/sentry/pull/127127)
- Don't set rule or workflow ids on action data by @kcons in [#127087](https://github.com/getsentry/sentry/pull/127087)
- Don't add Rule-only notifications to the digest by @kcons in [#127120](https://github.com/getsentry/sentry/pull/127120)

#### Np

- Match the Slack issue alert nudge and plan warning on the platform by @hobzcalvin in [#126673](https://github.com/getsentry/sentry/pull/126673)
- Fix platform issue renderers and skip stale shadow comparisons by @hobzcalvin in [#126662](https://github.com/getsentry/sentry/pull/126662)
- Output match diff to make failed shadow in unittests more helpful by @hobzcalvin in [#126657](https://github.com/getsentry/sentry/pull/126657)

#### O11y

- Use streamed spans by @sentrivana in [#127995](https://github.com/getsentry/sentry/pull/127995)
- Use `new_scope` instead of deprecated `push_scope` by @sentrivana in [#127994](https://github.com/getsentry/sentry/pull/127994)

#### Perforce

- Avoid gateway retries during setup in [#128167](https://github.com/getsentry/sentry/pull/128167)
- Limit connection timeout to 20 seconds by @vgrozdanic in [#128022](https://github.com/getsentry/sentry/pull/128022)

#### Preprod

- Report triggered size rules as action required in [#127347](https://github.com/getsentry/sentry/pull/127347)
- Report unapproved snapshot changes as action_required by @mtopo27 in [#127345](https://github.com/getsentry/sentry/pull/127345)

#### Releases

- Default deploy dateFinished to now when null by @sentry-junior in [#127563](https://github.com/getsentry/sentry/pull/127563)
- Lock the swap tables in the order app statements take them by @ldelvoye in [#127292](https://github.com/getsentry/sentry/pull/127292)
- Lock child tables before sentry_release in the id swap by @ldelvoye in [#127000](https://github.com/getsentry/sentry/pull/127000)

#### Replays

- Retry GCS 502s on replay recording uploads by @sentry-junior in [#127377](https://github.com/getsentry/sentry/pull/127377)
- Build AI summary log rows from partial event data in [#125881](https://github.com/getsentry/sentry/pull/125881)
- Use `handle_query_errors` across replay endpoints by @sentry-junior in [#125992](https://github.com/getsentry/sentry/pull/125992)

#### Sdk Crash

- Ignore Flutter drawFrame and attachToBuildOwner wrappers by @sentry-junior in [#127197](https://github.com/getsentry/sentry/pull/127197)
- Match React Native Supabase captures by path, not module by @antonis in [#125855](https://github.com/getsentry/sentry/pull/125855)

#### Search

- Prevent hitting protobufs max recursion in [#128180](https://github.com/getsentry/sentry/pull/128180)
- Handle leftover expressions in [#128037](https://github.com/getsentry/sentry/pull/128037)
- Don't allow wildcards at the end of search terms in [#128026](https://github.com/getsentry/sentry/pull/128026)

#### Seer

- Don't auto-assign from resolution-triggered smart assignment runs by @sentry-junior in [#128134](https://github.com/getsentry/sentry/pull/128134)
- Attribute remaining grouping cleanup paths by @sehr-m in [#128247](https://github.com/getsentry/sentry/pull/128247)
- Set viewer context for grouping cleanup in [#128057](https://github.com/getsentry/sentry/pull/128057)
- Set viewer context for missing issue-assignment paths by @sehr-m in [#127873](https://github.com/getsentry/sentry/pull/127873)
- Honor approved superuser access in agent tokens by @gricha in [#126377](https://github.com/getsentry/sentry/pull/126377)
- Restrict org rpc methods by caller by @geoffg-sentry in [#126722](https://github.com/getsentry/sentry/pull/126722)
- Check the caller on search agent state by @geoffg-sentry in [#126710](https://github.com/getsentry/sentry/pull/126710)
- Ensure explorer-chat membership gating by @geoffg-sentry in [#126642](https://github.com/getsentry/sentry/pull/126642)
- Scope autofix runs by user by @geoffg-sentry in [#126634](https://github.com/getsentry/sentry/pull/126634)
- Skip Autofix PR webhook for runs without a group by @joseph-sentry in [#126867](https://github.com/getsentry/sentry/pull/126867)
- Skip PR ready-for-review updates in Slack autofix threads in [#126863](https://github.com/getsentry/sentry/pull/126863)
- Serialize first-assignment summary source by @cvxluo in [#126734](https://github.com/getsentry/sentry/pull/126734)
- React with 🎉 on review comments instead of resolving threads by @joseph-sentry in [#125629](https://github.com/getsentry/sentry/pull/125629)
- Gate autofix by seer org access by @geoffg-sentry in [#126624](https://github.com/getsentry/sentry/pull/126624)

#### Sentry Apps

- Track client-secret JWT jti per app instead of per installation by @michelletran-sentry in [#128063](https://github.com/getsentry/sentry/pull/128063)
- Reject invalid status filters by @cvxluo in [#128252](https://github.com/getsentry/sentry/pull/128252)

#### Snuba

- Raise RPC 400s with the Snuba message by @wmak in [#128345](https://github.com/getsentry/sentry/pull/128345)
- Don't determine relocation based on AlertRule by @kcons in [#127712](https://github.com/getsentry/sentry/pull/127712)
- Preserve metadata for empty top-event series in [#126842](https://github.com/getsentry/sentry/pull/126842)

#### Tests

- Fix flakes from cross-worker FLUSHALL and recycled project IDs by @sentry-junior in [#128317](https://github.com/getsentry/sentry/pull/128317)
- Fix outstanding flaky tests by @sentry-junior in [#128264](https://github.com/getsentry/sentry/pull/128264)
- Address review feedback on test infra changes by @sentry-junior in [#127948](https://github.com/getsentry/sentry/pull/127948)
- Keep EAPClient default window clear of Snuba tier 8 after midnight by @wedamija in [#127333](https://github.com/getsentry/sentry/pull/127333)
- Fix two midnight UTC flakes by @wedamija in [#127341](https://github.com/getsentry/sentry/pull/127341)
- Stop applying override_options as a class decorator by @hobzcalvin in [#126960](https://github.com/getsentry/sentry/pull/126960)
- Wait for SCM authorization to be enabled in [#126964](https://github.com/getsentry/sentry/pull/126964)
- Set the workflow environment in the shadow variant matrix in [#126925](https://github.com/getsentry/sentry/pull/126925)
- Wait for auth fields to become interactable in [#126795](https://github.com/getsentry/sentry/pull/126795)
- Initialize acceptance cookies on robots.txt by @scttcper in [#126678](https://github.com/getsentry/sentry/pull/126678)

#### Other

- (aci) Remove Rule/AlertRule support from Project.transfer_to by @kcons in [#127460](https://github.com/getsentry/sentry/pull/127460)
- (action-log) Attribute Cursor Origin webhook actions by @cvxluo in [#127288](https://github.com/getsentry/sentry/pull/127288)
- (admin) Restore page titles and breadcrumb trails in [#126821](https://github.com/getsentry/sentry/pull/126821)
- (annotations) Handle invalid params by @wmak in [#127546](https://github.com/getsentry/sentry/pull/127546)
- (arithmetic) Improve arithmetic allowlists by @wmak in [#126742](https://github.com/getsentry/sentry/pull/126742)
- (assemble) Validate dist before setting assemble status by @mwarkentin in [#127096](https://github.com/getsentry/sentry/pull/127096)
- (assisted-query) Treat empty list as all accessible projects for issues RPCs in [#126806](https://github.com/getsentry/sentry/pull/126806)
- (auto_source_code_config) Handle missing project gracefully in process_event in [#127696](https://github.com/getsentry/sentry/pull/127696)
- (autofix) Report stackless PR iteration errors as exceptions by @joseph-sentry in [#125514](https://github.com/getsentry/sentry/pull/125514)
- (beacon) Snapshot modules during package version discovery by @aminvakil in [#124713](https://github.com/getsentry/sentry/pull/124713)
- (bitbucket) Match source URLs on the bitbucket.org host exactly by @vaind in [#128174](https://github.com/getsentry/sentry/pull/128174)
- (bootstrap) Report preload request failures as real errors and metrics by @billyvg in [#126592](https://github.com/getsentry/sentry/pull/126592)
- (codeowners) Return 404 for non-integer codeowners_id by @sentry-junior in [#128226](https://github.com/getsentry/sentry/pull/128226)
- (combinators) Handle equations in migration in [#126768](https://github.com/getsentry/sentry/pull/126768)
- (conversation) Update if syntax by @wmak in [#127676](https://github.com/getsentry/sentry/pull/127676)
- (db) Treat invalid numeric ids as non-matching in id_or_slug by @kcons in [#125615](https://github.com/getsentry/sentry/pull/125615)
- (derived data) Filter out very recently backfilled actions in consistency check by @kcons in [#127402](https://github.com/getsentry/sentry/pull/127402)
- (detectors) Handle seats when bulk toggling cron and uptime detectors in [#127291](https://github.com/getsentry/sentry/pull/127291)
- (difs) Increase DIF assembly deadline to 5 minutes in [#128153](https://github.com/getsentry/sentry/pull/128153)
- (dynamic-sampling) Count SnQL Snuba errors in the per-org task status in [#126830](https://github.com/getsentry/sentry/pull/126830)
- (eap) Cap query end at now for ranges that end in the future by @JoshuaKGoldberg in [#127275](https://github.com/getsentry/sentry/pull/127275)
- (equations) Handle equations without functions by @wmak in [#127766](https://github.com/getsentry/sentry/pull/127766)
- (event formatter) Stop exposing the legacy alert rule ID on metric issues by @sentry-junior in [#128293](https://github.com/getsentry/sentry/pull/128293)
- (eventstore) Handle empty groups in event pagination by @yuvmen in [#127662](https://github.com/getsentry/sentry/pull/127662)
- (explore) Show LLM calls without captured messages by @obostjancic in [#127223](https://github.com/getsentry/sentry/pull/127223)
- (github-enterprise) Stop one org's integration from claiming another org's links by @vaind in [#128172](https://github.com/getsentry/sentry/pull/128172)
- (inbound-filters) Let custom filter reads through without the plan feature by @shellmayr in [#126875](https://github.com/getsentry/sentry/pull/126875)
- (ingest) Handle invalid bundle_id in artifact bundle file details by @sentry in [#127235](https://github.com/getsentry/sentry/pull/127235)
- (insights) Register Agents tool usage and MCP onboarding referrers by @obostjancic in [#126692](https://github.com/getsentry/sentry/pull/126692)
- (issue detection) Handle double-bracketed values in URLs by @lobsterkatie in [#127094](https://github.com/getsentry/sentry/pull/127094)
- (java) Stop deobfuscating quoted values that are not classes. by @ranmori in [#127244](https://github.com/getsentry/sentry/pull/127244)
- (locking) Prefix lock release errors with an error code by @ldelvoye in [#127334](https://github.com/getsentry/sentry/pull/127334)
- (migrations) Drop pending deletions before the drift comparison by @sentry-junior in [#127468](https://github.com/getsentry/sentry/pull/127468)
- (msteams) Use the triggering event for the issue alert description in [#126963](https://github.com/getsentry/sentry/pull/126963)
- (notification) Don't catch exceptions just to report them and re-raise them in [#126958](https://github.com/getsentry/sentry/pull/126958)
- (oauth) Shorten the invalid device code message in [#128114](https://github.com/getsentry/sentry/pull/128114)
- (opsgenie) Default alert priority to P3 when unset by @sentry in [#126833](https://github.com/getsentry/sentry/pull/126833)
- (organizations) Strip customer domain paths for slugs starting with new by @sentry-junior in [#128274](https://github.com/getsentry/sentry/pull/128274)
- (ourlogs) Bound regex filter compilation at parse time by @JoshuaKGoldberg in [#128032](https://github.com/getsentry/sentry/pull/128032)
- (profiling) Fix function regression detection by @mjq in [#126614](https://github.com/getsentry/sentry/pull/126614)
- (refactor-tasks) Skip node_modules and suppression summaries in oxlint runner by @sentry-junior in [#127747](https://github.com/getsentry/sentry/pull/127747)
- (release-health) Skip deleted projects in release adoption by @sentry-junior in [#127573](https://github.com/getsentry/sentry/pull/127573)
- (scim) Make privilege sync independent of task ordering by @oioki in [#127177](https://github.com/getsentry/sentry/pull/127177)
- (scm) Set web_base_url for GitLab repositories by @vaind in [#128164](https://github.com/getsentry/sentry/pull/128164)
- (scraps) Remove process env checks from theme by @sentry-junior in [#127595](https://github.com/getsentry/sentry/pull/127595)
- (security) Scope key transaction team lookup to the organization by @markatsentry in [#126066](https://github.com/getsentry/sentry/pull/126066)
- (statistical_detectors) Un-stick broken `RegressionGroup`s by @mjq in [#127385](https://github.com/getsentry/sentry/pull/127385)
- (tags) Select frequent tag values before the query limit behind a flag by @roggenkemper in [#126749](https://github.com/getsentry/sentry/pull/126749)
- (teapot) Parse specific entries from the Teapot raw response by @mujacica in [#127041](https://github.com/getsentry/sentry/pull/127041)
- (trace-items) Show backfilled replacement attributes in item details by @sentry-junior in [#127257](https://github.com/getsentry/sentry/pull/127257)
- (tracemetrics) Actually sample metrics tagged with client_sample_rate by @k-fish in [#128356](https://github.com/getsentry/sentry/pull/128356)
- (ui) Contain loading indicator animation overflow by @jamieQ in [#127791](https://github.com/getsentry/sentry/pull/127791)
- (validate) Handle missing projects by @wmak in [#127260](https://github.com/getsentry/sentry/pull/127260)
- (webhooks) Stop using Rule in get_triggering_rule_name by @kcons in [#127308](https://github.com/getsentry/sentry/pull/127308)
- (workflows) Scope workflow runs by membership by @geoffg-sentry in [#126753](https://github.com/getsentry/sentry/pull/126753)
- Reduce cellsiloclient's connect timeout by @elramen in [#128276](https://github.com/getsentry/sentry/pull/128276)
- Group quote errors better by @wmak in [#127256](https://github.com/getsentry/sentry/pull/127256)
- Remove non-existent `get_iterations()` import in [#126927](https://github.com/getsentry/sentry/pull/126927)

### Documentation 📚

#### Api

- Document data export details endpoint by @DominikB2014 in [#128030](https://github.com/getsentry/sentry/pull/128030)
- Document project performance general settings endpoint by @DominikB2014 in [#127398](https://github.com/getsentry/sentry/pull/127398)
- Document saved query visit and key transaction endpoints by @DominikB2014 in [#126755](https://github.com/getsentry/sentry/pull/126755)
- Document trace item validate, ranked, and trace logs endpoints by @DominikB2014 in [#126626](https://github.com/getsentry/sentry/pull/126626)
- Update AI conversation message example by @obostjancic in [#126695](https://github.com/getsentry/sentry/pull/126695)
- Document trace item attribute and metric context endpoints by @DominikB2014 in [#126620](https://github.com/getsentry/sentry/pull/126620)

#### Issues

- Document issue metrics and timeseries endpoints by @DominikB2014 in [#128031](https://github.com/getsentry/sentry/pull/128031)
- Document durability requirements for GroupAction payloads by @sentry-junior in [#127622](https://github.com/getsentry/sentry/pull/127622)

#### Other

- (agents) Move frontend tooling details out of root AGENTS.md by @scttcper in [#127826](https://github.com/getsentry/sentry/pull/127826)
- (backend) Refresh backend agent and subsystem docs against code by @sentry-junior in [#127884](https://github.com/getsentry/sentry/pull/127884)
- (explore) Show ingestion delay metadata in timeseries example by @edwardgou-sentry in [#126713](https://github.com/getsentry/sentry/pull/126713)
- (flags) Make /flags/logs endpoint public by @cmanallen in [#126855](https://github.com/getsentry/sentry/pull/126855)
- (forms) Validate conditional fields where rendered in [#126832](https://github.com/getsentry/sentry/pull/126832)
- (investigations) Document private frontend APIs in [#127917](https://github.com/getsentry/sentry/pull/127917)
- (replays) Document replay events meta, details, and viewed-by in [#128033](https://github.com/getsentry/sentry/pull/128033)
- (skills) Cover link decoration in the notification platform skill by @alexsohn1126 in [#127615](https://github.com/getsentry/sentry/pull/127615)

### Internal Changes 🔧

#### ✂️

- Check Scraps and icons workspaces in [#127008](https://github.com/getsentry/sentry/pull/127008)
- Update knip by @TkDodo in [#126688](https://github.com/getsentry/sentry/pull/126688)

#### Acceptance

- Cut each worker's first-test warmup by @sentry-junior in [#128321](https://github.com/getsentry/sentry/pull/128321)
- Start devservices and per-worker Snuba bootstrap early by @sentry-junior in [#128313](https://github.com/getsentry/sentry/pull/128313)

#### Aci

- Drop the retired `IncidentProject` table in [#127667](https://github.com/getsentry/sentry/pull/127667)
- Drop retired `RuleSnooze` table in [#127606](https://github.com/getsentry/sentry/pull/127606)
- Retire `IncidentProject` without dropping its table in [#127666](https://github.com/getsentry/sentry/pull/127666)
- Retire `RuleSnooze` model in [#127605](https://github.com/getsentry/sentry/pull/127605)
- Remove IssueAlertMigrator in [#127890](https://github.com/getsentry/sentry/pull/127890)
- Remove `IncidentProject` incident FK constraint in [#127665](https://github.com/getsentry/sentry/pull/127665)
- Remove `RuleSnooze` foreign key constraints in [#127602](https://github.com/getsentry/sentry/pull/127602)
- Stop writing incident project joins in [#127664](https://github.com/getsentry/sentry/pull/127664)
- Remove unused `RuleSnooze` option registration by @shashjar in [#127612](https://github.com/getsentry/sentry/pull/127612)
- Remove unused `RuleSnooze` analytics events by @shashjar in [#127610](https://github.com/getsentry/sentry/pull/127610)
- Remove obsolete incident lookups and cache by @shashjar in [#127663](https://github.com/getsentry/sentry/pull/127663)
- Remove obsolete `RuleSnooze` consumers by @shashjar in [#127598](https://github.com/getsentry/sentry/pull/127598)
- Delete clear_expired_rulesnoozes task in [#126820](https://github.com/getsentry/sentry/pull/126820)

#### Ai

- Register backend conversation transcript flag by @obostjancic in [#128324](https://github.com/getsentry/sentry/pull/128324)
- Use indexed conversation ID lookups by @vgrozdanic in [#127514](https://github.com/getsentry/sentry/pull/127514)

#### Ai Monitoring

- Run LLM cache detection once a day by @sentry-junior in [#128343](https://github.com/getsentry/sentry/pull/128343)
- Simplify model metadata merge by @vgrozdanic in [#127357](https://github.com/getsentry/sentry/pull/127357)
- Reduce conversation detail queries by @vgrozdanic in [#127029](https://github.com/getsentry/sentry/pull/127029)

#### Alerts

- Drop the retired `RuleActivity` table in [#127607](https://github.com/getsentry/sentry/pull/127607)
- Delete IssueAlertExamples in [#128072](https://github.com/getsentry/sentry/pull/128072)
- Move `RuleActivity` to pending deletion in [#127603](https://github.com/getsentry/sentry/pull/127603)
- Remove `RuleActivity` foreign-key constraint by @shashjar in [#127599](https://github.com/getsentry/sentry/pull/127599)
- Remove remaining `RuleActivity` consumers by @shashjar in [#127597](https://github.com/getsentry/sentry/pull/127597)
- Remove dead code, move test-only code by @kcons in [#126816](https://github.com/getsentry/sentry/pull/126816)
- Remove some Rule use by @kcons in [#126998](https://github.com/getsentry/sentry/pull/126998)
- Don't use Rule in RuleBase in [#126981](https://github.com/getsentry/sentry/pull/126981)

#### Api

- Document release setup completion by @cmanallen in [#128218](https://github.com/getsentry/sentry/pull/128218)
- Share the passthrough content negotiation by @vaind in [#128094](https://github.com/getsentry/sentry/pull/128094)
- Document stacktrace link by @cmanallen in [#128216](https://github.com/getsentry/sentry/pull/128216)
- Expose attribute context in endpoint by @lzhao-sentry in [#127372](https://github.com/getsentry/sentry/pull/127372)
- Load the device model tables on first use in [#126453](https://github.com/getsentry/sentry/pull/126453)
- Remove api-client-kind-check flag registration in [#126859](https://github.com/getsentry/sentry/pull/126859)
- Remove api-client-kind-check flag checks in [#126847](https://github.com/getsentry/sentry/pull/126847)
- Drop \_test suffix from client_kind attribution attributes in [#126840](https://github.com/getsentry/sentry/pull/126840)
- Delete unused spans/fields and spans-samples endpoints by @DominikB2014 in [#126716](https://github.com/getsentry/sentry/pull/126716)

#### Artifact Bundles

- Optionally start debug-ID lookups from the debug ID's rows in [#126885](https://github.com/getsentry/sentry/pull/126885)
- Optionally keep date_added only on the bundle row in [#126776](https://github.com/getsentry/sentry/pull/126776)
- Stop counting every bundle in a release per lookup by @mwarkentin in [#126315](https://github.com/getsentry/sentry/pull/126315)
- Bound the URL lookup by an index row budget by @mwarkentin in [#126317](https://github.com/getsentry/sentry/pull/126317)
- Optionally skip indexing files named after their debug ID by @mwarkentin in [#126316](https://github.com/getsentry/sentry/pull/126316)

#### Attachments

- Update comment & remove metric in [#126838](https://github.com/getsentry/sentry/pull/126838)
- More tags for group update metric in [#126705](https://github.com/getsentry/sentry/pull/126705)
- Instrument EventAttachment update by @jjbayer in [#126682](https://github.com/getsentry/sentry/pull/126682)

#### Auth

- Drop legacy scopes bitfield columns by @sentry-junior in [#127761](https://github.com/getsentry/sentry/pull/127761)
- Move legacy scopes bitfield columns to pending deletion by @sentry-junior in [#127386](https://github.com/getsentry/sentry/pull/127386)
- Remove unused partner login banner by @evanpurkhiser in [#127653](https://github.com/getsentry/sentry/pull/127653)
- Remove unused megaphone template by @evanpurkhiser in [#127650](https://github.com/getsentry/sentry/pull/127650)
- Remove legacy HTML login banner rendering by @evanpurkhiser in [#127548](https://github.com/getsentry/sentry/pull/127548)
- Apply consistent email matching in user service and SSO verification by @markatsentry in [#127401](https://github.com/getsentry/sentry/pull/127401)
- Stop falling back to scopes bitfield in get_scopes by @sentry-junior in [#127282](https://github.com/getsentry/sentry/pull/127282)
- Remove legacy login, registration, and MFA handlers by @evanpurkhiser in [#126712](https://github.com/getsentry/sentry/pull/126712)
- Remove unused Django sudo page in [#126886](https://github.com/getsentry/sentry/pull/126886)
- Remove legacy password strength bootstrap in [#126761](https://github.com/getsentry/sentry/pull/126761)
- Remove legacy login column and join-tab styles by @evanpurkhiser in [#126757](https://github.com/getsentry/sentry/pull/126757)
- Remove Auth V2 rollout feature registration by @evanpurkhiser in [#125113](https://github.com/getsentry/sentry/pull/125113)
- Remove React authentication option registration by @evanpurkhiser in [#126632](https://github.com/getsentry/sentry/pull/126632)
- Cover stale pending invitation sessions by @evanpurkhiser in [#126496](https://github.com/getsentry/sentry/pull/126496)
- Always enable React authentication by @evanpurkhiser in [#126222](https://github.com/getsentry/sentry/pull/126222)

#### Autofix

- Remove now dead PR iteration step and legacy autofix code by @rbro112 in [#128308](https://github.com/getsentry/sentry/pull/128308)
- Remove autofix code-changes flag and code now that code-changes-in-seer is GA by @rbro112 in [#127801](https://github.com/getsentry/sentry/pull/127801)
- Move endpoint PR iteration handling into pr_iteration by @joseph-sentry in [#125497](https://github.com/getsentry/sentry/pull/125497)
- Move PR iteration helpers out of autofix_agent in [#125496](https://github.com/getsentry/sentry/pull/125496)
- Inline PR iteration step args construction by @NicoHinderling in [#126740](https://github.com/getsentry/sentry/pull/126740)
- Move PR iteration completion handling into pr_iteration by @joseph-sentry in [#125495](https://github.com/getsentry/sentry/pull/125495)

#### Backend

- Start devservices and per-worker Snuba bootstrap early by @sentry-junior in [#127397](https://github.com/getsentry/sentry/pull/127397)
- Only run migration tests on PRs that touch migrations in [#126951](https://github.com/getsentry/sentry/pull/126951)

#### Ci

- Collect only each shard's files on full backend runs by @sentry-junior in [#127943](https://github.com/getsentry/sentry/pull/127943)
- Bump action-migrations to v1.4.0 by @wedamija in [#127723](https://github.com/getsentry/sentry/pull/127723)
- Split selective test shards by file by @sentry-junior in [#127569](https://github.com/getsentry/sentry/pull/127569)
- Derive cache paths from pnpm workspaces by @TkDodo in [#127228](https://github.com/getsentry/sentry/pull/127228)
- Fetch jest shard dependencies in parallel by @scttcper in [#126667](https://github.com/getsentry/sentry/pull/126667)
- Run acceptance setup-sentry in the background by @scttcper in [#126664](https://github.com/getsentry/sentry/pull/126664)

#### Codeowners

- Use combined @getsentry/replay team by @sentry-junior in [#128294](https://github.com/getsentry/sentry/pull/128294)
- Move agent monitoring ownership to agent-tracing by @sentry-junior in [#127984](https://github.com/getsentry/sentry/pull/127984)
- Co-own oxlint.config.ts instead of oxlint-suppressions.json by @sentry-junior in [#127758](https://github.com/getsentry/sentry/pull/127758)

#### Combinators

- Add more data to log by @wmak in [#127383](https://github.com/getsentry/sentry/pull/127383)
- Log deprecated function use by @wmak in [#127048](https://github.com/getsentry/sentry/pull/127048)

#### Crons

- Rate limit the check-in list per minute by @wedamija in [#127708](https://github.com/getsentry/sentry/pull/127708)
- Stop caching check-ins by guid by @wedamija in [#127706](https://github.com/getsentry/sentry/pull/127706)
- Stop resetting is_upserting on check-ins without config by @wedamija in [#127683](https://github.com/getsentry/sentry/pull/127683)
- Drop the check-in monitor_id column by @wedamija in [#127648](https://github.com/getsentry/sentry/pull/127648)
- Remove monitor from the check-in model by @wedamija in [#127646](https://github.com/getsentry/sentry/pull/127646)
- Stop using monitor_id on check-ins by @wedamija in [#127644](https://github.com/getsentry/sentry/pull/127644)
- Filter check-in list and stats by monitor environment ids by @wedamija in [#127609](https://github.com/getsentry/sentry/pull/127609)
- Drop the check-in project_id column by @wedamija in [#127409](https://github.com/getsentry/sentry/pull/127409)
- Remove project_id from the check-in model by @wedamija in [#127408](https://github.com/getsentry/sentry/pull/127408)
- Stop writing project_id on check-ins by @wedamija in [#127407](https://github.com/getsentry/sentry/pull/127407)
- Drop unused api_latest check-in index by @wedamija in [#126543](https://github.com/getsentry/sentry/pull/126543)
- Reuse loaded monitor objects during check-in processing by @wedamija in [#126536](https://github.com/getsentry/sentry/pull/126536)
- Skip monitor saves for unchanged upsert configs by @wedamija in [#126534](https://github.com/getsentry/sentry/pull/126534)
- Insert new check-ins without a second lookup by @wedamija in [#126533](https://github.com/getsentry/sentry/pull/126533)
- Check monitor muted state only on environment create by @wedamija in [#126531](https://github.com/getsentry/sentry/pull/126531)

#### Db

- Drop unused Group.logger indexes by @sentry-junior in [#128334](https://github.com/getsentry/sentry/pull/128334)
- Remove unused PickledObjectField by @oioki in [#128322](https://github.com/getsentry/sentry/pull/128322)
- Drop unused Group.times_seen index in [#128165](https://github.com/getsentry/sentry/pull/128165)
- Drop unused Group.level index in [#128156](https://github.com/getsentry/sentry/pull/128156)

#### Deps

- Bump certifi to 2026.10.19 by @sentry-junior in [#128273](https://github.com/getsentry/sentry/pull/128273)
- Bump type-fest from 5.8.0 to 5.10.0 by @dependabot in [#127902](https://github.com/getsentry/sentry/pull/127902)
- Bump uv to 0.13.4 by @sentry-junior in [#128348](https://github.com/getsentry/sentry/pull/128348)
- Bump pytest-xdist to 3.8.0, drop pytest-workaround-12888 by @sentry-junior in [#127938](https://github.com/getsentry/sentry/pull/127938)
- Bump platformicons to 9.10.0 by @sentry-junior in [#127849](https://github.com/getsentry/sentry/pull/127849)
- Bump the sentry-dependencies group with 4 updates by @dependabot in [#127681](https://github.com/getsentry/sentry/pull/127681)
- Bump ts-checker-rspack-plugin from 1.6.2 to 1.7.1 by @dependabot in [#127690](https://github.com/getsentry/sentry/pull/127690)
- Bump platformicons to 9.9.0 by @sentry-junior in [#127654](https://github.com/getsentry/sentry/pull/127654)
- Update pnpm minimumReleaseAge exclusions by @ryan953 in [#127620](https://github.com/getsentry/sentry/pull/127620)
- Bump devservices to 1.5.4 by @sentry-junior in [#127440](https://github.com/getsentry/sentry/pull/127440)
- Bump Sentry JavaScript SDK to 11.6.0 by @sentry-junior in [#127004](https://github.com/getsentry/sentry/pull/127004)
- Bump @sentry/conventions to 0.27.0 by @sentry-junior in [#127180](https://github.com/getsentry/sentry/pull/127180)
- Update nuqs to 2.10.2 by @nsdeschenes in [#127078](https://github.com/getsentry/sentry/pull/127078)
- Bump @types/node to 26.6.4 by @billyvg in [#127058](https://github.com/getsentry/sentry/pull/127058)
- Bump py relay by @k-fish in [#126525](https://github.com/getsentry/sentry/pull/126525)
- Upgrade pnpm to 12.10.1 by @evanpurkhiser in [#126731](https://github.com/getsentry/sentry/pull/126731)
- Bump solid-js and shell-quote for Dependabot alerts by @oioki in [#126686](https://github.com/getsentry/sentry/pull/126686)
- Bump @sentry/conventions to 0.26.0 by @sentry-junior in [#126555](https://github.com/getsentry/sentry/pull/126555)
- Bump @sentry/webpack-plugin to 5.4.1 by @sentry-junior in [#126583](https://github.com/getsentry/sentry/pull/126583)

#### Explore

- Address review on classify_drop by @manessaraj in [#128205](https://github.com/getsentry/sentry/pull/128205)
- Remove org-level relay json expansion flag by @k-fish in [#127567](https://github.com/getsentry/sentry/pull/127567)
- Break data browsing dependency cycles by @TkDodo in [#127245](https://github.com/getsentry/sentry/pull/127245)
- Remove dropped-data annotations from timeseries endpoint by @manessaraj in [#127258](https://github.com/getsentry/sentry/pull/127258)
- Remove explore-conditional-aggregates flag registration by @wmak in [#126941](https://github.com/getsentry/sentry/pull/126941)
- Move the Explore Traces table onto SimpleTable in [#126801](https://github.com/getsentry/sentry/pull/126801)
- Stop computing byte sizes for dropped-data annotations by @manessaraj in [#126728](https://github.com/getsentry/sentry/pull/126728)
- Remove unused explore starred order endpoint by @lzhao-sentry in [#126644](https://github.com/getsentry/sentry/pull/126644)
- Drop includeMeasuredIngestionDelayMetadata param by @edwardgou-sentry in [#126630](https://github.com/getsentry/sentry/pull/126630)

#### Features

- Remove leftover spot check flag comment by @edwardgou-sentry in [#128024](https://github.com/getsentry/sentry/pull/128024)
- Remove dashboards-widgets-events-timeseries-spot-check flag by @edwardgou-sentry in [#126881](https://github.com/getsentry/sentry/pull/126881)

#### Flags

- Remove `organizations:objectstore-debugfiles-direct-read` gates in [#127959](https://github.com/getsentry/sentry/pull/127959)
- Remove organizations:sentry-apps-claude-routine-webhooks in [#127860](https://github.com/getsentry/sentry/pull/127860)
- Unregister organizations:issue-stream-recommended-sort by @cursor in [#127210](https://github.com/getsentry/sentry/pull/127210)
- Remove `organizations:tracemetrics-multi-metric-selection-in-dashboards` registration in [#126414](https://github.com/getsentry/sentry/pull/126414)

#### Frontend

- Run Figma Code Connect on demand by @natemoo-re in [#127121](https://github.com/getsentry/sentry/pull/127121)
- Resolve app imports through workspace dependencies by @TkDodo in [#127031](https://github.com/getsentry/sentry/pull/127031)
- Declare app workspace dependencies by @TkDodo in [#126848](https://github.com/getsentry/sentry/pull/126848)
- Migrate remaining component layouts to container queries in [#126687](https://github.com/getsentry/sentry/pull/126687)
- Isolate workspace typechecks and tests in [#126841](https://github.com/getsentry/sentry/pull/126841)

#### Gal

- Test for GroupAction subclasses that don't follow standards by @kcons in [#127697](https://github.com/getsentry/sentry/pull/127697)
- Remove top-level model import in publish module by @kcons in [#127707](https://github.com/getsentry/sentry/pull/127707)
- Rename 'base' module to 'request' by @kcons in [#127710](https://github.com/getsentry/sentry/pull/127710)

#### Icons

- Move parenthesis icon into icons package in [#127006](https://github.com/getsentry/sentry/pull/127006)
- Extract self-contained icons package in [#126843](https://github.com/getsentry/sentry/pull/126843)

#### Ingest

- Reference shared filter conditions from project config by @vjeranc in [#127379](https://github.com/getsentry/sentry/pull/127379)
- Add shared filter definitions to global config by @vjeranc in [#127378](https://github.com/getsentry/sentry/pull/127378)

#### Integrations

- Mock Slack, Discord, Jira, and Sentry App calls in tests by @sentry-junior in [#127946](https://github.com/getsentry/sentry/pull/127946)
- Remove unused Azure DevOps setup template by @evanpurkhiser in [#127634](https://github.com/getsentry/sentry/pull/127634)
- Publish the integration validation endpoints by @leeandher in [#126389](https://github.com/getsentry/sentry/pull/126389)
- Stop sending legacy rule ids in Slack and Teams action payloads by @sentry-junior in [#127418](https://github.com/getsentry/sentry/pull/127418)
- Default max_retries to zero by @cmanallen in [#127255](https://github.com/getsentry/sentry/pull/127255)
- Extract shared repo field update into a helper by @giovanni-guidini in [#127227](https://github.com/getsentry/sentry/pull/127227)
- Look up linked groups without loading every install by @vaind in [#126011](https://github.com/getsentry/sentry/pull/126011)

#### Issues

- Reuse the group when fetching escalation forecasts by @scttcper in [#127719](https://github.com/getsentry/sentry/pull/127719)
- Look up previous group history per status by @scttcper in [#127496](https://github.com/getsentry/sentry/pull/127496)
- Batch unhandled flag cache writes in group serializer by @scttcper in [#127504](https://github.com/getsentry/sentry/pull/127504)
- Filter group events by group id instead of short id by @scttcper in [#127425](https://github.com/getsentry/sentry/pull/127425)
- Reuse event project when saving issue occurrences by @scttcper in [#127494](https://github.com/getsentry/sentry/pull/127494)
- Move feed/stream tables onto SimpleTable by @JoshuaKGoldberg in [#126794](https://github.com/getsentry/sentry/pull/126794)
- Wait for performance issue page to finish loading by @scttcper in [#127410](https://github.com/getsentry/sentry/pull/127410)
- Skip user report update when the event has none by @scttcper in [#127329](https://github.com/getsentry/sentry/pull/127329)
- Wait for bookmark update before checking the API by @scttcper in [#127394](https://github.com/getsentry/sentry/pull/127394)
- Check sourcemap flag before looking up the org owner by @scttcper in [#127330](https://github.com/getsentry/sentry/pull/127330)
- Replay derived features from action history in [#126621](https://github.com/getsentry/sentry/pull/126621)
- Wait for issue counts instead of toast dismissal in [#126793](https://github.com/getsentry/sentry/pull/126793)
- Batch seen-by and participant user lookups by @scttcper in [#126651](https://github.com/getsentry/sentry/pull/126651)

#### Java

- Don't rely on Symbolicator for in_app by @loewenheim in [#127773](https://github.com/getsentry/sentry/pull/127773)
- Remove proguard signature deobfuscation by @loewenheim in [#127742](https://github.com/getsentry/sentry/pull/127742)

#### Jest

- Run setup-node-pnpm before the parallel setup group in [#128035](https://github.com/getsentry/sentry/pull/128035)
- Share React across automatic mock registries in [#126567](https://github.com/getsentry/sentry/pull/126567)
- Drop span attributes workaround, bump @sentry/jest-environment to 8.1.0 in [#126648](https://github.com/getsentry/sentry/pull/126648)
- Cache moduleNameMapper lookups and skip owner stacks in CI by @billyvg in [#126649](https://github.com/getsentry/sentry/pull/126649)

#### Lint

- Isolate package lint tasks by @TkDodo in [#127203](https://github.com/getsentry/sentry/pull/127203)
- Make require-field-component more strict in [#127992](https://github.com/getsentry/sentry/pull/127992)
- Enforce Jest hook ordering by @natemoo-re in [#127098](https://github.com/getsentry/sentry/pull/127098)
- Open cleanup PRs when master suppression budgets are stale by @natemoo-re in [#126895](https://github.com/getsentry/sentry/pull/126895)
- Prune suppression budgets in pre-commit CI in [#126905](https://github.com/getsentry/sentry/pull/126905)
- Replace eslint-plugin with eslint-plugin-x in [#126903](https://github.com/getsentry/sentry/pull/126903)
- Prune stale oxlint suppression budget for stream/group.tsx in [#126874](https://github.com/getsentry/sentry/pull/126874)
- Prune stale key-value tree suppression budget in [#126774](https://github.com/getsentry/sentry/pull/126774)

#### Metrics

- Remove the SENTRY_METRICS_SKIP_ALL_INTERNAL default by @Starrao123 in [#127271](https://github.com/getsentry/sentry/pull/127271)
- Remove InternalMetrics and the internal TSDB model by @Starrao123 in [#126989](https://github.com/getsentry/sentry/pull/126989)

#### Monitors

- Move the cron check-ins timeline onto SimpleTable by @JoshuaKGoldberg in [#126889](https://github.com/getsentry/sentry/pull/126889)
- Move the uptime monitor timeline onto SimpleTable by @JoshuaKGoldberg in [#126896](https://github.com/getsentry/sentry/pull/126896)

#### Notifications

- Remove dead snooze alert mute links from emails in [#127908](https://github.com/getsentry/sentry/pull/127908)
- Use workflow origins in digest tests in [#127895](https://github.com/getsentry/sentry/pull/127895)
- Mock Gravatar lookups in email tests by @sentry-junior in [#127945](https://github.com/getsentry/sentry/pull/127945)
- Simplify SerializableRuleProxy by @sentry-junior in [#127596](https://github.com/getsentry/sentry/pull/127596)
- Use origins for notification identity by @kcons in [#127085](https://github.com/getsentry/sentry/pull/127085)
- Remove legacy translation helpers by @kcons in [#127422](https://github.com/getsentry/sentry/pull/127422)
- Check legacy rule existence instead of fetching it by @sentry-junior in [#127421](https://github.com/getsentry/sentry/pull/127421)
- Remove render-only Rule compatibility by @kcons in [#126791](https://github.com/getsentry/sentry/pull/126791)
- Add and use NotificationOrigin.is_test_notification by @kcons in [#127103](https://github.com/getsentry/sentry/pull/127103)
- Use NotificationActionContext instead of Rule in alert actions in [#126733](https://github.com/getsentry/sentry/pull/126733)
- Expand NotificationOrigin to alert actions by @kcons in [#126598](https://github.com/getsentry/sentry/pull/126598)
- Use explicit origins for notification rendering by @kcons in [#126529](https://github.com/getsentry/sentry/pull/126529)

#### Np

- Move slack metric alerts to shared np by @shayna-ch in [#127064](https://github.com/getsentry/sentry/pull/127064)
- Build Slack metric alert platform data with the shared factory by @hobzcalvin in [#126674](https://github.com/getsentry/sentry/pull/126674)

#### O11y

- Remove set_span_attribute shim in [#128010](https://github.com/getsentry/sentry/pull/128010)
- Stop using set_span_attribute in event manager in [#128004](https://github.com/getsentry/sentry/pull/128004)
- Stop using set_span_attribute in release model in [#128007](https://github.com/getsentry/sentry/pull/128007)
- Stop using set_span_attribute in metrics indexer processing in [#128009](https://github.com/getsentry/sentry/pull/128009)
- Stop using set_span_attribute in transaction clusterer rules in [#128005](https://github.com/getsentry/sentry/pull/128005)
- Stop using set_span_attribute in profiles utils in [#128001](https://github.com/getsentry/sentry/pull/128001)
- Stop using set_span_attribute in search events fields in [#128008](https://github.com/getsentry/sentry/pull/128008)
- Stop using set_span_attribute in profiles task in [#128000](https://github.com/getsentry/sentry/pull/128000)
- Stop using set_span_attribute in organization event details in [#128006](https://github.com/getsentry/sentry/pull/128006)
- Use `SegmentNameSource` instead of `TransactionSource` by @sentrivana in [#128013](https://github.com/getsentry/sentry/pull/128013)
- Stop using set_span_attribute in api endpoints by @sentrivana in [#127999](https://github.com/getsentry/sentry/pull/127999)
- Stop using set_span_attribute in api bases organization by @sentrivana in [#128002](https://github.com/getsentry/sentry/pull/128002)
- Stop using set_span_attribute in api utils by @sentrivana in [#128003](https://github.com/getsentry/sentry/pull/128003)
- Remove `utils.tracing` module by @alexander-alderman-webb in [#127178](https://github.com/getsentry/sentry/pull/127178)

#### Oauth

- Make device consent completion atomic in [#127823](https://github.com/getsentry/sentry/pull/127823)
- Extract device request validation and sessions in [#127820](https://github.com/getsentry/sentry/pull/127820)
- Extract authorization transactions and grants in [#127816](https://github.com/getsentry/sentry/pull/127816)
- Extract authorization request validation in [#127815](https://github.com/getsentry/sentry/pull/127815)
- Extract shared consent operations in [#127792](https://github.com/getsentry/sentry/pull/127792)
- Route consent authentication through canonical login by @evanpurkhiser in [#126175](https://github.com/getsentry/sentry/pull/126175)

#### Onboarding

- Assert repo-derived SCM project names in acceptance tests by @Abdkhan14 in [#127435](https://github.com/getsentry/sentry/pull/127435)
- Accept repo-derived SCM project names in acceptance tests by @Abdkhan14 in [#127434](https://github.com/getsentry/sentry/pull/127434)

#### Performance

- Remove unused events-trends endpoints by @DominikB2014 in [#128194](https://github.com/getsentry/sentry/pull/128194)
- Remove unused suspect spans endpoints by @DominikB2014 in [#128186](https://github.com/getsentry/sentry/pull/128186)
- Remove unused trends query code by @DominikB2014 in [#128192](https://github.com/getsentry/sentry/pull/128192)
- Remove internal web vitals detector endpoint by @DominikB2014 in [#127395](https://github.com/getsentry/sentry/pull/127395)
- Remove unused DELETE publish status from general settings endpoint by @DominikB2014 in [#127391](https://github.com/getsentry/sentry/pull/127391)
- Mark transaction threshold endpoints as legacy by @DominikB2014 in [#127062](https://github.com/getsentry/sentry/pull/127062)

#### Profiling

- Move the call tree table onto SimpleTable by @JoshuaKGoldberg in [#126976](https://github.com/getsentry/sentry/pull/126976)
- Break circular dependency between flamegraphDrawer and profileDetails by @sentry in [#127475](https://github.com/getsentry/sentry/pull/127475)

#### Refactor Tasks

- Move conventions to search blocks with excerpts by @ryan953 in [#126965](https://github.com/getsentry/sentry/pull/126965)
- Use the scanner's default model and concurrency in [#126423](https://github.com/getsentry/sentry/pull/126423)

#### Releases

- Move list project rows onto SimpleTable by @JoshuaKGoldberg in [#126909](https://github.com/getsentry/sentry/pull/126909)
- Drop the release new_id column by @ldelvoye in [#127461](https://github.com/getsentry/sentry/pull/127461)
- Stop dual-writing release new_id by @ldelvoye in [#127438](https://github.com/getsentry/sentry/pull/127438)
- Swap new_id into the release primary key by @ldelvoye in [#126200](https://github.com/getsentry/sentry/pull/126200)

#### Reprocessing

- Copy unprocessed event in symbolication instead of consumer by @matt-codecov in [#126811](https://github.com/getsentry/sentry/pull/126811)
- Optionally pass unprocessed copy inline instead of via redis by @matt-codecov in [#126810](https://github.com/getsentry/sentry/pull/126810)

#### Saved Queries

- Accept both by @wmak in [#128048](https://github.com/getsentry/sentry/pull/128048)
- Add stats period to the response by @wmak in [#127802](https://github.com/getsentry/sentry/pull/127802)

#### Scm

- Fetch a repository's integration once per SCM client by @vaind in [#128178](https://github.com/getsentry/sentry/pull/128178)
- Use url_is_under for Azure DevOps and Cursor source URLs by @vaind in [#128175](https://github.com/getsentry/sentry/pull/128175)
- Remove auto-link-repos-by-name flag and dry-run option by @wedamija in [#128137](https://github.com/getsentry/sentry/pull/128137)

#### Scraps

- Remove package verify script and CI gate by @sentry-junior in [#128262](https://github.com/getsentry/sentry/pull/128262)
- Extract Button and simple controls by @natemoo-re in [#127639](https://github.com/getsentry/sentry/pull/127639)
- Extract Tooltip and shared overlays by @natemoo-re in [#127630](https://github.com/getsentry/sentry/pull/127630)
- Extract leaf components and Prose by @natemoo-re in [#127628](https://github.com/getsentry/sentry/pull/127628)
- Isolate Link in the scraps package by @natemoo-re in [#127423](https://github.com/getsentry/sentry/pull/127423)
- Require explicit React imports by @TkDodo in [#127532](https://github.com/getsentry/sentry/pull/127532)
- Move isolated core components into the package by @TkDodo in [#127513](https://github.com/getsentry/sentry/pull/127513)
- Remove Separator layout import cycle by @TkDodo in [#127222](https://github.com/getsentry/sentry/pull/127222)
- Scope release tags and automate versioning by @natemoo-re in [#126643](https://github.com/getsentry/sentry/pull/126643)

#### Seer

- Log each PR iteration analytics event when it is sent by @joseph-sentry in [#128360](https://github.com/getsentry/sentry/pull/128360)
- Move workflow runs to an explicit API route by @trevor-e in [#128231](https://github.com/getsentry/sentry/pull/128231)
- Queue the Seer Agent refresh from the completion hook in [#127807](https://github.com/getsentry/sentry/pull/127807)
- Add a task that refreshes Seer Agent entrypoints by @joseph-sentry in [#127806](https://github.com/getsentry/sentry/pull/127806)
- Drop the duplicate org default writes from the org details endpoint by @shellmayr in [#127543](https://github.com/getsentry/sentry/pull/127543)
- Verify ViewerContext at production boundaries in [#126527](https://github.com/getsentry/sentry/pull/126527)
- Remove 2 orphaned RPCs in [#126796](https://github.com/getsentry/sentry/pull/126796)
- Remove non-agentic assisted-query endpoints and translate flag reads in [#126549](https://github.com/getsentry/sentry/pull/126549)

#### Sentry Apps

- Eager load app and token in proxy user lookup in [#127720](https://github.com/getsentry/sentry/pull/127720)
- Index SentryAppInstallation.uuid in [#126952](https://github.com/getsentry/sentry/pull/126952)

#### Settings

- Move the integration serverless functions table onto SimpleTable by @JoshuaKGoldberg in [#127100](https://github.com/getsentry/sentry/pull/127100)
- Move the integration code mappings table onto SimpleTable by @JoshuaKGoldberg in [#127095](https://github.com/getsentry/sentry/pull/127095)
- Move the members list onto SimpleTable by @JoshuaKGoldberg in [#127045](https://github.com/getsentry/sentry/pull/127045)

#### Source Map Debug

- Read a release's newest bundles from its links alone by @mwarkentin in [#127077](https://github.com/getsentry/sentry/pull/127077)
- Optionally match release files by bundle instead of by URL by @mwarkentin in [#126781](https://github.com/getsentry/sentry/pull/126781)
- Optionally check only the project's newest bundles for debug IDs in [#126777](https://github.com/getsentry/sentry/pull/126777)

#### Tables

- Replace GridEditable with a DataGrid adapter over SimpleTable in [#126790](https://github.com/getsentry/sentry/pull/126790)
- Fold DataTable into SimpleTable in [#126727](https://github.com/getsentry/sentry/pull/126727)

#### Tests

- Skip stack walk in silo transaction validation unless it would raise by @sentry-junior in [#127937](https://github.com/getsentry/sentry/pull/127937)
- Flush transactional test databases with DELETE instead of TRUNCATE by @sentry-junior in [#127941](https://github.com/getsentry/sentry/pull/127941)
- Cut Relay readiness wait in relay_server by @sentry-junior in [#127942](https://github.com/getsentry/sentry/pull/127942)
- Use pytest subtests for parametrized tests with heavy setup by @sentry-junior in [#127939](https://github.com/getsentry/sentry/pull/127939)
- Share test tooling across workspace packages by @TkDodo in [#127153](https://github.com/getsentry/sentry/pull/127153)
- Slim what the Jest setup file loads for every spec by @billyvg in [#127034](https://github.com/getsentry/sentry/pull/127034)

#### Tsdb

- Remove the servicehook_fired TSDB model and its stats endpoint by @Starrao123 in [#127317](https://github.com/getsentry/sentry/pull/127317)
- Remove the unused project_total_forwarded TSDB model in [#126979](https://github.com/getsentry/sentry/pull/126979)
- Replace redis-blaster with redis-py in RedisTSDB in [#126797](https://github.com/getsentry/sentry/pull/126797)
- Delete unused RedisTSDB methods in [#126788](https://github.com/getsentry/sentry/pull/126788)

#### Ui

- Enable type-aware linting in pre-commit by @TkDodo in [#128060](https://github.com/getsentry/sentry/pull/128060)
- Migrate styled layouts to primitives in [#127119](https://github.com/getsentry/sentry/pull/127119)
- Use Scraps inputs for read-only copy fields by @TkDodo in [#127736](https://github.com/getsentry/sentry/pull/127736)
- Enable React Compiler in all environments by @scttcper in [#127564](https://github.com/getsentry/sentry/pull/127564)
- Simplify AvatarButton props by @TkDodo in [#127511](https://github.com/getsentry/sentry/pull/127511)
- Keep chunk hashes stable across deploys by @scttcper in [#127286](https://github.com/getsentry/sentry/pull/127286)

#### Uptime

- Mock the robots.txt fetch in candidate URL tests by @sentry-junior in [#127947](https://github.com/getsentry/sentry/pull/127947)
- Remove the uptime.config-drift.repair option by @Starrao123 in [#126618](https://github.com/getsentry/sentry/pull/126618)

#### Workflow Engine

- Fix API JSON examples and accuracy by @leeandher in [#127621](https://github.com/getsentry/sentry/pull/127621)
- Skip detector lookup when nothing to create by @scttcper in [#127495](https://github.com/getsentry/sentry/pull/127495)
- Correctly report required scopes for alerts by @leeandher in [#126383](https://github.com/getsentry/sentry/pull/126383)
- Use CacheMapping for release condition caches by @sentry-junior in [#126532](https://github.com/getsentry/sentry/pull/126532)

#### Other

- (api-docs) Remove unused markdown index template by @evanpurkhiser in [#127659](https://github.com/getsentry/sentry/pull/127659)
- (apidocs) Reuse experimental parameter marking by @wmak in [#127419](https://github.com/getsentry/sentry/pull/127419)
- (artifact-lookup) Optionally skip legacy release file queries for releases without any by @mwarkentin in [#126357](https://github.com/getsentry/sentry/pull/126357)
- (backpressure) Stop monitoring the attachments store by @sentry-junior in [#128157](https://github.com/getsentry/sentry/pull/128157)
- (billing) Filter usage query to billable outcomes by @noahsmartin in [#127348](https://github.com/getsentry/sentry/pull/127348)
- (ctrl) Removes organizations from list live in decommissioned localities/cells in [#126676](https://github.com/getsentry/sentry/pull/126676)
- (dashboards) Remove circular dependencies by @TkDodo in [#127232](https://github.com/getsentry/sentry/pull/127232)
- (DE) Refactor, rename and move files around for better structure by @adrianviquez in [#127093](https://github.com/getsentry/sentry/pull/127093)
- (debug files) Add legacy WASM code/debug ID columns by @loewenheim in [#127508](https://github.com/getsentry/sentry/pull/127508)
- (detectors) Use one get_detector_validator helper in [#128054](https://github.com/getsentry/sentry/pull/128054)
- (discover) Make save as query button same as traces by @lzhao-sentry in [#126464](https://github.com/getsentry/sentry/pull/126464)
- (filters) Remove ingest codeownership by @jjbayer in [#127517](https://github.com/getsentry/sentry/pull/127517)
- (forms) Migrate subscription cancellation form to Scraps by @priscilawebdev in [#126130](https://github.com/getsentry/sentry/pull/126130)
- (formulas) Rename 4threshold to frustrated by @wmak in [#127790](https://github.com/getsentry/sentry/pull/127790)
- (github) Query webhook repositories once by @scttcper in [#128142](https://github.com/getsentry/sentry/pull/128142)
- (inbound_email) Remove NewNoteForm in [#126869](https://github.com/getsentry/sentry/pull/126869)
- (insights) Remove deprecated starred-segments route by @DominikB2014 in [#126955](https://github.com/getsentry/sentry/pull/126955)
- (issue detection) Expand tests checking span attributes in shim event by @lobsterkatie in [#127090](https://github.com/getsentry/sentry/pull/127090)
- (issue detectors) Improve context and request data in shim transaction event in [#127883](https://github.com/getsentry/sentry/pull/127883)
- (issueDetails) Break circular dependency between sidebar and detectorSection by @sentry in [#127477](https://github.com/getsentry/sentry/pull/127477)
- (jira) Load install metadata from the integration record by @mrduncan in [#128139](https://github.com/getsentry/sentry/pull/128139)
- (menu) Make Menu a shared presentation layer by @priscilawebdev in [#127982](https://github.com/getsentry/sentry/pull/127982)
- (migrations) Don't leave project state rendered after pending-deletion ops by @sentry-junior in [#127458](https://github.com/getsentry/sentry/pull/127458)
- (node) Upgrade to Node 26.11.1 by @billyvg in [#127036](https://github.com/getsentry/sentry/pull/127036)
- (notifs) Remove unused integration disable email templates by @evanpurkhiser in [#127636](https://github.com/getsentry/sentry/pull/127636)
- (objectstore) Share the raw request body helper by @vaind in [#128091](https://github.com/getsentry/sentry/pull/128091)
- (ourlogs) Remove the regex searches flag from the backend by @JoshuaKGoldberg in [#127038](https://github.com/getsentry/sentry/pull/127038)
- (ownership) Fetch only the latest assignment activity by @scttcper in [#128144](https://github.com/getsentry/sentry/pull/128144)
- (perforce) Wrap every connection failure in P4Exception in [#128163](https://github.com/getsentry/sentry/pull/128163)
- (pr-metrics) Look up commit ids before resolving group links in [#127927](https://github.com/getsentry/sentry/pull/127927)
- (pre-commit) Bump check-jsonschema to 0.38.2 by @scttcper in [#126663](https://github.com/getsentry/sentry/pull/126663)
- (preprod) Use regular PUTs for snapshot archive uploads by @lcian in [#128181](https://github.com/getsentry/sentry/pull/128181)
- (projects) Move the projects dashboard deploys list onto SimpleTable by @JoshuaKGoldberg in [#127106](https://github.com/getsentry/sentry/pull/127106)
- (quotas) Remove unused Quota.is_rate_limited by @Starrao123 in [#126604](https://github.com/getsentry/sentry/pull/126604)
- (ratelimit) Skip org lookup RPC for sentry app tokens in [#126661](https://github.com/getsentry/sentry/pull/126661)
- (release) Bump craft to 2.34.1 by @sentry-junior in [#127399](https://github.com/getsentry/sentry/pull/127399)
- (replays) Move the Network and Errors tables onto SimpleTable by @JoshuaKGoldberg in [#126864](https://github.com/getsentry/sentry/pull/126864)
- (repos) Index repositories by org, status, and name in [#128052](https://github.com/getsentry/sentry/pull/128052)
- (router) Adopt V8 import paths while retaining V6 by @nsdeschenes in [#126570](https://github.com/getsentry/sentry/pull/126570)
- (search_resolver) Cleanup aggregate definitions by @wmak in [#127055](https://github.com/getsentry/sentry/pull/127055)
- (seer-chat-suggestions) Improve error handling in the chat suggestions endpoint by @srest2021 in [#127124](https://github.com/getsentry/sentry/pull/127124)
- (self-hosted) Drop BuildKit cache and skip QEMU for native builds by @sentry-junior in [#127277](https://github.com/getsentry/sentry/pull/127277)
- (sentryapps) Add exp validation and requriement for jwts by @Christinarlong in [#121673](https://github.com/getsentry/sentry/pull/121673)
- (skills) Remove completed container query migration guide in [#127002](https://github.com/getsentry/sentry/pull/127002)
- (slack) Remove unused workspace migration templates by @evanpurkhiser in [#127633](https://github.com/getsentry/sentry/pull/127633)
- (sms) Load phonenumbers on first use by @shellmayr in [#126446](https://github.com/getsentry/sentry/pull/126446)
- (snuba) Remove referrers for deleted TSDB models 0 and 105 by @Starrao123 in [#127326](https://github.com/getsentry/sentry/pull/127326)
- (symbolication) Move JS and JVM symbolication tasks to dedicated namespaces by @sentry-junior in [#126945](https://github.com/getsentry/sentry/pull/126945)
- (templates) Remove legacy indicator initialization in [#126771](https://github.com/getsentry/sentry/pull/126771)
- (test) Replace Emotion style assertions with visual snapshots in [#128042](https://github.com/getsentry/sentry/pull/128042)
- (transformations) Tidying up code and file locations by @nsdeschenes in [#127762](https://github.com/getsentry/sentry/pull/127762)
- (vercel) Remove the Vercel integration, now served from getsentry in [#126538](https://github.com/getsentry/sentry/pull/126538)
- (weekly-report) Retire past resolved issues feature flag in [#128064](https://github.com/getsentry/sentry/pull/128064)
- (workflows) Share slow-condition query preparation by @cvxluo in [#127325](https://github.com/getsentry/sentry/pull/127325)
- Remove deprecated collect-test-data step by @sentry-junior in [#128310](https://github.com/getsentry/sentry/pull/128310)
- Bump sentry-protos to 0.87.0 by @sentry-release-bot in [#128270](https://github.com/getsentry/sentry/pull/128270)
- Bump sentry-arroyo to 2.47.0 by @sentry-junior in [#128027](https://github.com/getsentry/sentry/pull/128027)
- Fix leaked attachment response and expired seer replay fixture by @sentry-junior in [#127952](https://github.com/getsentry/sentry/pull/127952)
- Fix the most frequent backend test reruns by @sentry-junior in [#127951](https://github.com/getsentry/sentry/pull/127951)
- Bump taskbroker-client to 0.20.29 by @sentry-release-bot in [#127852](https://github.com/getsentry/sentry/pull/127852)
- Bump new development version by @sentry-release-bot[bot] in [a84fbcc6](https://github.com/getsentry/sentry/commit/a84fbcc68d2f035c4c3f861eaf36b8556b41b04c)
- Remove unused root crossdomain policy template by @evanpurkhiser in [#127658](https://github.com/getsentry/sentry/pull/127658)
- Remove unused form field template partial by @evanpurkhiser in [#127651](https://github.com/getsentry/sentry/pull/127651)
- Bump sentry-protos to 0.86.0 by @sentry-release-bot in [#127611](https://github.com/getsentry/sentry/pull/127611)
- Bump sentry-relay to 0.10.1 by @sentry-release-bot in [#126839](https://github.com/getsentry/sentry/pull/126839)
- Bump sentry-protos to 0.83.0 by @sentry-release-bot in [#127335](https://github.com/getsentry/sentry/pull/127335)
- Bump sentry-options to 1.2.15 by @sentry-release-bot in [#127320](https://github.com/getsentry/sentry/pull/127320)
- Bump sentry-protos to 0.82.1 by @sentry-release-bot in [#127315](https://github.com/getsentry/sentry/pull/127315)
- Replace timer-driven waits with fake clocks by @natemoo-re in [#127079](https://github.com/getsentry/sentry/pull/127079)
- Bump sentry-arroyo to 2.46.0 by @sentry-release-bot in [#127296](https://github.com/getsentry/sentry/pull/127296)
- Bump taskbroker-client to 0.20.28 by @sentry-release-bot in [#127295](https://github.com/getsentry/sentry/pull/127295)
- Bump sentry-sdk to 2.72.0 by @sentry-release-bot in [#127195](https://github.com/getsentry/sentry/pull/127195)
- Bump sentry-conventions to 0.27.0 by @sentry-junior in [#127179](https://github.com/getsentry/sentry/pull/127179)
- Bump sentry-sdk to 2.71.0 by @sentry-release-bot in [#127181](https://github.com/getsentry/sentry/pull/127181)
- Inline span-streaming branch of tracing shims in `app-backend` files by @alexander-alderman-webb in [#124533](https://github.com/getsentry/sentry/pull/124533)
- Inline span-streaming branch of tracing shims in replays by @alexander-alderman-webb in [#124720](https://github.com/getsentry/sentry/pull/124720)
- Inline span-streaming branch of tracing shim in `trace_func` decorator by @alexander-alderman-webb in [#127163](https://github.com/getsentry/sentry/pull/127163)
- Inline span-streaming branch of tracing shims in autofix by @alexander-alderman-webb in [#127161](https://github.com/getsentry/sentry/pull/127161)
- Inline span-streaming branch of tracing shims in `ingestion_delay` by @alexander-alderman-webb in [#127162](https://github.com/getsentry/sentry/pull/127162)
- Pull Docker Hub images from getsentry/image-mirror by @sentry-junior in [#127117](https://github.com/getsentry/sentry/pull/127117)
- Bump sentry-protos to 0.82.0 by @sentry-release-bot in [#127102](https://github.com/getsentry/sentry/pull/127102)
- Inline span-streaming branch of tracing shims in owners-snuba files by @alexander-alderman-webb in [#124718](https://github.com/getsentry/sentry/pull/124718)
- Skip suppression pruning for backend-only PRs by @nsdeschenes in [#127032](https://github.com/getsentry/sentry/pull/127032)
- Inline span streaming branch of tracing shims in `monitors.consumers` by @alexander-alderman-webb in [#124688](https://github.com/getsentry/sentry/pull/124688)
- Inline span-streaming branch of tracing shims in unowned files by @alexander-alderman-webb in [#124872](https://github.com/getsentry/sentry/pull/124872)
- Inline span-streaming branch of tracing shims in Alerts & Monitors files by @alexander-alderman-webb in [#124532](https://github.com/getsentry/sentry/pull/124532)
- Inline span-streaming branch of tracing shims in `consumers.profiler` by @alexander-alderman-webb in [#124717](https://github.com/getsentry/sentry/pull/124717)
- Inline span-streaming branch of tracing shims in Notifications files by @alexander-alderman-webb in [#124716](https://github.com/getsentry/sentry/pull/124716)
- Inline span-streaming branch of tracing shims in SDK helpers in [#124724](https://github.com/getsentry/sentry/pull/124724)
- Inline span-streaming branch of tracing shims in Data Browsing files in [#124870](https://github.com/getsentry/sentry/pull/124870)
- Inline span-streaming branch of tracing shims in Issue Feed files in [#124710](https://github.com/getsentry/sentry/pull/124710)
- Inline span-streaming branch of tracing shims in Releases in [#124536](https://github.com/getsentry/sentry/pull/124536)
- Inline span-streaming branch of tracing shims in security files in [#124723](https://github.com/getsentry/sentry/pull/124723)
- Inline span-streaming branch of tracing shims in dashboard in [#124696](https://github.com/getsentry/sentry/pull/124696)
- Inline span-streaming branch of tracing shims in Seer files in [#124714](https://github.com/getsentry/sentry/pull/124714)
- Move scraps package codeowners to shared block in [#126824](https://github.com/getsentry/sentry/pull/126824)
- Delete unused quotas functions in [#126767](https://github.com/getsentry/sentry/pull/126767)
- Bump sentry-protos to 0.81.1 by @sentry-release-bot in [#126735](https://github.com/getsentry/sentry/pull/126735)
- Unify TopBar title slot with breadcrumbs titleItem by @TkDodo in [#126554](https://github.com/getsentry/sentry/pull/126554)
- Use deprecation-aware EAP attribute accessors by @mjq in [#126640](https://github.com/getsentry/sentry/pull/126640)
- Inline span-streaming branch of tracing shims in Issue Detection files by @alexander-alderman-webb in [#124711](https://github.com/getsentry/sentry/pull/124711)
- Inline span-streaming branch of tracing shims in billing by @alexander-alderman-webb in [#124721](https://github.com/getsentry/sentry/pull/124721)
- Inline span-streaming branch of tracing shims in Ingest files by @alexander-alderman-webb in [#124707](https://github.com/getsentry/sentry/pull/124707)
- Bump sentry-conventions to 0.26.0 by @sentry-junior in [#126553](https://github.com/getsentry/sentry/pull/126553)
- Fix type in `virtual_context` assertion in `elapsed_if` test by @alexander-alderman-webb in [#126680](https://github.com/getsentry/sentry/pull/126680)

### Other

- lint(seer): Prevent new generic LLM callers by @sehr-m in [#128292](https://github.com/getsentry/sentry/pull/128292)
- chore(db) Update commit.new_repository_id for new writes by @markstory in [#128067](https://github.com/getsentry/sentry/pull/128067)
- chore(db) Add commit.new_repository_id v2 in [#128077](https://github.com/getsentry/sentry/pull/128077)
- dep: bump `punkreq` and `granian` in [#128166](https://github.com/getsentry/sentry/pull/128166)
- wmak(rpc): Fix flextime ordering in [#128058](https://github.com/getsentry/sentry/pull/128058)
- chore(cells) Remove provisioning cell rollout logic in [#127872](https://github.com/getsentry/sentry/pull/127872)
- lint(frontend): Enforce responsive props for layout queries by @priscilawebdev in [#127003](https://github.com/getsentry/sentry/pull/127003)
- types: Trim down the weaklist by @kcons in [#127894](https://github.com/getsentry/sentry/pull/127894)
- deps(ui): Upgrade mobx to v7 and mobx-react-lite to v5 by @scttcper in [#127837](https://github.com/getsentry/sentry/pull/127837)
- deps(ui): Upgrade oxlint to 1.88.0 and oxfmt to 0.73.0 by @scttcper in [#127768](https://github.com/getsentry/sentry/pull/127768)
- release: 26.10.0 by @chadwhitacre in [da07b233](https://github.com/getsentry/sentry/commit/da07b233acfb0c32d5e507f991059b3949c9f271)
- Ensure email sent to user's stored email by @michelletran-sentry in [#127388](https://github.com/getsentry/sentry/pull/127388)
- types(digest): Narrow event_to_record to just GroupEvent by @kcons in [#127316](https://github.com/getsentry/sentry/pull/127316)
- types(notifications): Annotate plugins.base.structs.Notification and remove from weaklist in [#126975](https://github.com/getsentry/sentry/pull/126975)
- typing(notifications): Type BaseNotification message descriptions in [#126764](https://github.com/getsentry/sentry/pull/126764)
- chores(codeowners): Replace design team with product design in [#126741](https://github.com/getsentry/sentry/pull/126741)

## 0.1.0

- Publish the first curated Scraps entries for themes, tokens, layout, typography, separators, quotes, loaders, inline code, and keyboard key labels.

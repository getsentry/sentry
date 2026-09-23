# Implement workflow-engine evaluation artifacts in EAP

Approved plan: `.artifacts/workflow-engine-eap-artifacts-plan.md` (contains detailed execution log).

## Goals

- One full artifact, non-mutating log projection; no parallel artifact builders.
- Org-gated dedicated EAP diagnostic persistence with task retry isolation.
- Scoped unit tests and real EAP item readback tests.
- Prepare proto/Snuba local prerequisites without remote releases/pushes/rollout.

## Checklist

- [x] Save approved plan.
- [x] Verify current upstream proto and Snuba registration requirements.
- [x] Implement full artifact/log projection atomically and run unit tests.
- [x] Implement explicit complex-input serialization + org-gated EAP producer and build-once dispatch.
- [x] Add producer unit tests and full EAP readback tests.
- [ ] Complete minimal upstream patches and verification.
- [ ] Final diagnostics/lint/test/scope review with honest dependency blockers.

## Verification

Working directory: `/Users/josh.callender/code/sentry`.

- `.venv/bin/pytest -n3 -q --reuse-db tests/sentry/workflow_engine/processors/evaluations tests/sentry/workflow_engine/processors/test_detector.py tests/sentry/workflow_engine/test_task.py` -> 139 passed. Log: .artifacts/workflow-eap-unit-tests.log.
- `.venv/bin/pytest -q --reuse-db tests/sentry/workflow_engine/processors/test_delayed_workflow.py::TestGetGroupsToFire` -> 11 passed. Log: .artifacts/workflow-eap-delayed-tests.log.
- Initial active LSP found one test object-index type issue, fixed by narrowing with isinstance. Some LSP paths inconclusive; no claim of full clean yet.
- Correct ruff hooks are `ruff-check` / `ruff-format`, not `ruff`. Ruff check passes; formatter applied formatting. Use UV_NO_SYNC=1 for future prek invocations to preserve local prerelease proto and editable install.
- First broader parallel test run produced unrelated Snuba reset/query test errors. Sequential artifact tests passed; run future Snuba tests sequentially.

## State / continuation

- Current Sentry branch: jcallender/evaluation-artifacts-on-eap. No commits made.
- Changes in seven tracked files: evaluations/base.py, condition.py, detector.py, workflow.py; processors/evaluation_logging.py, delayed_workflow.py; tests/.../evaluations/test_workflow.py.
- BaseArtifact.to_dict converts nested artifact dataclasses but preserves the `input` value by reference (no deepcopy). All three process-result artifact conversion sites use it. condition artifact retains self.data. evaluation_logging.redact_evaluation_artifact redacts only non-scalar `input`, protects both SDK/std logs, and no longer mutates source dict adding org id.
- Local upstream clones are under .artifacts/workflow-eap-upstream. sentry-protos branch feat/workflow-evaluation-item-type contains enum WORKFLOW_ENGINE_EVALUATION=14 (upstream currently max13). Generated Python bindings in py/sentry_protos via normal py/generate.py using own .venv with SENTRY_PROTOS_BUILD_UNSTABLE=1 (Sentry imports conduit.v1alpha). Installed that normally built local package in project .venv via `uv pip install --python .venv/bin/python --no-deps --reinstall .artifacts/workflow-eap-upstream/sentry-protos/py`. Metadata version is upstream VERSION 0.73.1, but it contains an UNRELEASED enum addition; do not claim published 0.73.1 supports it or bump project requirement to that. Actual future release/pin remains a landing prerequisite. No manual edits to installed generated bindings.
- Proto generator venv requirements needed public PyPI index (internal registry lacked mypy-protobuf). Generated version inherited upstream current VERSION.
- Snuba branch feat/workflow-evaluation-items is fresh default clone. Necessary changes identified: exhaustive Rust app_feature match in rust_snuba/src/processors/eap_items.rs; querylog/**init**.py app attribution mapping; web/rpc/storage_routing/routing_strategies/common.py ITEM_TYPE_FULL_RETENTION. No new table. Add actual type/JSON consumer test.
- Tests use unittest TestCase, so pytest.mark.parametrize doesn't inject args into methods. Use standalone parametrized functions or named test methods/helpers.
- Docker running via DOCKER_HOST=unix:///Users/josh.callender/.colima/default/docker.sock (default socket absent). Existing snuba-snuba-1 nightly, snuba-clickhouse-1, kafka-kafka-1 etc running. Need EAP readback with generated proto and new type; prefer isolated local service/sidecar to altering shared running Snuba. No production rollout.
- Tern loader failed because CLI lacks skill; approved plan is inventory. No extra framework changes.

## Iteration 1 progress

- Added src/sentry/workflow_engine/processors/evaluation_eap.py: org gate/resolution before capture, full JSON serialization of nested data and WorkflowEventData/Activity snapshots, project/org validation, string indexed IDs, schema version, UUID items/synthetic trace grouping, retention, size metric and best-effort producer. FutureTrackingProducer explicitly has should_track_futures=False / should_backpressure=False and delivery callback metrics; bounded Kafka buffer. No raw exception contents logged.
- Existing evaluation_logging entry points decide log sampling and EAP independently, build artifacts once, fan out full artifact to producer and redacted view to log. Return value remains whether logs emitted. All existing callsites reused. Registered backend-only temporary EAP org flag.
- Added 14 producer/emitter/serializer tests to existing test_workflow.py using LocalBroker/MemoryMessageStorage. Scope/large IDs/gate/per-item failures/asynchronous delivery/task-future isolation covered. Existing suites still pass.
- Latest exact command: `UV_NO_SYNC=1 .venv/bin/pytest -n3 -q --reuse-db tests/sentry/workflow_engine/processors/evaluations tests/sentry/workflow_engine/processors/test_detector.py tests/sentry/workflow_engine/test_task.py` -> 153 passed (32.20s), .artifacts/workflow-eap-unit-tests.log.
- Actual mypy command: `UV_NO_SYNC=1 SENTRY_MYPY_PRE_PUSH=1 .venv/bin/prek run mypy --files src/sentry/workflow_engine/processors/evaluation_eap.py src/sentry/workflow_engine/processors/evaluation_logging.py tests/sentry/workflow_engine/processors/evaluations/test_workflow.py --stage pre-push` -> Passed. Earlier command lacking SENTRY_MYPY_PRE_PUSH was a no-op, do not count it.
- Active LSP on producer/emitter/tests has no unsuppressed diagnostics. Seven Pyright findings recorded as session-only false positives: generated Django FK *_id attributes; stale cached enum stub and new module imports. Verified by runtime tests + active mypy; no inline ignores added. Cache is stale across .venv restoration.
- Environment repair: bare uv run in prek recreated project .venv using current system Python3.13.15 and removed editable Sentry/local proto. Restored with `.venv/bin/python -m tools.fast_editable --path .`, rebuilt proto WITH unstable types, installed generated package. USE UV_NO_SYNC=1 on hooks from here, environment now verified by 153 passing tests. Keep generated artifacts/venvs.
- Remaining next priorities: detector gate/uncached-project and failure-isolation tests; delayed boundary test; real EAP readback integration; actual minimal upstream Snuba edits/tests; full diff/lint review. No changes to main workflow evaluation logic or actions.

## Iteration 2 progress and reflection

- Added 3 detector tests (uncached org resolution, flag off, enqueue failure does not block issue occurrence publication) and delayed boundary test (one build, raw [101] stored, None logged).
- Added `tests/snuba/workflow_engine/test_evaluation_eap.py` with FOUR real EAP integration cases: actual process_workflows_event -> Kafka codec -> actual EAP ingestion -> table RPC/readback, flag off + safe logs, cross-org/project/type isolation, real slow-condition delayed evaluation -> EAP. LocalBroker replaces network Kafka hop; no artifact construction or EAP RPC mocks.
- All 4 integration cases pass. Combined validation `UV_NO_SYNC=1 SNUBA=http://127.0.0.1:1228 .venv/bin/pytest -q --reuse-db tests/sentry/workflow_engine/processors/evaluations tests/sentry/workflow_engine/processors/test_detector.py tests/sentry/workflow_engine/processors/test_delayed_workflow.py::TestGetGroupsToFire tests/sentry/workflow_engine/test_task.py tests/snuba/workflow_engine/test_evaluation_eap.py` -> 172 passed in 101.03s. Log `.artifacts/workflow-eap-combined-tests.log`.
- Typecheck with `UV_NO_SYNC=1 SENTRY_MYPY_PRE_PUSH=1 .venv/bin/prek run mypy --files` all changed implementation/test paths (stage pre-push) passed. Full prek explicit changed-file list passed; log `.artifacts/workflow-eap-prek.log`. Still run final required `prek run -q` plus explicit list, diff check later.
- Prepared minimal Snuba upstream changes in local branch: Rust consumer COGS match + JSON/type/metrics regression test; Python query attribution; full-retention registration + parametrized routing test. No table/storage migration. Dependency version/lock updates intentionally await actual published proto release.
- Proto Rust bindings now generated successfully with Rust1.94.0 (installed alongside default1.78 without changing default). Wrapper `.artifacts/workflow-eap-upstream/protoc` invokes generator venv grpc_tools.protoc; build command from sentry-protos root `PROTOC=/Users/josh.callender/code/sentry/.artifacts/workflow-eap-upstream/protoc cargo +1.94.0 run -p build_sentry_protos`. Build log `.artifacts/workflow-eap-proto-rust-build.log`. Rust Snuba consumer test NOT yet compiled/run: its Cargo.toml depends on sentry_protos0.60, so needs temporary isolated validation manifest/path override for generated local0.73.1, without claiming published0.73.1 contains new enum.
- Isolated Docker service now running `workflow-eap-snuba` on127.0.0.1:1228 + its own `workflow-eap-redis` (standalone). Uses generated proto package and modified Python routing/querylog files via read-only mounts; uses nightly image's existing compiled Rust consumer (generic numeric type storage works; new Rust COGS arm still awaits compile verification). PRESERVE for repeatable tests. Start/reuse script `.artifacts/workflow-eap-upstream/start-snuba.sh`. Existing devservices untouched; shared development ClickHouse remains test target.
- Found root cause of intermittent resets: shared DNS alias `redis` sometimes resolves to cluster Redis -> `SELECT is not allowed in cluster mode` on Snuba reset. New standalone Redis fixes isolated suite. Do not use original port1218 for final Snuba tests; use SNUBA=http://127.0.0.1:1228.
- Snuba runtime after initialize_snuba verifies new enum in full-retention set and querylog attribution map. Sidecar pytest is NOT installed; can test routing directly after initialize_snuba or use local venv if needed. All actual readback tests passed already.
- LSP baseline: test_delayed_workflow.py has pre-existing Pyright factory comparison inference and possibly-unbound group warnings outside changed lines (deferred), plus Django FK attributes (false positive). New integration factory bool/dict inputs are valid JSON but Pyright infers unannotated fixture default as str; marked false positive. Stale module/proto imports likewise recorded with successful real mypy/runtime evidence. Upstream querylog profile TypedDict access + common int conversion warnings are pre-existing and deferred, not fixed outside scope. No inline ignores.
- Reflection: single artifact + log projection is working and EAP roundtrip proves nested payload preservation. Slowdowns were environment/analysis cache, not architecture. Keep scope and avoid broad cleanups. Next priorities: upstream Rust consumer verification if feasible (local validation manifest, no fake published pins), narrow final review of producer/schema coverage (including size/deferred/error cases), final checks and preserve exact repeatable test setup. No commits/pushes/releases requested.

## Iteration 3 reflection

The main implementation and EAP readback are complete locally (172 tests). The single-artifact design is holding up; no evaluation/action behavior changed. Environment repair and stale LSP caches caused most delay, so avoid unrelated cleanup and use the verified isolated Snuba endpoint and UV_NO_SYNC=1. Remaining uncertainty is the unreleased proto dependency and compiling the new Rust consumer match/test, not the Sentry write path. This iteration will attempt Rust verification in a separate validation tree (no fake published dependency pins), review the scoped diff, and finalize rerunnable checks. Add only narrowly justified missing coverage, not new infrastructure/features. Publication/dependency pinning and production rollout remain explicitly external prerequisites.

## Final Verification

Pending. Preserve generated protos/venvs, isolated Docker services, and record exact rerunnable command before completion.

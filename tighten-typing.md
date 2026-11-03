# Campaign: truthful type contracts after #129614

## Status

- **Goal:** every cast, `Any`, `type: ignore`, and fixed-name `getattr`/`setattr` that [#129614](https://github.com/getsentry/sentry/pull/129614) (merged as `ae29b66fe41a`) added has been replaced by a contract that matches runtime behavior, or is kept under a named exemption from **Decisions → Escape-hatch policy**. Each change ships as a small draft PR.
- **Baseline revision:** `1cd41fc29e1` (`origin/master`, 2026-11-03).
- **Remaining (sweep counter, `master` + open campaign drafts):** cast 1202, Any 3355, type-ignore 13, fixed-name-reflection 79.
- **Items:** 2 of 31 in draft (C1 #129702, B1 #129704); 0 of 159 sweep packages. **Red:** none. **Parked:** none.
- **Next:** G1, then B2.

The executor rewrites this block in place after every accepted slice. The **Ledger** is the single tracker for all work: every item, every audit finding (through its item), and every sweep package has a row there.

## Charter

1. **Types state what runtime does.** An annotation is correct when every value the code can produce or accept at runtime fits it. A green mypy run reached through escape hatches is not success. Tighten contracts; never loosen one to make a patch fit.
2. **No behavior change by default.** If a truthful type needs a runtime change (a real bug, or a change that unlocks a much better contract), make it in its own PR when possible. Add a test that fails before the change, and fill in the PR's **Behavior change** section. A PR with no runtime change says `None` there. A behavior change that nobody called out is a defect.
3. **Small, elegant, reviewable drafts.** One contract per PR: a producer, its consumers, and their tests. Target at most about 300 changed non-test lines and about 12 files. Go past that only when the contract cannot be split, and say why in the PR body. Readability beats cleverness: a reviewer should see in a minute why the new type is truer than the old one.
4. **Decide and keep going.** Within the bounds below, make the call, then write it in the PR body. Only decisions that later items depend on go into **Decisions**.
5. **Hard stops park the item:** an action outside the execution grant, a contract change touching frontend code (`static/`), a migration, or an item still red after 3 root-caused attempts. Record the cause and a retry condition in the Ledger, then move on.
6. **Fix egregious problems in passing** in their own commit and PR: a crash reachable from a supported input, or a check that fails in more than 1 of 5 runs. Record other findings in the Ledger and leave them.
7. **One writer by default.** Run parallel lanes only as **Sequence → Parallelism** allows.
8. **Commits and PR titles use Sentry style** (owner decision): `ref(<scope>): Capitalized imperative subject`, `fix(...)` for behavior fixes, `test(...)` for test-only changes. Put the item ID in the body, never in code. Code comments never cite this doc, an item ID, or the audit.
9. **Follow `AGENTS.md`, `src/AGENTS.md`, and `tests/AGENTS.md`.** Don't run formatters. Run `.venv/bin/prek run -q` on changed files before each push.

## Decisions

### Owner (2026-11-03)

- **Scope: seeds plus a full sweep.** Finish the seed workstreams (Phase 1–2), then sweep package by package (Phase 3) until the sweep counter reads zero or every remaining count is a recorded exemption.
- **Draft PRs are authorized.** Push branches and open PRs with `gh pr create --draft`. Never mark one ready, request reviewers, add labels, comment on other PRs, merge, or close.
- **Followups #129615–#129624 are left untouched.** Don't push to, rebase, or comment on them. When a campaign PR covers the same code, start it from `master` and write `Supersedes #N` in its body. The owner closes the old PR.
- **The executor may fix CI on its own drafts.** Check status with `gh pr checks <n>`. Reproduce a failure locally, fix it on the same branch, and push. Never touch workflow files, and never rerun or fix CI on PRs it did not open.
- **Titles use Sentry style**, overriding the owner's global lowercase rule for this campaign.

### Escape-hatch policy (owner, 2026-11-03)

The audit's original rule banned `Any` outright. That is too strict for a Django/DRF codebase. Some dependency generics and test doubles genuinely produce `Any`, and replacing those with `object` buys nothing except `isinstance` noise. Treat each hatch by what it hides:

| Hatch                                                                  | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cast`                                                                 | Effectively banned. Restructure instead: stable local bindings, early returns, branch-local variables, typed accumulators, `isinstance`, typed constructors. Allowed only for an invariant that is true, cannot be expressed to mypy, and that no restructuring can preserve. The PR body must state that invariant and why it holds. Expect close to zero. A helper that returns a caller-chosen type counts as a cast.                                                                                                                                                                                                     |
| `Any`                                                                  | Strongly discouraged, and never for first-party data shapes: payloads, responses, validated data, known `**kwargs`, or the return type of our own functions. Allowed only in these exemption categories: **(E1)** a type argument or override signature that a dependency's stub fixes as `Any` and we cannot reshape (for example DRF `Field` generics, `validated_data: Any` in `create`/`update`); **(E2)** a test double (`MagicMock`, `patch` results) where the mock _is_ the value; **(E3)** mypy-plugin code in `tools/mypy_helpers`. For data that is genuinely unknown, use `object` and parse it at the boundary. |
| `type: ignore[code]`                                                   | Only for a wrong third-party stub we do not vendor. Add a one-line comment naming the dependency quirk; the global comment rule allows this. For stubs under `fixtures/stubs-for-mypy`, fix the stub instead.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `@no_type_check`, blanket `__getattr__` in stubs, weaker mypy settings | Banned.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Fixed-name `getattr`/`setattr`                                         | Banned as a way around a known attribute's type. Allowed only where the attribute really is dynamic (for example a `getattr(obj, name, default)` probe across heterogeneous objects).                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `assert x is not None`                                                 | Only for an internal invariant that is already established, and only where it preserves existing behavior. Never on a value the model, field, or API allows to be `None`. The counter reports new asserts in `src/` as `note`, and the PR body justifies each one.                                                                                                                                                                                                                                                                                                                                                           |
| `TypeGuard`/`TypeIs`                                                   | `TypeIs` only when the function classifies both branches correctly. `TypeGuard` only for a real positive refinement that checks the full promised shape: keys and element types. Each new guard gets a false-branch test (**Test policy**). A content predicate such as `check_if_results_have_data` stays `-> bool`.                                                                                                                                                                                                                                                                                                        |

Every `FAIL` line from the counter's `diff` mode must appear in the PR body under **Escape hatches kept**, with its category (E1/E2/E3, or the stated invariant for a cast). An unlisted `FAIL` blocks the push.

### Prescribed design rules

- **Parse, don't validate.** At HTTP, RPC, JSON/YAML, config, queue, browser, database-JSON, and untyped-dependency boundaries, parse `object` into a precise `TypedDict`, dataclass, or discriminated union, and pass the parsed value on. Validators return what they established: required keys, normalized values, defaults, valid variants. For DRF serializers, use the vendored stub's second type parameter, `serializers.Serializer[Instance, ValidatedData]` ([`fixtures/stubs-for-mypy/rest_framework/serializers.pyi:79`](fixtures/stubs-for-mypy/rest_framework/serializers.pyi), tested in [`tests/tools/mypy_helpers/test_typed_validated_data.py`](tests/tools/mypy_helpers/test_typed_validated_data.py)).
- **Keep these representations separate:** raw input, validated data, in-memory serialization, and wire JSON. Keep these distinctions too: missing vs explicit null, create vs partial update, valid empty object vs absent, unsaved/nullable ORM state vs completed state.
- **Known `**kwargs`** become keyword-only parameters, or `**kwargs: Unpack[SomeOptions]`, keeping required-nullable keys (`k: T | None`) distinct from optional ones (`k: NotRequired[T]`). Transparent forwarding uses `ParamSpec`. A wrapper that changes its arguments gets an explicit `Protocol`.
- **Fix the producer, not the consumer.** Don't reparse a value that already has a precise type. Repair receiver types too: a precise return type behind an `Any` receiver checks nothing.
- **Preserve runtime semantics:** coercions, error types, mutation, and aliasing. Never turn `None` into `""`, `0`, `{}`, `"None"`, or a fake timestamp to satisfy a type. Copying a mapping counts as a behavior change.
- **Overrides stay substitutable.** When a subclass's real contract is incompatible with its base (for example a nullable `DecimalField`), change the class design (compose, or subclass the generic `Field[...]` with honest parameters). Don't suppress the override error.
- **JSON values:** if a boundary needs a JSON type, define one `type JSONValue = ...` recursive alias in `src/sentry/utils/json.py` the first time it is needed. Note that PR in the Ledger so later items reuse it.

### Test policy (owner, 2026-11-03)

Full-tree mypy is the proof of a typing change. Tests are proportional to regression risk; they are never an automatic requirement. Most contract repairs, and every removal of unreachable code, ship with no new test (C1/#129702 is the reference).

- **A test must exercise what the PR changes.** A test that would pass both before and after the PR only describes existing behavior, so it does not belong in this PR. That includes tests of code the PR leaves untouched (C1's blank-to-`None` path lives in the unchanged `run_validation`).
- **Add a test only when:**
  - the PR changes runtime behavior, so the test must fail before the change;
  - the PR adds a parser, `TypeGuard`, or `TypeIs` (test the false branch and one malformed input);
  - the repair's safety depends on a runtime fact the types don't show, and no existing test covers it.
- **Search existing coverage before adding anything,** including integration and endpoint tests. Search both the dict form and the keyword form (`"resolveAge": ""` and `resolveAge=""`). Missing one form caused the C1 mistake.
- **Don't add:**
  - tests of dependency behavior (DRF parsing, `min_value`, `allow_null`, `required`);
  - smoke or "returns without error" tests;
  - an `assert_type` for every annotation;
  - parametrized grids beyond the cases at risk;
  - cases that duplicate existing coverage.
- **Size:** the smallest test that fails when the changed behavior breaks. That is usually one case, and one parametrized test across sibling classes rather than a file per class.
- **Mutation check:** before committing, break the guarded line, confirm the test fails, then revert. A test that still passes gets deleted.
- **`assert_type`:** only where an `Any` receiver used to erase a precise type (C14, C15). There mypy alone would not notice the precise type decaying back to `Any`, and `assert_type` fails on `Any`.
- **Negative type tests** that expect a mypy diagnostic use the `call_mypy` harness pattern from `tests/tools/mypy_helpers/test_plugin.py`, never an ignore.
- **Location:** extend the test file that mirrors the source module (`tests/AGENTS.md`). Create one only when none exists.
- **The PR description names the existing test** that covers unchanged behavior a reviewer might worry about, instead of adding a new one.

### Delegated (executor decides within the bound, and states the choice in the PR body)

- **Splitting items:** split any item into more PRs to meet Charter 3. Merge two items only if they touch the same function and stay under the size target.
- **`None` vs `[]` and similar semantic questions** (for example C4): settle them by reading the consumers and running a test. If the two values behave differently, keep both states in the type. If proving that would take more than 30 minutes, keep the current runtime value, type it honestly, and record the open question in the Ledger.
- **Stacking:** start every branch from `origin/master`. Stack on another campaign branch only when an unmerged prerequisite makes that unavoidable. Keep stacks at most 2 deep and write `Stacked on #N` in the body.
- **Rebasing drafts:** only on a merge conflict or a CI failure caused by `master` drift.

## Baseline (measured at `1cd41fc29e1`)

- **Full mypy** (`.venv/bin/mypy`, warm cache): green across 8526 files in **17.5 s** wall. Two files take 7.3 s. Full-tree mypy is therefore the per-PR gate.
- **Focused pytest:** `tests/sentry/utils/test_concurrent.py` runs 15 tests in 4.0 s. devservices postgres and redis are up.
- **Sweep counter, full tree:** 44 s. Results by package (top 12):

  | Package                   | cast | Any | other                  |
  | ------------------------- | ---- | --- | ---------------------- |
  | src/sentry/api            | 220  | 188 | 2 ignore, 7 reflection |
  | src/sentry/integrations   | 121  | 155 | 1 ignore               |
  | src/sentry/testutils      | 31   | 536 | 8 reflection           |
  | fixtures/stubs-for-mypy   | 0    | 161 |                        |
  | src/sentry/utils          | 28   | 121 | 4 reflection           |
  | tests/sentry/utils        | 14   | 140 | 1 ignore, 1 reflection |
  | tests/sentry/integrations | 19   | 133 |                        |
  | tests/sentry/seer         | 5    | 124 |                        |
  | src/sentry/interfaces     | 1    | 115 | 1 reflection           |
  | src/sentry/lang           | 2    | 114 |                        |
  | src/social_auth/backends  | 6    | 103 | 3 reflection           |
  | tests/sentry/api          | 28   | 85  | 4 reflection           |

- **Pinned dependency versions:** sentry-relay 0.10.1, google-cloud-storage 2.18.0, selenium 4.16.0, djangorestframework 3.18.2, django-stubs 5.2.9, djangorestframework-stubs 3.16.8.
- **Known red:** none in mypy. Snuba-backed tests (e.g. `tests/sentry/integrations/slack/test_unfurl.py`) need `.venv/bin/devservices up` (`devservices` is not on a non-direnv shell's PATH). After `master` gains a migration, `--reuse-db` fails with `UndefinedColumn`; run once with `--create-db` (about 20 s for one file). No full pytest run has been made, so treat any failure in a test file the PR doesn't touch as pre-existing until it reproduces on `origin/master`.
- **Gotcha:** `.venv` is an editable install pointing at `/Users/josh/dev/sentry/src` (`easy-install.pth`). In a worktree, prefix **both** pytest and mypy with `PYTHONPATH=$PWD/src` (the Django mypy plugin imports `sentry` at runtime), and check once with `python -c 'import sentry; print(sentry.__file__)'`. Never copy `.mypy_cache` from another checkout: a cache built on a different revision produced false errors in C1. A cold full mypy run takes 19 s wall. Create worktrees with `git -c core.hooksPath=/dev/null worktree add ...`; the repo's post-checkout hook otherwise starts devservices and runs migrations.

## Sequence

Branches are named `josh/typing-contracts/<id>-<slug>`. Line numbers were verified at `1cd41fc29e1` and may drift; find symbols by name.

### P0: ground

| ID  | Work                                                                                                                                                                       | Acceptance                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| G1  | Copy the **Appendix** script to `.work/bin/escape_hatches.py`. Make sure `.work/` is in `.git/info/exclude`. Re-run the sweep and update **Status** if `master` has moved. | `python3 -I .work/bin/escape_hatches.py sweep \| tail -1` prints the TOTAL line |

### Phase 1: behavior regressions and latent bugs (each its own `fix(...)` PR, with a test that fails before the fix)

| ID  | Files                                                        | Work                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | `src/sentry/integrations/slack/unfurl/dashboards.py:153,250` | #129614 added `assert widget.widget_type is not None`. The model allows null (`src/sentry/models/dashboard_widget.py`), and before #129614 a null type fell through to the missing-config skip. Restore the skip with explicit narrowing. Test: a null-type widget among valid unfurls is skipped and the rest still unfurl.                |
| B2  | `src/sentry/utils/concurrent.py:270` (`FutureSet`)           | `__init__` iterates its `Iterable` argument twice, so a generator loses the aggregate completion callback. Materialize the argument once into a stable snapshot. Iterating the live pending set is unsafe because callbacks fire synchronously. Test: a generator input fires the callback.                                                 |
| B3  | `src/sentry/api/endpoints/organization_stats_summary.py:174` | `_generate_csv` returns `str \| None`. With no projects the `cast(str, ...)` hides `None`, and Django writes the literal body `None` into the downloaded CSV (it does not raise). Remove the cast and produce a real empty CSV (match the header the non-empty path writes). Test: a download with no projects yields that CSV, not `None`. |

### Phase 2: seed contract repairs (one `ref(...)` PR each unless noted)

| ID         | Files                                                                                                                                                                                                                                                                                                  | Wrong today                                                                                                                                                                  | Repair                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 (pilot) | `src/sentry/api/fields/empty_decimal.py`, `empty_integer.py`, `src/sentry/monitors/validators.py` (`MissedMarginField`)                                                                                                                                                                                | Blank input returns `cast(Decimal/int, None)`.                                                                                                                               | Done in #129702: the cast branch was unreachable (`run_validation` maps `""` first), so the overrides were deleted.                                                                                                              |
| C2         | `src/sentry/integrations/gitlab/issue_sync.py:322-350` + caller                                                                                                                                                                                                                                        | An invalid issue key returns `cast("IssuePayload", None)`.                                                                                                                   | Return `IssuePayload \| None` (or an explicit outcome) and handle it in the caller. Behavior stays the same.                                                                                                                     |
| C3         | `src/sentry/integrations/jira/integration.py:1465`, `jira_server/integration.py:1323`, both clients' assign methods                                                                                                                                                                                    | Unassignment sends `None` disguised as `str`.                                                                                                                                | Make the assignee ID nullable through to the client payload type. Never `"None"` or `""`.                                                                                                                                        |
| C4         | `src/sentry/api/base.py:795` (`StatsMixin._parse_args`)                                                                                                                                                                                                                                                | `environment_id and [environment_id]` produces `None`, cast to `list[int]`.                                                                                                  | Type the absent-filter state truthfully. Settle `None` vs `[]` per **Delegated**.                                                                                                                                                |
| C5         | `src/sentry/utils/samples.py:190` (`load_data`) + callers                                                                                                                                                                                                                                              | The no-sample branch returns `None` while promising a dict.                                                                                                                  | Return a precise sample schema `\| None` and propagate it. Also fix `samples.py:111` (`cast(str, username)`).                                                                                                                    |
| C6         | `src/sentry/api/serializers/models/event.py:640-664`                                                                                                                                                                                                                                                   | `SharedEventSerializer` deletes `context`, `contexts`, `user`, `tags`, `sdk`, `errors`, then casts to the full response type.                                                | Define the shared-event response type without those keys. Do not restore the omitted fields.                                                                                                                                     |
| C7         | `src/sentry/api/serializers/models/pullrequest.py:140-142,217`                                                                                                                                                                                                                                         | Empty author object cast to `Author`; optional URL cast to `str`.                                                                                                            | Make the response type match what is actually produced (author can be empty/absent, URL can be `None`).                                                                                                                          |
| C8         | `src/sentry/api/serializers/models/userreport.py:158`                                                                                                                                                                                                                                                  | `group=None` produces `issue=None`, cast to a dict.                                                                                                                          | Make `issue` nullable in the response type.                                                                                                                                                                                      |
| C9         | `src/sentry/replays/endpoints/project_replay_jobs_delete.py:77`                                                                                                                                                                                                                                        | Four `datetime` values cast into a `TypedDict` that declares `str`.                                                                                                          | Separate the in-memory payload type from the rendered wire type.                                                                                                                                                                 |
| C10        | `src/sentry/api/paginator.py:622,928-933`, `src/sentry/api/endpoints/organization_trace_item_stats.py:118`                                                                                                                                                                                             | A whole page dict is typed as a `Sequence` of rows; a `(dict, count)` pair is typed as a sequence of dicts.                                                                  | Separate the page-payload type from the row type in the paginator's result type. Response shape and metadata stay the same. Check the order_by fix already on `master` rather than #129615's status.                             |
| C11        | `src/sentry/integrations/jira/client.py:171,212`                                                                                                                                                                                                                                                       | Nested JSON is cast to `MappingApiResponse`/`SequenceApiResponse` wrapper classes.                                                                                           | Return parsed transition/project payload types. Headers/status stay on the real envelope.                                                                                                                                        |
| C12        | `src/sentry/snuba/metrics/mqb_query_transformer.py:316,334`, `src/sentry/snuba/metrics/fields/base.py` resolver                                                                                                                                                                                        | `Sequence[int]` project IDs cast to `Sequence[Project]`; the generic fallback reads project attributes.                                                                      | Pass real `Project`s or change the resolver to take the IDs/org it actually needs. Add a test for the fallback path.                                                                                                             |
| C13        | `src/sentry/services/eventstore/snuba/backend.py:536,981`                                                                                                                                                                                                                                              | String event IDs cast to `Sequence[int]`; orderby cast.                                                                                                                      | Give the filter mapping value types per key.                                                                                                                                                                                     |
| C14        | `src/sentry/api/endpoints/organization_events.py:584` (`scoped_dataset: Any`), `_data_fn`, `src/sentry/snuba/rpc_dataset_common.py:564` (`run_table_query`)                                                                                                                                            | The dataset receiver is `Any`; `EventsResponse` is cast to `dict[str, Any]`.                                                                                                 | Introduce a truthful dataset dispatch type (a `Protocol` or per-dataset union) so `EventsResponse`/`EAPResponse` reach consumers. Add an `assert_type` test on the receiver result.                                              |
| C15        | `src/sentry/snuba/rpc_dataset_common.py:1175`, `src/sentry/api/endpoints/organization_events_stats.py:311,325`, `organization_events_timeseries.py` consumers (needs C14)                                                                                                                              | RPC top-events returns `Any`; local `rpc_result: SnubaTSResult` really holds a dict.                                                                                         | Use `-> dict[str, SnubaTSResult]` plus a typed accumulator. Keep the legacy Discover/errors `SnubaTSResult \| dict[str, SnubaTSResult]` union. Delete the false local annotations. `check_if_results_have_data` stays `-> bool`. |
| C16        | `src/sentry/api/serializers/rest_framework/base.py:73-102` (`convert_dict_key_case`)                                                                                                                                                                                                                   | `T -> T` claims key renaming preserves `T`.                                                                                                                                  | Give it an honest transformed domain (for example `JSONValue -> JSONValue`), or explicit schema-to-schema functions at callers.                                                                                                  |
| C17a       | `src/sentry/api/serializers/rest_framework/dashboard.py:465` (`_get_attr`), widget validation                                                                                                                                                                                                          | The fallback picks the result type; validated data is `dict[str, Any]`.                                                                                                      | Validated widget create and partial-update types (keep omitted vs null distinct), and typed field access instead of `_get_attr`.                                                                                                 |
| C17b       | `dashboard.py:1347-1353,1586-1600` (needs C17a)                                                                                                                                                                                                                                                        | `cast(int, ...)` on `None`; `setattr(widget, "widget_type", None)` hides nullable model fields.                                                                              | Use direct assignment with nullable model field types, built from the C17a variants.                                                                                                                                             |
| C18        | `src/sentry/snuba/snuba_query_validator.py:223`                                                                                                                                                                                                                                                        | `validate` returns `dict[str, Any]` after normalizing.                                                                                                                       | Return a typed validated-query type carrying normalized enums and valid variants; update consumers.                                                                                                                              |
| C19        | `src/sentry/utils/types.py:21-163`                                                                                                                                                                                                                                                                     | `Type.test`'s `TypeGuard` checks only `isinstance`, so `DictType` admits `{1: "one"}`; YAML conversion can return a scalar typed as a dict; `cast("T \| None", ...)` at :46. | Make the guard check what it promises (or drop it to `bool`). Return truthful YAML results. Add false-branch tests.                                                                                                              |
| C20a       | `fixtures/stubs-for-mypy/google/cloud/storage/blob.pyi:9`                                                                                                                                                                                                                                              | `updated: datetime`; 2.18.0 returns `None` before metadata loads.                                                                                                            | Use `datetime \| None` and fix the consumers it breaks (narrow where metadata is loaded).                                                                                                                                        |
| C20b       | `fixtures/stubs-for-mypy/selenium/webdriver/support/wait.pyi:17`                                                                                                                                                                                                                                       | `until_not -> T`; 4.16.0 also returns `Literal[True]`.                                                                                                                       | Make the return type `T \| Literal[True]`.                                                                                                                                                                                       |
| C20c       | `fixtures/stubs-for-mypy/sentry_relay/processing.pyi:22`                                                                                                                                                                                                                                               | `split_chunks -> list[str]`; Relay returns structured chunk dicts.                                                                                                           | Read the installed 0.10.1 wheel (`.venv/lib/python3.13/site-packages/sentry_relay/processing.py`) and call it, then write a chunk `TypedDict`.                                                                                   |
| C21        | `src/sentry/testutils/pytest/mocking.py:112-114` (`capture_results`)                                                                                                                                                                                                                                   | Caught exceptions are recorded into a `list[T]`.                                                                                                                             | Use an outcome type of `T \| BaseException` or explicit success/error variants, and update users.                                                                                                                                |
| C22        | `tests/sentry/tasks/test_assemble.py:52` (`_NO_RELEASE`), `tests/snuba/search/test_backend.py:55` (`UNBOUNDED_DATETIME`), `tests/sentry/incidents/serializers/test_workflow_engine_data_condition.py:26`, `tests/snuba/metrics/naming_layer/test_mri.py:16,22`, preprod tests with `cast("int", None)` | Tests hide supported `None`/float inputs.                                                                                                                                    | Widen the producer signatures only along paths that really support the state (not every search backend), then pass real values. One PR per area.                                                                                 |

### Phase 3: sweep

Work packages in descending order of the sweep counter's output. Each PR clears one package subtree, or one module if the subtree is over the size target. It removes every hatch #129614 added there, applying the design rules (`Unpack` for known kwargs, truthful factories and task kwargs, typed accumulators, parsed boundaries). Before opening a PR, check whether its files overlap #129615–#129624 (`gh pr diff <n> --name-only`). If they do, write `Supersedes #N` or `Overlaps #N`. When a package turns out to be only E1/E2/E3 exemptions, record that in the Ledger instead of opening a PR.

### Phase 4: close

Run `review` on the combined campaign diff (all campaign branches merged into a scratch branch under `.work/wt/close`). Fix P1/P2 findings in new drafts. Close every Ledger row and write the final **Status**.

### Parallelism

One writer through C1, the pilot, so the PR template and loop are proven once. After that, up to 3 lanes in `.work/wt/<id>`, but only between items whose owned files are disjoint. C14→C15 and C17a→C17b are serial. C3 and C11 share Jira files and are serial. Phase 3 lanes take disjoint package prefixes. Lanes share one postgres, and `--reuse-db` test databases collide, so only one lane runs pytest at a time: hold `mkdir /Users/josh/dev/sentry/.work/pytest.lock` (retry until it succeeds) for the length of the run, then `rmdir` it. Lane and worktree mechanics follow `orchestrate`'s worktree lifecycle. Run the parent steering checkpoint after each accepted slice: update **Status** and the Ledger, and re-plan if an assumption changed.

## Acceptance

### Per PR (all must pass on the branch before `gh pr create --draft`)

```bash
.venv/bin/mypy                                                    # full tree, green
python3 -I .work/bin/escape_hatches.py diff origin/master          # every FAIL listed under "Escape hatches kept"
.venv/bin/pytest -n3 --reuse-db <focused test files>               # green
.venv/bin/prek run -q --files <changed files>                      # green
```

- The target hatches for the item are gone: `escape_hatches.py sweep <file>` shows no remaining count for the repaired symbols.
- Tests follow **Decisions → Test policy**: every added test fails when the code it guards is broken.
- Items that change a serializer response type (C6–C10, and any sweep PR that does): `make validate-api-docs` and `.venv/bin/pytest --reuse-db tests/apidocs` are green. This loop has not been timed yet; record its time in **Baseline** the first time it runs.
- The PR body follows the template below.
- After pushing, `gh pr checks <n>` ends green, or the failure is shown to reproduce on `origin/master` and is noted in the PR body.

### PR body template

Write it with the repo's `pr-writer` skill: a short reviewer cover note with no `Summary`/`Test Plan` sections and no pasted commands. It must still cover, in prose:

- **The contract:** what the type claimed, what runtime actually does, and the new type.
- **Behavior change:** a bold `**Behavior change:**` line in every PR, saying `none` or exactly what changes at runtime, for which inputs, and which test pins it.
- **Escape hatches kept:** a bold `**Escape hatches kept:**` line whenever the counter printed a `FAIL`, giving each one's category (E1/E2/E3) or, for a cast, the stated invariant. Omit it when there are none.
- **Supersedes #N / Overlaps #N / Stacked on #N:** when any applies.

#129702 is the reference example.

### Campaign done

- `python3 -I .work/bin/escape_hatches.py sweep` reports a TOTAL where every remaining count appears as an exemption in the Ledger.
- Full mypy is green on a scratch merge of all campaign branches.
- Every **Ledger** row is `merged`, `parked`, `exempt`, or `n/a`.
- A Phase 4 `review` has no open P1/P2 findings.

The campaign is not "fully repaired" while any Ledger row is `todo` or `draft`, or is `parked` without a recorded cause.

## Needs environment

- **Downstream typing (getsentry):** a contract change to a public Sentry symbol can break getsentry's mypy. If a getsentry checkout exists at `~/dev/getsentry`, run its mypy against the campaign branch for items that change exported signatures (C1, C10, C14, C15, C18, C21). Otherwise list them in the PR body as "getsentry not checked".
- **Full pytest suite:** never run locally without a specific reason. CI on each draft covers selected tests.

## Execution boundary and non-goals

- **Authorized:** local edits and commits; pushing `josh/typing-contracts/*` branches; opening and updating campaign draft PRs; reading any PR or issue with `gh`.
- **Forbidden:** pushing to `master` or to any other branch, especially the #129615–#129624 branches; marking a PR ready; requesting review; commenting on, labeling, or closing any PR; editing CI workflows; migrations; frontend changes; changing mypy settings in `pyproject.toml` (including `warn_return_any`).
- **Non-goals:** escape hatches that existed before #129614, unless a repair has to go through them; rewriting the followups; and runtime refactors that don't improve a contract.
- **Contract changes to surface to the owner:** each PR that changes a public signature, a serializer response type, or a stub says so under **Contract**. A response-type change that alters the generated OpenAPI spec is a public API contract change, so its PR body says so in **Behavior change**.

## Audit

This section inlines the owner's audit of #129614 (2,474-file diff; checked against `7a6446c9b5e`, re-verified at `1cd41fc29e1`). The audit summarized 45 detailed finding records. Only that summary reached this campaign, so the findings below are the complete known set. Anything else the records held is found by the Phase 3 sweep, which covers every file #129614 touched.

### What the audit established

- The criticism is right in substance. Some casts are only unnecessary, but others promise values, classes, or response fields the code never produces. The followups #129615–#129624 explain why some behavior fixes were split out. They do not make the remaining contracts sound, and several of them still use casts or `Any`.
- `**kwargs: object` is safer than `**kwargs: Any`, but neither states a known keyword schema. Known options take `Unpack[TypedDict]` or keyword-only parameters.
- Banning the spelling `cast` is not enough. With an `Any` producer, a plain annotation such as `rpc_result: SnubaTSResult = ...` can be just as false.
- An annotation is unsound even when it caused no new runtime failure. Most findings below keep the runtime behavior that predates #129614 and add a false type on top.
- The audit did not run full mypy or pytest; its isolated probes are not integration results.

Finding classes used below: **FC** false contract, **LI** lost inference (types already exist and an escape hatch drops them), **BR** behavior regression from #129614, **LB** latent bug, **ST** stub stronger than the pinned dependency, **TD** test hides a supported state, **NB** examined and not a bug (change the type only).

| ID  | Location                                                                          | Finding                                                                                                                                                                                                     | Class | Item                                            |
| --- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------- |
| A01 | `src/sentry/api/endpoints/organization_events.py` `_data_fn`                      | A typed `DatasetQuery` result (`EventsResponse`) is cast to `dict[str, Any]`.                                                                                                                               | LI    | C14                                             |
| A02 | `organization_events.py:584` (`scoped_dataset: Any`), `rpc_dataset_common.py:564` | RPC table-query paths lose their method signatures through an `Any` receiver, so `run_table_query`'s `EAPResponse` checks nothing.                                                                          | LI    | C14                                             |
| A03 | `src/sentry/snuba/rpc_dataset_common.py:1175`                                     | `run_top_events_timeseries_query -> Any` builds `{}` or a dict of `SnubaTSResult`. Type both the return value and the accumulator.                                                                          | LI    | C15                                             |
| A04 | `organization_events_timeseries.py` consumers                                     | The cast to `SnubaTSResult \| dict[str, SnubaTSResult]` is unchecked and broader than needed, but it is not a false runtime shape.                                                                          | LI    | C15                                             |
| A05 | `src/sentry/snuba/discover.py` `top_events_timeseries`                            | The legacy Discover/errors paths really do return the union. Do not narrow them to dict-only.                                                                                                               | NB    | C15                                             |
| A06 | `organization_events_stats.py:311,325`                                            | `rpc_result: SnubaTSResult` receives a dict, and `top_events_result: SnubaTSResult` can receive one. `Any` lets both annotations through.                                                                   | FC    | C15                                             |
| A07 | `organization_events_stats.py:107` (`check_if_results_have_data`)                 | A content predicate: either representation can be empty or non-empty. Keep it `-> bool`; never make it a type guard.                                                                                        | NB    | C15                                             |
| A08 | `src/sentry/api/fields/empty_decimal.py`, `empty_integer.py`                      | Blank input returns `cast(Decimal/int, None)`.                                                                                                                                                              | FC    | C1                                              |
| A09 | `src/sentry/integrations/gitlab/issue_sync.py:346`                                | An invalid issue key returns `cast("IssuePayload", None)`.                                                                                                                                                  | FC    | C2                                              |
| A10 | `jira/integration.py:1465`, `jira_server/integration.py:1323`                     | Ordinary unassignment sends `None` disguised as `str`. An assert or `"None"` would break valid behavior.                                                                                                    | FC    | C3                                              |
| A11 | `src/sentry/api/base.py:795`                                                      | With no environment, `environment_id and [environment_id]` is `None`, cast to `list[int]`.                                                                                                                  | FC    | C4                                              |
| A12 | `src/sentry/utils/samples.py:190`                                                 | The no-sample branch returns `None` while promising a dict.                                                                                                                                                 | FC    | C5                                              |
| A13 | `src/sentry/api/serializers/models/event.py:640`                                  | `SharedEventSerializer` deletes six keys, then claims the full response type, in which they are required.                                                                                                   | FC    | C6                                              |
| A14 | `src/sentry/api/serializers/models/pullrequest.py:140-142`                        | An empty author object is cast to a populated `Author`, and an optional URL to `str`.                                                                                                                       | FC    | C7                                              |
| A15 | `src/sentry/api/serializers/models/userreport.py:158`                             | `group=None` produces `issue=None`, which is claimed to be a dict.                                                                                                                                          | FC    | C8                                              |
| A16 | `src/sentry/replays/endpoints/project_replay_jobs_delete.py:77`                   | Four `datetime` values are cast into a `TypedDict` that declares `str`.                                                                                                                                     | FC    | C9                                              |
| A17 | `src/sentry/api/paginator.py:622,928-933`                                         | A whole page dict is advertised as a `Sequence` of rows.                                                                                                                                                    | FC    | C10                                             |
| A18 | `src/sentry/api/endpoints/organization_trace_item_stats.py:118`                   | `(dict, count)` is advertised as a sequence of dicts.                                                                                                                                                       | FC    | C10                                             |
| A19 | `src/sentry/api/paginator.py` order_by typo                                       | Already corrected on `master` even though its PR (#129615) is open. Check the code, not the PR status.                                                                                                      | NB    | C10                                             |
| A20 | `src/sentry/integrations/jira/client.py:171,212`                                  | Plain nested JSON is cast to the HTTP wrapper classes `MappingApiResponse`/`SequenceApiResponse`.                                                                                                           | FC    | C11                                             |
| A21 | `src/sentry/snuba/metrics/mqb_query_transformer.py:316,334`                       | `Sequence[int]` project IDs are cast to `Sequence[Project]`. The resolver's generic fallback (`metrics/fields/base.py`) reads project attributes, although known-entity branches return before reaching it. | FC    | C12                                             |
| A22 | `src/sentry/services/eventstore/snuba/backend.py:536`                             | String event IDs are cast to `Sequence[int]`. The filter mapping needs value types per key.                                                                                                                 | FC    | C13                                             |
| A23 | `src/sentry/api/serializers/rest_framework/base.py:73`                            | `convert_dict_key_case(obj: T) -> T` renames keys, so a `TypedDict` requiring `snake_key` comes back as `snakeKey`.                                                                                         | FC    | C16                                             |
| A24 | `src/sentry/api/serializers/rest_framework/dashboard.py:465`                      | In `_get_attr(..., empty_value: T) -> T`, the fallback picks the claimed type of `Any` data.                                                                                                                | FC    | C17a                                            |
| A25 | `dashboard.py:1347-1353,1586-1600`                                                | `None` is cast to `int`, and `setattr(widget, "widget_type", None)` hides model fields that are nullable.                                                                                                   | FC    | C17b                                            |
| A26 | `src/sentry/snuba/snuba_query_validator.py:223`                                   | `validate` normalizes fields and checks query/event-type combinations, then returns `dict[str, Any]`.                                                                                                       | LI    | C18                                             |
| A27 | `src/sentry/utils/types.py:51,126`                                                | `Type.test`'s `TypeGuard` checks only `isinstance`, while `DictType` promises `str` keys: `{1: "one"}` passes. YAML conversion can return a scalar typed as a dict.                                         | FC    | C19                                             |
| A28 | `fixtures/stubs-for-mypy/google/cloud/storage/blob.pyi:9`                         | `updated: datetime`, but GCS 2.18.0 returns `None` before metadata is loaded.                                                                                                                               | ST    | C20a                                            |
| A29 | `fixtures/stubs-for-mypy/selenium/webdriver/support/wait.pyi:17`                  | `until_not -> T`, but Selenium 4.16.0 also returns `Literal[True]` on an ignored exception.                                                                                                                 | ST    | C20b                                            |
| A30 | `fixtures/stubs-for-mypy/sentry_relay/processing.pyi:22`                          | `split_chunks -> list[str]`, but Relay's own tests receive structured chunk dicts. Verify against the installed wheel.                                                                                      | ST    | C20c                                            |
| A31 | `src/sentry/testutils/pytest/mocking.py:112-114`                                  | `capture_results` records caught exceptions into an accumulator typed as holding only `T`.                                                                                                                  | FC    | C21                                             |
| A32 | `tests/sentry/tasks/test_assemble.py:52`                                          | `_NO_RELEASE = cast(str, None)` hides supported artifact assembly without a release.                                                                                                                        | TD    | C22                                             |
| A33 | `tests/snuba/search/test_backend.py:55`                                           | `UNBOUNDED_DATETIME = cast("datetime", None)` hides supported unbounded searches. Widen only the paths that support them.                                                                                   | TD    | C22                                             |
| A34 | `tests/sentry/incidents/serializers/test_workflow_engine_data_condition.py:26`    | `_float_comparison` returns a float typed as a union that excludes floats.                                                                                                                                  | TD    | C22                                             |
| A35 | `src/sentry/integrations/slack/unfurl/dashboards.py:153,250`                      | The added `assert widget.widget_type is not None` turns the null-type skip into a crash.                                                                                                                    | BR    | B1                                              |
| A36 | `src/sentry/utils/concurrent.py:270`                                              | The `FutureSet(Iterable)` annotation admits generators, but the constructor iterates its argument twice, so a generator gets no completion callback.                                                        | LB    | B2                                              |
| A37 | `src/sentry/api/endpoints/organization_stats_summary.py:174`                      | A `str \| None` CSV is cast to `str`. Django writes `b"None"` rather than raising.                                                                                                                          | NB/LB | B3                                              |
| A38 | #129616 (msteams)                                                                 | The followup still casts the Teams result while changing `.get("id")` to `["id"]`.                                                                                                                          | FC    | P3 `src/sentry/integrations`; supersede #129616 |
| A39 | #129620 (releases artifacts)                                                      | The followup casts the artifact schema after checking only the outer shape.                                                                                                                                 | FC    | P3 `src/sentry/api`; supersede #129620          |
| A40 | #129624 (projects allowed domains)                                                | The followup still uses `Any`/`list[Any]`.                                                                                                                                                                  | LI    | P3 `src/sentry/api`; supersede #129624          |
| A41 | Sweep-wide patterns named by the audit                                            | Known `**kwargs` typed as `object`/`Any`, untruthful factories and task kwargs, normalized argument defaults, metrics parameter schemas.                                                                    | LI    | P3 (every package)                              |

Also from the audit: some suspicious fallthroughs are already constrained by earlier validation, and some assertions reflect real internal invariants. Before treating either as a bug, read the producer.

## Ledger

Statuses: `todo`, `draft #N`, `merged #N`, `parked: <cause>; retry when <condition>`, `exempt: <category>` (sweep packages only), `n/a: <reason>`. Every row is updated in place, and the campaign is done only when no row is `todo` or `draft`.

### Items

| ID    | Status        | Notes                                                                                                                                   |
| ----- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| G1    | todo          |                                                                                                                                         |
| B1    | draft #129704 | Explicit skip; `build_widget_timeseries_params` raises its `ValueError` again. One test, sharing the unsupported-type skip test's body. |
| B2    | todo          |                                                                                                                                         |
| B3    | todo          |                                                                                                                                         |
| C1    | draft #129702 | Overrides deleted; `MissedMarginField` typed; no new tests (covered by `test_resolve_age` and mypy).                                    |
| C2    | todo          |                                                                                                                                         |
| C3    | todo          |                                                                                                                                         |
| C4    | todo          |                                                                                                                                         |
| C5    | todo          |                                                                                                                                         |
| C6    | todo          |                                                                                                                                         |
| C7    | todo          |                                                                                                                                         |
| C8    | todo          |                                                                                                                                         |
| C9    | todo          |                                                                                                                                         |
| C10   | todo          |                                                                                                                                         |
| C11   | todo          |                                                                                                                                         |
| C12   | todo          |                                                                                                                                         |
| C13   | todo          |                                                                                                                                         |
| C14   | todo          |                                                                                                                                         |
| C15   | todo          |                                                                                                                                         |
| C16   | todo          |                                                                                                                                         |
| C17a  | todo          |                                                                                                                                         |
| C17b  | todo          |                                                                                                                                         |
| C18   | todo          |                                                                                                                                         |
| C19   | todo          |                                                                                                                                         |
| C20a  | todo          |                                                                                                                                         |
| C20b  | todo          |                                                                                                                                         |
| C20c  | todo          |                                                                                                                                         |
| C21   | todo          |                                                                                                                                         |
| C22   | todo          |                                                                                                                                         |
| Close | todo          | Phase 4 review                                                                                                                          |

### Discovered during the campaign

Record findings here that come up mid-campaign and need their own work (Charter 6, delegated open questions, getsentry breakage), each with an ID `D<n>`, location, finding, and status.

| ID  | Location | Finding | Status |
| --- | -------- | ------- | ------ |

### Sweep packages (Phase 3)

The counts are hatches #129614 added that remain, measured on `master` plus open campaign drafts on 2026-11-03. Refresh a row with `escape_hatches.py sweep <package>/` when its PR opens. A package that a Phase 2 item partly covers still needs its own row closed.

| Package                          | cast | Any | ignore | reflection | Status |
| -------------------------------- | ---- | --- | ------ | ---------- | ------ |
| `src/sentry/testutils`           | 31   | 536 | 0      | 8          | todo   |
| `src/sentry/api`                 | 218  | 188 | 2      | 7          | todo   |
| `src/sentry/integrations`        | 121  | 155 | 1      | 0          | todo   |
| `fixtures/stubs-for-mypy`        | 0    | 161 | 0      | 0          | todo   |
| `tests/sentry/utils`             | 14   | 140 | 1      | 1          | todo   |
| `src/sentry/utils`               | 28   | 121 | 0      | 4          | todo   |
| `tests/sentry/integrations`      | 19   | 133 | 0      | 0          | todo   |
| `tests/sentry/seer`              | 5    | 124 | 0      | 0          | todo   |
| `src/sentry/interfaces`          | 1    | 115 | 0      | 1          | todo   |
| `tests/sentry/api`               | 28   | 85  | 0      | 4          | todo   |
| `src/sentry/lang`                | 2    | 114 | 0      | 0          | todo   |
| `src/social_auth/backends`       | 6    | 103 | 0      | 3          | todo   |
| `src/sentry/db`                  | 14   | 90  | 7      | 0          | todo   |
| `tests/sentry/tasks`             | 46   | 58  | 0      | 0          | todo   |
| `tests/snuba/api`                | 0    | 95  | 0      | 0          | todo   |
| `tests/sentry/preprod`           | 25   | 68  | 0      | 0          | todo   |
| `src/sentry/models`              | 33   | 44  | 0      | 5          | todo   |
| `src/sentry/monitors`            | 17   | 53  | 0      | 2          | todo   |
| `src/sentry/snuba`               | 30   | 37  | 0      | 0          | todo   |
| `src/sentry/sentry_apps`         | 7    | 52  | 0      | 0          | todo   |
| `src/sentry/tagstore`            | 19   | 39  | 0      | 0          | todo   |
| `src/sentry/search`              | 24   | 27  | 1      | 1          | todo   |
| `tests/sentry/middleware`        | 3    | 47  | 1      | 0          | todo   |
| `src/sentry/seer`                | 5    | 44  | 0      | 0          | todo   |
| `tests/sentry/profiles`          | 12   | 37  | 0      | 0          | todo   |
| `fixtures/integrations`          | 4    | 34  | 0      | 0          | todo   |
| `src/sentry/grouping`            | 4    | 34  | 0      | 0          | todo   |
| `src/sentry/replays`             | 12   | 26  | 0      | 0          | todo   |
| `src/sentry/discover`            | 12   | 24  | 0      | 0          | todo   |
| `src/sentry/identity`            | 28   | 7   | 0      | 0          | todo   |
| `tests/sentry/spans`             | 23   | 6   | 0      | 0          | todo   |
| `src/sentry/tasks`               | 6    | 22  | 0      | 0          | todo   |
| `src/social_auth`                | 6    | 21  | 0      | 1          | todo   |
| `src/sentry/apidocs`             | 17   | 9   | 0      | 0          | todo   |
| `src/sentry/tsdb`                | 21   | 5   | 0      | 0          | todo   |
| `src/sentry/uptime`              | 5    | 21  | 0      | 0          | todo   |
| `src/sentry/issues`              | 18   | 7   | 0      | 0          | todo   |
| `tests/sentry/auth`              | 16   | 6   | 0      | 3          | todo   |
| `src/sentry/core`                | 18   | 2   | 0      | 4          | todo   |
| `tests/sentry/search`            | 0    | 24  | 0      | 0          | todo   |
| `src/sentry/backup`              | 3    | 19  | 0      | 0          | todo   |
| `tests/relay_integration`        | 0    | 21  | 0      | 0          | todo   |
| `tests/sentry/core`              | 2    | 19  | 0      | 0          | todo   |
| `src/sentry/releases`            | 3    | 16  | 0      | 1          | todo   |
| `src/sentry/services`            | 11   | 9   | 0      | 0          | todo   |
| `src/sentry/web`                 | 4    | 12  | 0      | 2          | todo   |
| `tests/sentry/identity`          | 2    | 15  | 0      | 0          | todo   |
| `tests/sentry/notifications`     | 7    | 8   | 0      | 2          | todo   |
| `tests/sentry/uptime`            | 4    | 13  | 0      | 0          | todo   |
| `tests/sentry/web`               | 3    | 11  | 0      | 3          | todo   |
| `src/sentry/similarity`          | 16   | 0   | 0      | 0          | todo   |
| `tests/sentry/issues`            | 7    | 9   | 0      | 0          | todo   |
| `tests/sentry/monitors`          | 0    | 16  | 0      | 0          | todo   |
| `tests/snuba`                    | 8    | 8   | 0      | 0          | todo   |
| `tests/sentry/migrations`        | 0    | 15  | 0      | 0          | todo   |
| `tests/sentry/services`          | 11   | 4   | 0      | 0          | todo   |
| `tests/snuba/search`             | 10   | 5   | 0      | 0          | todo   |
| `tests/snuba/tasks`              | 0    | 15  | 0      | 0          | todo   |
| `src/sentry`                     | 12   | 0   | 0      | 2          | todo   |
| `src/sentry/management`          | 12   | 2   | 0      | 0          | todo   |
| `src/sentry/net`                 | 1    | 13  | 0      | 0          | todo   |
| `tests/sentry/buffer`            | 1    | 12  | 0      | 0          | todo   |
| `tests/sentry/dashboards`        | 0    | 12  | 0      | 0          | todo   |
| `src/sentry/explore`             | 10   | 1   | 0      | 0          | todo   |
| `src/sentry/plugins`             | 1    | 9   | 0      | 0          | todo   |
| `src/sentry/relay`               | 6    | 4   | 0      | 0          | todo   |
| `src/sentry/shared_integrations` | 2    | 8   | 0      | 0          | todo   |
| `tests/sentry/incidents`         | 9    | 0   | 0      | 1          | todo   |
| `tests/sentry/investigations`    | 8    | 2   | 0      | 0          | todo   |
| `tests/sentry/rules`             | 6    | 4   | 0      | 0          | todo   |
| `tests/sentry/event_manager`     | 2    | 7   | 0      | 0          | todo   |
| `tests/sentry/features`          | 3    | 6   | 0      | 0          | todo   |
| `tests/symbolicator`             | 8    | 1   | 0      | 0          | todo   |
| `src/bitfield`                   | 3    | 5   | 0      | 0          | todo   |
| `src/sentry/release_health`      | 8    | 0   | 0      | 0          | todo   |
| `src/sentry/toolbar`             | 0    | 8   | 0      | 0          | todo   |
| `tests/sentry/dynamic_sampling`  | 4    | 4   | 0      | 0          | todo   |
| `tests/sentry/models`            | 3    | 4   | 0      | 1          | todo   |
| `tests/snuba/sessions`           | 0    | 8   | 0      | 0          | todo   |
| `fixtures/sudo_testutils.py`     | 1    | 6   | 0      | 0          | todo   |
| `src/sentry/attachments`         | 6    | 1   | 0      | 0          | todo   |
| `src/sentry/flags`               | 5    | 2   | 0      | 0          | todo   |
| `src/sentry/incidents`           | 1    | 4   | 0      | 2          | todo   |
| `src/sentry/notebooks`           | 3    | 4   | 0      | 0          | todo   |
| `src/sentry/receivers`           | 2    | 5   | 0      | 0          | todo   |
| `tests/sentry/issue_detection`   | 7    | 0   | 0      | 0          | todo   |
| `tests/sentry/sudo`              | 3    | 0   | 0      | 4          | todo   |
| `src/sentry/new_migrations`      | 3    | 2   | 0      | 1          | todo   |
| `src/sentry/notifications`       | 5    | 1   | 0      | 0          | todo   |
| `tests/sentry/apidocs`           | 3    | 3   | 0      | 0          | todo   |
| `tests/sentry/sentry_apps`       | 2    | 4   | 0      | 0          | todo   |
| `fixtures/page_objects`          | 1    | 4   | 0      | 0          | todo   |
| `src/sentry/stacktraces`         | 0    | 5   | 0      | 0          | todo   |
| `src/sentry/users`               | 5    | 0   | 0      | 0          | todo   |
| `src/sentry/workflow_engine`     | 3    | 0   | 0      | 2          | todo   |
| `tests/relay_integration/lang`   | 0    | 5   | 0      | 0          | todo   |
| `tests/sentry/db`                | 3    | 2   | 0      | 0          | todo   |
| `fixtures/sdk_crash_detection`   | 0    | 4   | 0      | 0          | todo   |
| `src/sentry/hybridcloud`         | 2    | 0   | 0      | 2          | todo   |
| `src/sentry/ingest`              | 1    | 3   | 0      | 0          | todo   |
| `src/sentry/options`             | 2    | 2   | 0      | 0          | todo   |
| `src/sentry/profiles`            | 4    | 0   | 0      | 0          | todo   |
| `src/sentry/spans`               | 2    | 2   | 0      | 0          | todo   |
| `tests/acceptance`               | 1    | 1   | 0      | 2          | todo   |
| `tests/apigw`                    | 2    | 2   | 0      | 0          | todo   |
| `tests/sentry/lang`              | 0    | 4   | 0      | 0          | todo   |
| `tests/sentry/processing_errors` | 1    | 3   | 0      | 0          | todo   |
| `tests/sentry/replays`           | 2    | 2   | 0      | 0          | todo   |
| `tests/sentry/scm`               | 0    | 4   | 0      | 0          | todo   |
| `tests/sentry/snuba`             | 1    | 3   | 0      | 0          | todo   |
| `src/apigw`                      | 2    | 1   | 0      | 0          | todo   |
| `src/sentry/auth`                | 2    | 1   | 0      | 0          | todo   |
| `src/sentry/cache`               | 2    | 1   | 0      | 0          | todo   |
| `src/sentry/dashboards`          | 3    | 0   | 0      | 0          | todo   |
| `src/sentry/investigations`      | 2    | 1   | 0      | 0          | todo   |
| `src/sentry/metrics`             | 3    | 0   | 0      | 0          | todo   |
| `src/sentry/templatetags`        | 1    | 0   | 0      | 2          | todo   |
| `tests/sentry/feedback`          | 3    | 0   | 0      | 0          | todo   |
| `tests/sentry/hybridcloud`       | 1    | 1   | 0      | 1          | todo   |
| `tests/sentry/options`           | 2    | 1   | 0      | 0          | todo   |
| `tests/sentry/release_health`    | 0    | 3   | 0      | 0          | todo   |
| `tests/sentry`                   | 0    | 1   | 0      | 2          | todo   |
| `src/sentry/data_export`         | 1    | 1   | 0      | 0          | todo   |
| `src/sentry/digests`             | 2    | 0   | 0      | 0          | todo   |
| `src/sentry/loader`              | 2    | 0   | 0      | 0          | todo   |
| `src/sentry/logging`             | 0    | 2   | 0      | 0          | todo   |
| `src/sentry/middleware`          | 0    | 0   | 0      | 2          | todo   |
| `src/sentry/preprod`             | 2    | 0   | 0      | 0          | todo   |
| `src/sentry/silo`                | 1    | 1   | 0      | 0          | todo   |
| `tests/sentry/eventstream`       | 2    | 0   | 0      | 0          | todo   |
| `tests/sentry/explore`           | 0    | 2   | 0      | 0          | todo   |
| `tests/sentry/ingest`            | 0    | 2   | 0      | 0          | todo   |
| `tests/sentry/mail`              | 1    | 1   | 0      | 0          | todo   |
| `tests/sentry/metrics`           | 0    | 0   | 0      | 2          | todo   |
| `tests/sentry/pipeline`          | 0    | 2   | 0      | 0          | todo   |
| `tests/sentry/relocation`        | 2    | 0   | 0      | 0          | todo   |
| `tests/sentry/sentry_metrics`    | 2    | 0   | 0      | 0          | todo   |
| `tests/sentry/tagstore`          | 0    | 2   | 0      | 0          | todo   |
| `tests/sentry/workflow_engine`   | 0    | 2   | 0      | 0          | todo   |
| `tests/snuba/tsdb`               | 0    | 2   | 0      | 0          | todo   |
| `src/apigw/views`                | 1    | 0   | 0      | 0          | todo   |
| `src/sentry/adoption`            | 1    | 0   | 0      | 0          | todo   |
| `src/sentry/assistant`           | 0    | 1   | 0      | 0          | todo   |
| `src/sentry/conf`                | 0    | 1   | 0      | 0          | todo   |
| `src/sentry/dynamic_sampling`    | 1    | 0   | 0      | 0          | todo   |
| `src/sentry/feedback`            | 0    | 1   | 0      | 0          | todo   |
| `src/sentry/mail`                | 1    | 0   | 0      | 0          | todo   |
| `src/sentry/projectoptions`      | 0    | 1   | 0      | 0          | todo   |
| `src/sentry/rules`               | 0    | 1   | 0      | 0          | todo   |
| `src/sentry/runner`              | 1    | 0   | 0      | 0          | todo   |
| `tests/apidocs/endpoints`        | 0    | 1   | 0      | 0          | todo   |
| `tests/sentry/analytics`         | 0    | 1   | 0      | 0          | todo   |
| `tests/sentry/debug_files`       | 0    | 0   | 0      | 1          | todo   |
| `tests/sentry/receivers`         | 0    | 1   | 0      | 0          | todo   |
| `tests/sentry/relay`             | 0    | 1   | 0      | 0          | todo   |
| `tests/sentry/releases`          | 0    | 1   | 0      | 0          | todo   |
| `tests/sentry/runner`            | 0    | 1   | 0      | 0          | todo   |
| `tests/sentry/tsdb`              | 1    | 0   | 0      | 0          | todo   |
| `tests/snuba/tagstore`           | 1    | 0   | 0      | 0          | todo   |

## Appendix: `escape_hatches.py`

Counts by AST, resolving `typing`/`typing_extensions` imports and aliases and parsing quoted annotations. `diff [BASE]` compares changed files (renamed files against their old path) with the merge base: it exits 1 when any FATAL category grows, and reports new `src/` asserts and guards as `note`. `sweep [PREFIX]` reports, for files #129614 touched, how many hatches remain above their pre-#129614 counts.

```python
import ast
import io
import subprocess
import sys
import tokenize
import warnings
from collections import Counter, defaultdict

TYPING = {"typing", "typing_extensions"}
FATAL = ("cast", "Any", "type-ignore", "no_type_check", "fixed-name-reflection")
NOTE = ("assert", "TypeGuard/TypeIs")
STRICT_TYPES_COMMIT = "ae29b66fe41a4b1919f69f01a8918c3372a6adf7"


def count(source: str, path: str = "") -> Counter[str]:
    tree = ast.parse(source)
    names: dict[str, str] = {}
    modules: set[str] = set()
    tracked = ("cast", "Any", "no_type_check", "TypeGuard", "TypeIs")
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module in TYPING:
            for alias in node.names:
                if alias.name in tracked:
                    names[alias.asname or alias.name] = alias.name
        elif isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name in TYPING:
                    modules.add(alias.asname or alias.name)

    def kind(node: ast.expr) -> str | None:
        if isinstance(node, ast.Name):
            return names.get(node.id)
        if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
            if node.value.id in modules and node.attr in tracked:
                return node.attr
        return None

    found: Counter[str] = Counter()
    is_test = path.startswith("tests/") or "/tests/" in path or "/testutils/" in path

    def visit(root: ast.AST) -> None:
        for node in ast.walk(root):
            if isinstance(node, ast.Assert) and not is_test:
                found["assert"] += 1
            elif isinstance(node, ast.Call):
                if kind(node.func) == "cast":
                    found["cast"] += 1
                elif (
                    isinstance(node.func, ast.Name)
                    and node.func.id in ("getattr", "setattr")
                    and len(node.args) >= 2
                    and isinstance(node.args[1], ast.Constant)
                    and isinstance(node.args[1].value, str)
                ):
                    found["fixed-name-reflection"] += 1
            elif isinstance(node, (ast.Name, ast.Attribute)):
                match kind(node):
                    case "Any":
                        found["Any"] += 1
                    case "no_type_check":
                        found["no_type_check"] += 1
                    case "TypeGuard" | "TypeIs":
                        found["TypeGuard/TypeIs"] += 1
            elif isinstance(node, ast.Constant) and isinstance(node.value, str) and "Any" in node.value:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    try:
                        visit(ast.parse(node.value, mode="eval"))
                    except (SyntaxError, ValueError):
                        pass

    visit(tree)
    for token in tokenize.generate_tokens(io.StringIO(source).readline):
        if token.type == tokenize.COMMENT and token.string.lstrip("# ").startswith("type: ignore"):
            found["type-ignore"] += 1
    return found


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], text=True)


def at(rev: str | None, path: str) -> Counter[str]:
    if rev is None:
        try:
            with open(path) as f:
                return count(f.read(), path)
        except FileNotFoundError:
            return Counter()
    result = subprocess.run(["git", "show", f"{rev}:{path}"], capture_output=True, text=True)
    return count(result.stdout, path) if result.returncode == 0 else Counter()


def diff(base: str) -> int:
    merge_base = git("merge-base", base, "HEAD").strip()
    status = git("diff", "--name-status", "--find-renames", "--diff-filter=AMR", merge_base, "--", "*.py", "*.pyi")
    worse = False
    for line in status.splitlines():
        old_path, path = line.split("\t")[1], line.split("\t")[-1]
        before, after = at(merge_base, old_path), at(None, path)
        for key in FATAL + NOTE:
            delta = after[key] - before[key]
            if delta:
                fatal = key in FATAL and delta > 0
                worse |= fatal
                tag = "FAIL" if fatal else "note" if delta > 0 else "ok"
                print(f"{tag}\t{path}\t{key}\t{before[key]} -> {after[key]}")
    return 1 if worse else 0


def sweep(prefix: str) -> int:
    paths = git(
        "diff", "--name-only", "--diff-filter=AM", f"{STRICT_TYPES_COMMIT}~1", STRICT_TYPES_COMMIT,
        "--", "*.py", "*.pyi",
    ).split()
    remaining: defaultdict[str, Counter[str]] = defaultdict(Counter)
    for path in paths:
        if not path.startswith(prefix):
            continue
        before, now = at(f"{STRICT_TYPES_COMMIT}~1", path), at(None, path)
        parts = path.split("/")
        package = "/".join(parts[:3] if parts[0] in ("src", "tests") and len(parts) > 3 else parts[:2])
        for key in FATAL:
            excess = now[key] - before[key]
            if excess > 0:
                remaining[package][key] += excess
                if prefix:
                    print(f"{path}\t{key}\t+{excess}")
    total: Counter[str] = Counter()
    for package, counts in sorted(remaining.items(), key=lambda kv: -sum(kv[1].values())):
        total += counts
        print(f"{package}\t" + "\t".join(f"{k}={counts[k]}" for k in FATAL if counts[k]))
    print("TOTAL\t" + "\t".join(f"{k}={total[k]}" for k in FATAL))
    return 1 if total else 0


if __name__ == "__main__":
    command, *rest = sys.argv[1:] or ["diff"]
    if command == "diff":
        sys.exit(diff(rest[0] if rest else "origin/master"))
    if command == "sweep":
        sys.exit(sweep(rest[0] if rest else ""))
    sys.exit(f"usage: {sys.argv[0]} diff [BASE] | sweep [PATH_PREFIX]")
```

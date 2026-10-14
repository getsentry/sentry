# Sentry typing hillclimb

Status: ready to execute, beginning with environment and evaluator bootstrap. No migration baseline or typing promotion has run during planning.

Keep typing work on the existing `typing-hillclimb` branch in this checkout, with one module per commit. The only branch, worktree, push and PR exception is a confirmed bug or soundness fix under the defect procedure below. The goal is to remove genuine Python typing debt while preserving runtime behavior and precise contracts.

Deliver these outcomes, in order:

1. A tested evaluator that rejects incomplete measurements and typing bypasses.
2. Complete owned-source coverage under the existing strong mypy settings, with both migration overrides removed and zero all-strong diagnostics.
3. Precision accounting that includes inferred, imported, and plugin-derived Any. Resolve owned dynamic debt and contain justified external Any at tested boundaries.
4. Permanent local and CI checks that prevent regression, plus a final report of completion or concrete parked blockers.

## Execution charter

- Decide within the bounds below, record consequential calls, and continue until every deliverable passes or all remaining items are parked. Never wait for approval. Give no routine check-ins during execution. Keep findings and phase results in this document.
- Run the hillclimb in this checkout on `typing-hillclimb`. One coordinator owns all writes, tests, generated configuration, and commits. Parallel agents may investigate read-only and propose patches as text. They must not run commands that write caches or modify the checkout. Ordinary typing work has no lane branches or worktrees.
- Launch authorizes local campaign commits. Commit each validated improvement using `type(scope): imperative lowercase subject`, at most 72 subject characters. Put item IDs and reasoning in the body. Do not commit unrelated owner changes. Only confirmed defect fixes may be pushed and opened as draft PRs. Do not deploy, merge to master, or change repository permissions.
- At launch, inspect dirty files. Commit these campaign documents only if their contents match this plan. Leave unrelated changes untouched and park items whose files overlap them. Unexpected branch movement parks integration until its cause is understood. Never reset, stash, or overwrite someone else's work.
- Functional parity and typing completeness precede performance optimization. A truthful dependency-cluster repair is preferable to a misleading annotation that preserves a local score.
- Read the relevant `AGENTS.md`, callers, tests, plugins, and runtime annotation consumers before editing. Do not add code comments except the repository's allowed cases. Code comments never cite this campaign.
- Before writing scratch, ensure `.work/` is in `.git/info/exclude`. Use `.work/tmp` for scratch and set `TMPDIR` to its absolute path. Use separate caches per profile. Durable decisions and results belong here. Commit fixtures and tests where their readers need them. Do not add a supervisor service, database, journal, provenance manifest, or patch hashes.
- Use the existing virtualenv. Provision it through `setup-dev` if necessary, with `SENTRY_DEVENV_FRONTEND_ONLY=1 devenv sync`. Never change locked versions to make the evaluator pass. No new dependencies are authorized.
- Budget one checker process at a time, retaining the configured five internal workers initially. Reserve 8 GiB available memory before a repository checker run and 2 GiB per read-only agent, with 4 GiB host headroom. Start with two investigators if that budget fits, otherwise one or none. Reduce checker workers consistently for both comparison sides if measured peak memory exceeds the budget. Never run parallel database suites against the same services.
- An item gets at most three failed repair attempts for the same blocker. Reproduce, identify the cause, and halve the failing input or dependency set after two failed hypotheses. Park it with the command, cause, next dependency, and retry condition. Retry only when that condition changes. Continue independent work.
- A focused loop exceeding 60 seconds requires a narrower selector or a small fast harness before further edits. A repository checker exceeding 20 minutes or twice its comparable P0 baseline gets a dedicated loop investigation. Fix only a reproduced bottleneck needed to validate the item. Retain final acceptance. Record unrelated defects.
- If a baseline test blocks an item, reproduce it separately and fix it in its own commit only within the authorized contract. Otherwise park dependent work. No accepted state may contain a regression introduced by this campaign.
- Hard stops park the affected item: unavailable private dependencies or services, an unverifiable checker result, an unauthorized runtime contract change, an outside-repository action beyond the defect PR exception, or a missing trustworthy check. A stopped item does not count as completed.

## Decisions

### Owner decisions

- 2026-10-14: absorb the Python typing guide into this document and delete the separate guide.
- 2026-10-14: keep the entire campaign on the current branch. No pull requests. This is a local hillclimb on `typing-hillclimb`.
- 2026-10-14: exception to the preceding decision: confirmed bugs and soundness issues get separate draft PRs through `gh`, branched from latest master. Keep ordinary hillclimb commits to one module each.
- 2026-10-14: use mypy daemon mode to accelerate the iteration loop, after proving correctness against ordinary mypy.

### Prescribed decisions

- Keep a single writer. This supersedes worktree-based campaign mechanics because ordinary typing work must stay on this branch. Defect worktrees are the explicit exception. Parallelize investigation only. Reverse this only with a new owner instruction.
- Use local evaluation as the authority. The existing backend workflow can write configuration on non-master refs and its aggregate permits skipped jobs. No remote checks or credentials are needed for local typing acceptance. Publishing defect PRs requires authenticated Git and gh. P5 edits and validates workflow source locally. It does not trigger remote jobs. Preserve existing CI writer behavior and permissions.
- Preserve application behavior and public input acceptance in typing commits. Internal annotation corrections are allowed when callers prove the contract. Confirmed bugs and soundness issues use separate defect PRs. New product contracts, permission policy, schema changes and data migrations remain parked.
- Bootstrap before promotions. The current generator exits zero and rewrites configuration after a checker failure. Its output cannot authorize adoption until fixed and tested.
- Keep third-party import policy unchanged in derived profiles. First-party files excluded from normal discovery still need an explicit classification and proof. No owned implementation may be hidden behind a new stub.
- Count absolute obligations and coverage, not weaklist line counts or percentages. Deletions, renames, moved errors, and shrinking the denominator earn no typing credit.
- Do not approve new owned Any or new suppressions. External Any may survive only under the boundary policy below. The evaluator cannot infer that approval from an existing annotation.
- Introduce additional strictness as calibrated audits. Do not silently enable every strictness option for the whole repository. Compiler and plugin behavior comes from installed mypy 2.1.0 until a separately authorized upgrade.

### Delegated decisions

The coordinator chooses modules, precise type representations, focused test nodeids, and dependency clusters. Each ordinary commit changes one Python implementation module, its related tests, its weaklist entry and necessary documentation. Metadata promotions also remove one module per commit. Aim for at most 300 changed implementation lines. A larger module may take several independently valid commits. Shared-type clusters must be ordered into valid single-module commits. Only when a reproduced dependency cycle makes that impossible may an atomic commit span the minimum coupled modules. Record that exception and evidence before editing. Never combine unrelated modules. Prefer the smallest truthful contract. Break equal-priority ties by module name.

Allocate approximately 60% of each ten completed items to application leaves or metadata removals, 25% to shared foundations, and 15% to tail investigation. Rebalance only from observed blockers or idle work. These are scheduling defaults, not completion criteria. Tests, fixtures, helpers, and owned tooling are mandatory before terminal completion.

## Baseline and fast loop

Local inspection on 2026-10-14 matches the current `pyproject.toml`: Python 3.13, five mypy workers, local stubs, three plugins, and `files = ["."]`. The virtualenv reports Python 3.13.15 and compiled mypy 2.1.0. Recheck these at launch.

Planning probes executed the real helper functions with controlled subprocess results in scratch. The unsuppressed helper retains the weaklist and plugins. A subprocess exit of 2 with empty stdout makes the generator return 0 and rewrite configuration. The combined probe took 0.018 seconds. No repository configuration was modified.

A separate isolated call to installed mypy's `process_options` and `build` confirmed that `preserve_asts` and `export_types` expose a source AST and inferred expression types. This proves the adapter entry point exists. It does not establish repository-wide coverage or precision completeness with Sentry's plugins.

The installed `.venv/bin/dmypy` also started with the repository's actual configuration and a scratch status, log and cache path. Its status check succeeded and shutdown completed. No daemon was left running. No repository typecheck or warm recheck was run in that startup probe.

These checks passed once, from this checkout:

| Command | Elapsed |
| --- | ---: |
| `.venv/bin/python -m tools.mypy_helpers.check_stronglist pyproject.toml` | 0.151 s |
| `.venv/bin/python -m tools.mypy_helpers.prevent_weaklist_additions pyproject.toml` | 0.105 s |

These are loop observations, not performance claims. `perf-gate-ready` and the subsequent `perf-gate-ready -1` both exited 0. Full configured, unsuppressed, all-strong, precision, and runtime baselines remain unmeasured. There are no established baseline failures beyond the reproduced helper defect. Do not infer a green baseline.

At P0 verify `perf-gate-ready` is available and record each command, exit status, elapsed time, peak memory, selected test count, and failures. If that utility is missing, correctness work may proceed but performance gates remain deferred. Limit initial commands to 60 seconds for focused checks and 20 minutes for a repository profile. Terminate the whole child process group on timeout, mark data invalid, and investigate the cause. A timeout never becomes an accepted partial result.

For ordinary edits, use the narrowest relevant commands:

```sh
.venv/bin/mypy --no-warn-unused-configs src/sentry/path/to/module.py
.venv/bin/pytest --reuse-db tests/path/test_module.py::test_behavior
.venv/bin/python -m tools.mypy_helpers.check_stronglist pyproject.toml
.venv/bin/python -m tools.mypy_helpers.prevent_weaklist_additions pyproject.toml
```

Paths containing `path` above are syntax examples. Before each item, replace them with existing files or nodeids in its brief. The mypy pre-push hook is also available:

```sh
SENTRY_MYPY_PRE_PUSH=1 .venv/bin/prek run -q mypy --files src/sentry/path/to/module.py --stage pre-push
```

Run lint through prek on explicit changed files. Skip `ruff-format`, mutating autofix hooks, and the weaklist sorter when they would violate the no-formatter rule. Use Ruff's read-only `check` through a scratch prek configuration if needed. Preserve all applicable read-only checks. Do not stage files just to discover what needs checking.

### Use the mypy daemon for feedback

P0 establishes daemon feedback before source adoption. Give the coordinator one daemon, using the same virtualenv, warning policy and project configuration. Keep status, logs, sockets and cache under `.work/tmp`. Do not use the daemon for precision reports or final acceptance. Installed dmypy ignores report-generation settings during startup.

```sh
PYTHONWARNINGS=error::RuntimeWarning .venv/bin/dmypy --status-file .work/tmp/dmypy-status.json run --log-file .work/tmp/dmypy.log --timeout 600 -- --config-file pyproject.toml --cache-dir .work/tmp/dmypy-cache --no-warn-unused-configs src/sentry/path/to/module.py
.venv/bin/dmypy --status-file .work/tmp/dmypy-status.json recheck
.venv/bin/dmypy --status-file .work/tmp/dmypy-status.json stop
```

Replace the example path with the exact item module. `run` establishes the target set; use `recheck` only while that set and checker policy remain unchanged. Restart after changes to configuration, plugins, stubs, environment or target set. A derived all-strong daemon is permitted only with a separate status file and cache and the same profile validation as the batch checker. Never reuse state across profiles.

Compare daemon and ordinary mypy diagnostics on the same target and profile before relying on feedback. Exercise an introduced error, its repair, and a changed imported signature. Sentry plugin canaries must also agree. Unknown, stale or divergent output disables daemon feedback for that affected scope until repaired. A crash or timeout invalidates its result. The fallback is the ordinary focused checker, with a loop investigation if it exceeds 60 seconds.

Measure the first run and three warm rechecks separately under the host-readiness policy. Target a warm module feedback loop below 10 seconds. This is a P0 loop target, not an observed speedup or permission to weaken acceptance. If the target cannot be met, identify the limiting work before continuing expensive iteration. Stop the daemon before changing branches, making defect worktrees, cold evaluations or shutdown. Stop or kill its owned process on failures and verify the status no longer refers to a live server. Never stop another user's daemon.

## Sequence

Each row is a coherent work item. Sizes are expected coordinator sessions, not deadlines. A session can continue the next item once its prerequisites pass. Only one item may write at a time. Every phase allows up to two read-only investigators within the memory budget.

| ID | Size | Prerequisites | Owned files | Acceptance |
| --- | --- | --- | --- | --- |
| P0 Ground | 1 | None | This document and scratch only | Recheck environment, existing helper tests, configured mypy, source discovery, and initial runtime test map. Record actual outcomes and timings. Repair or park invalid foundations before promotions. |
| P1 Helpers | 1–2 | P0 environment usable | Existing `tools/mypy_helpers` list, profile, generation and ranking helpers; matching `tests/tools/mypy_helpers` tests | Fail-before/pass-after tests for crash, notes, malformed markers, absent overrides, and zero debt. Existing helper tests pass. Normal valid generation preserves semantics. |
| P2 Evaluator | 2–4 | P1 | New `tools/mypy_helpers/typing_campaign.py`; matching `tests/tools/mypy_helpers/test_typing_campaign.py`; this document | Implement and prove the CLI, profiles, coverage reconciliation, precision checks, and rejection corpus below. Run all four baselines. No promotions before adversarial cases pass. |
| P3 Metadata sweep | 1–2 | P2 | Coordinator-owned `pyproject.toml` and this document | Probe every effectively weak module in full context. Promote one proven clean module per commit. Wildcard removals preserve coverage of still-weak siblings. |
| P4 Adoption | Repeated batches | P3; dependency prerequisites per batch | Assigned Python modules and their tests. Only coordinator updates `pyproject.toml` | Complete whole modules, remove effective weak coverage, pass evaluator and mapped runtime tests. Work shared decorators, serializers, request attributes, ORM shapes and service contracts as clusters. Continue through application code, tests, fixtures and tooling. |
| P5 Hardening | 1–3 plus discovered blockers | All unparked P4 obligations complete | Evaluator, touched plugin and stub tests, `.pre-commit-config.yaml`, `.github/workflows/backend.yml`, this document | Resolve uncovered negative cases. Wire non-mutating checks into local hooks and backend typing CI. Prove a new module, new untyped function, bypass and widened interface each fail. CI configuration parses. Preserve existing job permissions and writer behavior. |
| P6 Optimization | 0–2 | P5 parity and coverage complete | Only measured bottleneck files and their tests | Optional speed work meets the measurement policy below. Drop speculative speed work. No performance tuning may conceal missing coverage or loosen checks. |
| P7 Close | 1 | P6 complete or explicitly skipped | Debt overrides, proven obsolete helper paths and callers, this document | Two cold evaluations agree on all terminal conditions. Run required affected backend suites and final adversarial corpus. Review final diff, fix P1/P2 findings, commit report. No active writer or unrecorded blocker remains. |

P0 may discover work that invalidates its initial test map. Add the new suites before accepting the corresponding item. If P0 cannot run configured mypy, P1's isolated helper repairs may proceed, but source promotions remain blocked.

The full repository checker is justified at P0, each proposed accepted batch, P5, and P7 because shared types can affect reverse dependents outside the edited files. Full runtime testing means the union of affected subsystem suites selected by the procedure below. Do not launch workspace-wide pytest or all CI. Widen only for a specific uncovered integration risk recorded before the run.

## Evaluator contract

P2 creates the following interface. These commands are deliverables, not existing tools:

```sh
.venv/bin/python -m tools.mypy_helpers.typing_campaign baseline --output .work/tmp/baseline
.venv/bin/python -m tools.mypy_helpers.typing_campaign evaluate --parent ACCEPTED_PARENT --output .work/tmp/candidate
.venv/bin/python -m tools.mypy_helpers.typing_campaign guard --parent ACCEPTED_PARENT --output .work/tmp/guard
.venv/bin/python -m tools.mypy_helpers.typing_campaign terminal --output .work/tmp/terminal
```

`ACCEPTED_PARENT` is the concrete Git revision saved immediately before editing. Evaluate the working tree against that committed parent. Only the coordinator can change evaluator policy, in a separate tested infrastructure commit with no adoption credit. Run evaluation without concurrent edits. Commit the exact checked content, confirm no hook changed it, and repeat affected checks if the committed tree differs. Use the evaluator from the last accepted infrastructure revision, loaded from scratch with its own imports, while inspecting candidate files as data. Do not execute candidate evaluator policy to approve that candidate.

Use the standard library and installed dependencies. Separate profile derivation and comparison decisions from subprocess and filesystem effects. Expose three outcomes: complete measurement, rejected candidate, invalid measurement. Exit 0 means a complete baseline measurement for `baseline`, an accepted improvement for `evaluate`, preserved invariants for `guard`, and actual completion for `terminal`. `guard` permits unchanged debt so ordinary commits can use it. Exit 1 means a measured rejection or unmet terminal obligations. Exit 2 means a checker, configuration, environment, timeout, or completeness failure. Preserve the original subprocess status and stderr in the report.

Derive profiles by removing uniquely delimited debt sections from a copy of `pyproject.toml` in `.work/tmp`. Accept absent sections as zero debt. Reject duplicates, unmatched markers, unexpected weakening, and parse failures. Run from the checkout root. Resolve configuration-relative paths to their original absolute locations before relocation, including stub paths. Test that configured and unchanged derived profiles discover identical files and plugins. Never relocate configuration and assume relative paths still work.

| Profile | Change from configured policy | Proof required |
| --- | --- | --- |
| Configured | None | Complete zero-error run for every accepted batch. Use `PYTHONWARNINGS=error::RuntimeWarning .venv/bin/mypy`. |
| Unsuppressed | Remove only generated Sentry error override | Ordinary diagnostics are valid debt data. No note becomes an error. |
| All-strong | Remove both Sentry debt overrides | Existing global checks apply to every owned implementation. No remaining per-module weakening is allowed for owned sources. |
| Precision | All-strong plus calibrated reports and selected extra checks | Calibrate return-Any, untyped calls and decorators, imported Any, generic omissions and plugin-derived Any against real installed mypy. Keep their results separate from core completion. |

Use a parser calibrated against mypy 2.1.0 output, including notes, multiline messages, error codes, filenames and summaries. Treat exit 1 as debt only when an ordinary completed checker run explains it. Exit 2, unexplained stderr, missing completion evidence, plugin crashes, unknown output, truncation and missing sources invalidate measurement. Store raw stdout and stderr under the command's output directory. Do not regenerate lists from invalid data.

Build the coverage inventory from `git ls-files` for `.py` and `.pyi`, then include newly added candidate files. Compare parent and candidate path sets and mypy's actual build graph, including whether each owned body was checked. Use a version-checked adapter around installed `mypy.main.process_options` and `mypy.build.build`. Inspect `BuildResult.graph`, each state's path and effective options, and retained source trees with `preserve_asts=True`. Use `export_types=True` for precision extraction. Run this audit with zero internal workers and no incremental cache until tests prove retained data remains complete with another setting. Keep the ordinary configured checker at its normal worker count. The adapter is pinned to the locked checker and fails on an unsupported interface. Validate extraction against CLI diagnostics and canaries, including an untyped body, skipped import and shadowed implementation. Module names must account for `src/`, packages, namespace packages, and wildcard precedence. Calibrate effective options against mypy itself, not `check_stronglist`'s simplified regex.

Classify every source as owned implementation, owned stub, owned generated implementation, vendored implementation, or non-importable executable. Default unknown files to owned implementation. Audit `bin/`, `self-hosted/`, dot-directories, fixtures and tools explicitly. Check importable omissions in a derived all-strong invocation with explicit paths. Check non-importable executables individually with matching policy. Avoid duplicate module identities. Generated code is repaired through its generator. A `.pyi` selected instead of an owned `.py` cannot count as checking that implementation. A discovery problem is a blocker, never an exclusion to add.

Compare effective weak `(module, option)` and suppressed `(module, code)` pairs over that inventory. Detect source omissions, wildcard broadening, changed disabled codes, new import skips, rename masking, and weakened previously precise signatures. Record each remaining function signature, generic obligation, diagnostic and dynamic interface by path and qualified symbol. Use AST anchors to avoid claiming credit for shifted line numbers. Require every accepted batch to remove at least one real obligation with all-strong errors non-increasing. Combine a foundational repair with its dependent corrections before evaluating when it reveals errors.

Measure explicit Any and source bypasses with AST and token inspection. Measure resolved interfaces, implicit Any, imports and plugin injections through calibrated checker reports or a read-only checker adapter. Any-expression and line reports are evidence, not sufficient proof. Positive and negative type canaries must prove that imported or injected Any is noticed. If precision extraction is incomplete, core work can continue after the non-regression checks are trustworthy, but precision completion must remain blocked.

Reject new ignores, `no_type_check`, erasing casts, `Callable[..., Any]`, broad `dict[str, Any]`, unchecked stubs and widening precise interfaces. Compare typing imports and qualified aliases as well as spelling. Existing sites remain backlog. `object` is allowed only for real opaque inputs narrowed before use. Do not reject legitimate widening required by a proven caller contract automatically. Park that item as a contract decision under the authorization rules.

Generation must reach a fixed point in scratch. After a successful complete unsuppressed run, compute the smallest valid generated debt section and compare a second generation with the first. Run the generator only where `.mypy_cache` and config are disposable. Keep still-suppressed modules weak until P1's tests establish a deliberate replacement for that existing helper invariant.

### Rejection and parity corpus

P1 and P2 add named pytest cases in their owned helper test files. Start each bug fix with a failing case. Preserve valid helper command behavior, output destinations and effective configuration. Deliberately change the invalid behavior of crash acceptance, note counting, malformed-section handling and empty-section failure.

The corpus must cover these independent behaviors:

- Checker success, ordinary diagnostic exit, crash, plugin failure, timeout, stderr failure, truncated output and missing source. A crash or partial run changes neither configuration nor accepted state.
- Error versus note parsing. Ranking counts errors only and prints ascending counts, with filename ties. Update callers if any depend on the old descending display.
- Absent, empty, duplicate and malformed debt sections. Exercise both sections independently and together. Preserve plugins, Python version and external import policy.
- Wildcard expansion, module renames, newly added owned modules, changed error codes, disappearing files and a stub shadowing implementation.
- Inline coded ignores, alias-imported Any and casts, new implicit Any, imported Any, plugin-injected Any and narrowed lying stubs.
- Positive and negative canaries for real request, response, serializer and decorator boundaries. Existing invalid calls must remain rejected. Supported calls must still pass.
- A clean metadata promotion and truthful annotated module must be accepted. A candidate with unchanged debt gets no adoption credit.
- Parent validation must use the supplied parent after the candidate has been committed. Advancing HEAD must not erase the comparison. Interrupting before commit leaves the accepted branch unchanged. Resume rechecks dirty candidate content before committing.

Existing reference tests are in `tests/tools/mypy_helpers/` and `tests/sentry/test_mypy_stronglist.py`. Build the corpus from the current helper implementations, their callers in `.pre-commit-config.yaml` and `.github/workflows/backend.yml`, and the cases above. Keep expected successful behavior and intentional changes visible in test names. Prove rejection by mutating one measured input at a time. Do not normalize away diagnostic codes, policy changes or missing sources.

## Runtime verification and annotation policy

Before editing a batch, list its exact files, caller contracts, runtime annotation consumers and existing pytest nodeids in a short item entry. Map `src/sentry/<subsystem>` to `tests/sentry/<subsystem>` first, then search for imports, class names and function names in tests and direct callers. For tools, start in `tests/tools`. Choose focused nodeids from those matches and record their containing subsystem suites for phase checks. Use `--collect-only` on the selected files to confirm test identities. If no mapping exists, add a runtime contract test before the edit. If a truthful test needs unavailable services or an unresolved contract, park the item. For metadata-only changes, unchanged implementation plus full typing and scope proofs suffices. For annotations, run import smoke under Sentry's configured environment and the existing behavior tests. Annotation-only changes may affect Django, DRF, Pydantic, decorators, imports and introspection.

If no existing test exercises a touched behavior, add the smallest runtime contract test. For plugins or stubs, use paired valid and invalid type canaries and runtime checks against the real dependency where necessary. For a shared contract, add tests from at least one direct consumer and one reverse-dependent subsystem. If that cannot establish compatibility, park the cluster. Do not interpret an empty selection or unexpected skip as success.

At each accepted batch run its focused tests, the independent evaluator, and applicable read-only lint. At phase end run all tests added or changed in that phase, the affected subsystem files, and the helper corpus when helpers or policy changed. At P7 run the union of affected subsystem suites once against the final content. Use existing artifacts and `--reuse-db`. Do not rely on historical coverage alone or use `make test-selective` as the routine local loop.

Use domain types, structural protocols for actual interfaces, `TypedDict` for stable shapes, and generics or `ParamSpec` for relationships. Prefer `Mapping` and `Sequence` for inputs that are only read, and mutable interfaces when mutation is contractual. Type the whole adopted module. New functions must be typed even in weak modules. Keep functional changes out of annotation cleanup.

Use future annotations for forward references when runtime consumers permit them. Move imports under `TYPE_CHECKING` only when runtime introspection does not need them. `TypedDict` cannot be used with `isinstance`. Use a `Literal` discriminator and explicit checks, or a real runtime class when the domain requires one. Mypy also catches contradictions such as testing a `set[int]` as a `str` under `warn_unreachable`.

For example, deferred annotations allow the class name in a return type:

```python
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Record:
    value: int

    def copy(self) -> Record:
        return Record(self.value)
```

An import used only for static typing can be conditional:

```python
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentry.models.organization import Organization


def process(organization: Organization) -> None:
    ...
```

External Any exceptions require an exact path, symbol and type position, dependency version, evidence of the dynamic boundary, containment, a contract test and a removal condition. Record only actual remaining exceptions here. Permit an exception only for an unavoidable third-party or runtime-dynamic boundary whose owned consumers narrow or validate the value. It may not widen a previously precise interface. Owned business logic and missing annotations never qualify. An investigator cannot approve its own exception. The coordinator reviews the evidence separately. If the test cannot establish containment, park the item.

## Acceptance and contract limits

| Deliverable | Executable proof |
| --- | --- |
| Trustworthy evaluator | `.venv/bin/pytest --reuse-db tests/tools/mypy_helpers/test_typing_campaign.py` and the complete existing helper corpus. Each negative case demonstrably rejects its bad input. |
| Core completion | `terminal` reports core checks passed: zero unaccounted owned implementations, zero effective weak settings, zero owned suppressed diagnostics, zero signature or generic omissions, zero all-strong errors. Remove both migration overrides, and prove helpers work with absent sections. |
| Precision completion | `terminal` reports zero unapproved explicit, inferred, imported or plugin-derived Any obligations. Every residual boundary has a tested containment entry. An incomplete audit blocks this claim. |
| Runtime preservation | All recorded affected tests and import checks pass without weakened assertions, missing collection or unexpected skips. Final affected subsystem suites pass. |
| Durable regression protection | Local and backend typing checks invoke the non-mutating evaluator checks against an explicit parent. New module, untyped function, widening and bypass mutations fail. No secrets or permissions are added. |
| Close | Two independent cold `terminal` invocations against unchanged final content agree. Regeneration is unchanged. Final diff review has no unresolved P1/P2 issue. All results and parked items are committed here. |

`terminal` must report core and precision outcomes separately and exit 1 until both pass. Partial success is reported as partial success, never campaign completion.

P5 wires `guard` into the existing typing job before its regeneration step. Supply the pull request base SHA for existing PR events and the event's `before` SHA for push events. For manual events or an all-zero push base, use the candidate's first parent. Validate that the chosen commit exists, fetching only that history through existing read-only checkout permissions when necessary. A missing parent is an invalid measurement, not permission to compare with current HEAD. These workflow changes support the repository's existing events. These workflow edits create no PR and trigger no remote workflow. Separate defect PRs follow the authorized exception. Validate event selection with fixtures and the existing workflow schema hooks. If a parent predates the evaluator, use current tested policy against both trees and report that bootstrap explicitly. After bootstrap, evaluate ordinary changes with policy loaded from the accepted parent. Policy changes require the independent adversarial corpus and compatibility checks before becoming the new authority.

Pre-authorized contract changes are limited to helper failure behavior, accurate error ranking, support for absent debt sections, stronger typing checks, internal truthful type corrections, and the evaluator CLI described here. Update callers, tests and this document together. Preserve helper command entry points used by CI. Preserve runtime signatures, defaults and input acceptance. Report every actual contract change in the campaign log.

Forbidden changes include new product API and wire contracts, database schemas, permission policy, transaction boundaries, dependency upgrades, new dependencies, new bypasses, hidden source exclusions, relaxed test assertions, workflow credentials and deploy behavior. Confirmed correctness or typing soundness repairs use the exception below. Park an item requiring any remaining forbidden change, with the minimal proposed change. The campaign does not ask for approval or attempt the forbidden change.

### File confirmed defects separately

This exception includes existing helper bugs found during bootstrap, runtime bugs uncovered by typing, and unsound stubs or plugin contracts. A diagnostic alone is not a confirmed bug. First prove the intended contract from callers or the dependency, then keep a minimal failing regression test. Do not reproduce customer identifiers in public artifacts.

1. Stop the owned daemon. Fetch `origin master` without altering local master. Create a dedicated branch from the freshly fetched `origin/master` in `.work/wt/bug-<short-name>`. Follow `create-branch`, `commit` and `pr-writer` skill conventions, using `.work/tmp` for PR bodies. Provision a worktree-specific virtualenv through `setup-dev` when needed. Do not repoint the hillclimb's editable installation. This worktree is exclusively for the defect, not typing adoption.
2. Reproduce on that fresh base. If the issue is absent, record that evidence and apply no speculative fix. If it exists, fix the root cause and prove fail-before/pass-after with the narrow regression test and affected existing tests. Keep one production module per commit where possible. Do not include unrelated typing or campaign documents in the defect branch.
3. Commit the tested fix. Push only that defect branch with an explicit remote and ref. Run `gh pr create --draft --base master --head <defect-branch> --title '<title>' --body-file <absolute-repo-path>/.work/tmp/pr-body.md`. Verify the resulting PR is a draft with base `master`. Do not approve, merge, or enable auto-merge. Record the PR URL, fix commit, affected modules and checks here.
4. If typing work requires the fix, cherry-pick the verified defect commit onto `typing-hillclimb` as its own commit, then revalidate affected typing and tests. Preserve its separation from annotation commits. If it does not apply cleanly, resolve only within the proven fix contract or park dependent typing. Never merge all of master merely to import the fix.
5. Remove a clean completed defect worktree. Retain its published branch. If publication is blocked by credentials or permissions, retain the committed branch, record the concrete failure, remove the clean worktree and continue independent work. A discovered defect is not considered filed without a verified draft PR. It remains a parked deliverable.

Only this defect flow authorizes remote writes. Scope changes beyond a demonstrated bug fix remain forbidden. If a defect requires a new product decision or a forbidden migration, park it with evidence instead of guessing its contract.

## Optimization and close

Optional P6 work targets verification latency, not a new checker architecture. Compare the same configured and all-strong commands on the same source set and environment. Record warm versus cold caches and peak memory. Use three interleaved baseline and candidate runs, CPU time where useful, and report the minimum and range. Keep a change only when the gain exceeds the observed spread and no comparable case regresses more than 10%. A repeatable regression above twice baseline must be investigated even before P6 when it prevents useful verification.

Run time gates only between successful `perf-gate-ready` and `perf-gate-ready -1`. Discard a run that overlaps host load. If the host remains busy, report `perf gate deferred: host busy`; defer the optimization and do not claim campaign completion with a required gate outstanding. Memory always stays within the charter budget. There is no application binary-size or build-time change planned. If a proposed optimization would change dependencies, build products or startup behavior, park it under the contract limits.

At close, remove dead debt-processing paths only after searching callers, tests, hooks, CI and generator inputs. Retain public helper entry points still used by CI and tests, with zero-state behavior. No compatibility shim is needed for an unconsumed internal path. Review the final changes with the repository's code-review and typing bug lenses, limited to this campaign's diff. Fix P1/P2 findings or park the affected deliverable. Do not audit unrelated repository code.

## Non-goals

This campaign does not upgrade mypy or Python, introduce product behavior, convert the repository to universal strict mode, promise universal Any-free Python, build an autonomous scheduling platform, or benchmark application runtime. Ordinary typing changes stay local. Only confirmed defect fixes receive separate draft PRs. It does not type vendored code as owned code or award credit for deleting behavior. It does not run a repository-wide cleanup or full CI by default.

## Reference: how typing currently works

The authoritative configuration is `pyproject.toml`. It configures `check_untyped_defs`, `no_implicit_reexport`, `warn_unreachable`, `warn_unused_configs`, `warn_unused_ignores`, `warn_redundant_casts`, `disallow_any_generics`, `disallow_untyped_defs`, `strict_equality`, `local_partial_types`, and error codes `ignore-without-code` and `redundant-self`.

Local stubs live in `fixtures/stubs-for-mypy`. Plugins are `pydantic.mypy`, `mypy_django_plugin.main` and `tools.mypy_helpers.plugin`. Django uses `sentry.conf.server_mypy`. Normal discovery excludes `.venv/`, `venv/`, `self-hosted/` and `bin/`. Discovery from `.` alone does not prove complete owned-source coverage.

Four override groups have different purposes:

- `snuba_sdk.*` skips following imports because published types cause errors.
- The third-party list uses `ignore_missing_imports` for dependencies without usable types.
- The generated Sentry error list disables `arg-type`, `assignment`, `attr-defined`, `misc` and `union-attr` for `sentry.snuba.metrics.query_builder` and `sentry.testutils.cases`.
- The weaklist disables `disallow_any_generics`, `disallow_untyped_defs` and `strict_equality` for many application, test, fixture and tooling modules, including wildcard patterns.

The two Sentry lists are separate debt mechanisms. Removing one does not make the other disappear. `tools/mypy_helpers/mypy_without_ignores.py` removes only the generated error section. `find_easiest_modules.py` currently counts every Python-path-prefixed line and prints descending counts. It is a selector, not a complete debt oracle.

`make_module_ignores.py` currently clears `.mypy_cache`, runs the unsuppressed helper, writes `.artifacts/mypy-all` and rewrites `pyproject.toml`. It does not validate exit status or stderr. Before P1, do not use it in the integration checkout. Its entry point is:

```sh
.venv/bin/python -m tools.mypy_helpers.make_module_ignores
```

`check_stronglist.py` currently requires exactly one override of each debt kind and requires suppressed modules to remain weak. `prevent_weaklist_additions.py` compares literal module strings with `HEAD`, not effective settings against a supplied accepted parent. The sorter and list validator run through prek. The bypass hook catches whole-line ignores and selected other forms, but it does not reject every inline coded ignore.

Backend typing CI installs from `uv.lock` using a private package index, sets up Sentry, and runs mypy with `RuntimeWarning` as an error. After success it regenerates debt and fails on config drift or selected message patterns in `.artifacts/mypy-all`. It can auto-commit generated config on a non-master ref. Its push trigger names master. Its aggregate backend check permits skipped child jobs. Local campaign checks must reproduce the relevant guarantees without assuming an aggregate green means typing ran.

The custom plugin injects Any into request attributes and other types. Source annotation counts alone miss these obligations. Existing positive and negative plugin tests live in `tests/tools/mypy_helpers/test_plugin.py`; serializer tests also live in `test_typed_validated_data.py` in that directory.

Initial metadata candidates are `sentry.api.api_owners`, `sentry.api.api_publish_status` and `sentry.api.endpoints.frontend_version`. The first two are enums, with an annotated property on the second. The endpoint has an annotated method. All remain weak. These are candidates to probe, not verified clean promotions.

Editor integrations must use this virtualenv and `pyproject.toml`. Confirm errors with the repository mypy command because another language server may not load Sentry's plugins.

## Decision log

Append one line per consequential executor judgment: item, decision, evidence and reason. Do not repeat policy or record every command here.

## Campaign log

Append one short entry per phase and parked item. Include accepted commits, changed contracts, exact verification commands, outcomes, elapsed times, remaining obligations and retry conditions. Keep raw transient checker output in scratch. Persist only the findings needed to resume or assess the campaign.

## For the owner afterwards

- Read the final campaign log for core and precision results, contract changes, external Any boundaries and parked blockers.
- Inspect the local typing commits on `typing-hillclimb`, one module per commit. Review the separate draft PRs listed for confirmed defects. Any defect required by the hillclimb is imported as its own fix commit.
- A parked deliverable requires a new instruction only if you want to authorize its forbidden contract change. The executor finishes all independent authorized work first.

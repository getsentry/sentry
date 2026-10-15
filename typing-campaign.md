# Sentry typing hillclimb

Status: P1 helper hardening, P2 core evaluation, and the repository-wide configured/unsuppressed/all-strong baseline are complete. The baseline covers all 8,266 inventoried source paths and measures 33/77/3,224 diagnostics in the three profiles; these are existing debt counts, not a repo-wide green result. The exact-tree comparison accepted `sentry.api.api_owners` with no configured, unsuppressed, or all-strong debt increase. Repository-wide precision measurement remains pending. Earlier configured checkpoints covered 8,229 or 8,231 selected sources and do not supersede this broader inventory.

Integrate typing work on the existing `typing-hillclimb` branch, with one module per ordinary commit and the demonstrated atomic-repair exception below. The owner authorized staggered item lanes in isolated worktrees under `.work/wt/`; do not push lanes or create PRs. The goal is to remove genuine Python typing debt while preserving runtime behavior and precise contracts.

Deliver these outcomes, in order:

1. A tested evaluator that rejects incomplete measurements and typing bypasses.
2. Complete owned-source coverage under the existing strong mypy settings, with both migration overrides removed and zero all-strong diagnostics.
3. Precision accounting that includes inferred, imported, and plugin-derived Any. Resolve owned dynamic debt and contain justified external Any at tested boundaries.
4. Permanent local and CI checks that prevent regression, plus a final report of completion or concrete parked blockers.

## Execution charter

- Decide within the bounds below, record consequential calls, and continue until every deliverable passes or all remaining items are parked. Never wait for approval. Give no routine check-ins during execution. Keep findings and phase results in this document.
- Use `typing-hillclimb` as the integration branch. Stagger independent item work in isolated worktrees under `.work/wt/`; each lane owns only its assigned module and tests. The coordinator owns `typing-campaign.md`, integration, exact-tree evaluation, and campaign commits. Only one lane may edit `pyproject.toml` at a time. Keep repository checkers serialized and do not run parallel database suites against the same services.
- Launch authorizes local campaign commits. Commit each validated improvement using `type(scope): imperative lowercase subject`, at most 72 subject characters. Put item IDs and reasoning in the body. Do not commit unrelated owner changes. Only confirmed defects reproducing on fresh master may receive a new pushed fix branch and draft PR. Existing upstream fixes and branch-only defects follow their local routes below. Do not deploy, merge to master, or change repository permissions.
- At launch, inspect dirty files. Commit these campaign documents only if their contents match this plan. Leave unrelated changes untouched and park items whose files overlap them. Dirty-checkout checks are investigation only. Acceptance must validate the exact intended commit tree using the snapshot procedure below. If isolation cannot be proved, defer acceptance. Unexpected branch movement parks integration until its cause is understood. Never reset, stash, or overwrite someone else's work.
- Functional parity and typing completeness precede performance optimization. A truthful dependency-cluster repair is preferable to a misleading annotation that preserves a local score.
- Read the relevant `AGENTS.md`, callers, tests, plugins, and runtime annotation consumers before editing. Do not add code comments except the repository's allowed cases. Code comments never cite this campaign.
- Before writing scratch, ensure `.work/` is in `.git/info/exclude`. Use `.work/tmp` for scratch and set `TMPDIR` to its absolute path. Use separate caches per profile. Durable decisions and results belong here. Commit fixtures and tests where their readers need them. Do not add a supervisor service, database, journal, provenance manifest, or patch hashes.
- Use the existing virtualenv. Provision it through `setup-dev` if necessary, with `SENTRY_DEVENV_FRONTEND_ONLY=1 devenv sync`. Never change locked versions to make the evaluator pass. No new dependencies are authorized.
- Budget one checker process at a time, retaining the configured five internal workers initially. Reserve 8 GiB available memory before a repository checker run and 2 GiB per read-only agent, with 4 GiB host headroom. Start with two investigators if that budget fits, otherwise one or none. Reduce checker workers consistently for both comparison sides if measured peak memory exceeds the budget. Never run parallel database suites against the same services.
- An item gets at most three failed repair attempts for the same blocker. Reproduce, identify the cause, and halve the failing input or dependency set after two failed hypotheses. Park it with the command, cause, next dependency, and retry condition. Retry only when that condition changes. Continue independent work. Before closing with all remaining work parked, check whether a parked prerequisite still has an authorized repair path. Attempt that prerequisite before declaring the remaining work blocked.
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

- Stagger disjoint item lanes in isolated worktrees under `.work/wt/`. This owner instruction supersedes the previous single-writer restriction. Keep shared-file edits serialized: one `pyproject.toml` writer and one repository checker at a time. The coordinator integrates only after the exact candidate tree passes.
- Use local evaluation as the authority. The existing backend workflow can write configuration on non-master refs and its aggregate permits skipped jobs. No remote checks or credentials are needed for local typing acceptance. Publishing defect PRs requires authenticated Git and gh. P5 edits and validates workflow source locally. It does not trigger remote jobs. Preserve existing CI writer behavior and permissions.
- Preserve application behavior and public input acceptance in typing commits. Truthful annotation corrections are allowed when implementation, callers and tests prove the existing contract. Confirmed bugs and soundness issues use the separate defect route matching where they reproduce. New product contracts, permission policy, schema changes and data migrations remain parked.
- Bootstrap before promotions. The current generator exits zero and rewrites configuration after a checker failure. Its output cannot authorize adoption until fixed and tested.
- Keep third-party import policy unchanged in derived profiles. First-party files excluded from normal discovery still need an explicit classification and proof. No owned implementation may be hidden behind a new stub.
- Count absolute obligations and coverage, not weaklist line counts or percentages. Deletions, renames, moved errors, and shrinking the denominator earn no typing credit.
- Do not approve new owned Any or new suppressions. External Any may survive only under the boundary policy below. The evaluator cannot infer that approval from an existing annotation.
- Introduce additional strictness as calibrated audits. Do not silently enable every strictness option for the whole repository. Compiler and plugin behavior comes from installed mypy 2.1.0 until a separately authorized upgrade.

### Delegated decisions

The coordinator chooses modules, precise type representations, focused test nodeids, and dependency clusters. Each ordinary commit changes one Python implementation module, its related tests, its weaklist entry and necessary documentation. Metadata promotions also remove one module per commit. Aim for at most 300 changed implementation lines. A larger module may take several independently valid commits. Prefer an ordered sequence of valid single-module commits for shared-type repairs. An atomic commit may span the minimum coupled modules only after demonstrating that no ordered single-module sequence preserves acceptance invariants. An import cycle is not required for that exception. Record the evidence before editing. Never combine unrelated modules. Prefer the smallest truthful contract. Break equal-priority ties by module name.

Allocate approximately 60% of each ten bounded investigation sessions to application leaves or metadata removals, 25% to shared foundations, and 15% to tail investigation. Count an attempted session even when its useful outcome is a parked blocker. Measure completions separately. Rebalance only from observed blockers or idle work. These are scheduling defaults, not completion criteria. Tests, fixtures, helpers, and owned tooling are mandatory before terminal completion.

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

These are loop observations, not performance claims. `perf-gate-ready` and the subsequent `perf-gate-ready -1` both exited 0. The broader configured, unsuppressed, and all-strong baselines are now measured below; repo-wide precision and runtime baselines remain unmeasured. The configured profile has existing diagnostics, so do not infer a repo-wide green result.

At P0 verify `perf-gate-ready` is available and record each command, exit status, elapsed time, peak memory, selected test count, and failures. If that utility is missing, correctness work may proceed but performance gates remain deferred. Limit initial commands to 60 seconds for focused checks and 20 minutes for a repository profile. Terminate the whole child process group on timeout, mark data invalid, and investigate the cause. A timeout never becomes an accepted partial result.

Before the first source edit, derive the all-strong profile and establish focused feedback with the target's migration exemptions removed. A green configured-profile result while the target remains weaklisted is not adoption evidence. Use the narrowest relevant commands:

```sh
.venv/bin/mypy --config-file .work/tmp/all-strong.toml --no-warn-unused-configs src/sentry/path/to/module.py
.venv/bin/pytest --reuse-db tests/path/test_module.py::test_behavior
.venv/bin/python -m tools.mypy_helpers.check_stronglist pyproject.toml
.venv/bin/python -m tools.mypy_helpers.prevent_weaklist_additions pyproject.toml
```

Paths containing `path` above are syntax examples. Before each item, replace them with existing files or nodeids in its brief. The mypy pre-push hook is also available:

```sh
SENTRY_MYPY_PRE_PUSH=1 .venv/bin/prek run -q mypy --files src/sentry/path/to/module.py --stage pre-push
```

Run lint through prek on explicit changed files. Skip `ruff-format`, mutating autofix hooks, and the weaklist sorter when they would violate the no-formatter rule. Use Ruff's read-only `check` through a scratch prek configuration if needed. Preserve all applicable read-only checks. Do not stage files just to discover what needs checking.

### Establish focused feedback

P0 establishes a trustworthy focused all-strong loop before source adoption. Enable daemon feedback only after parity and repeated-check tests pass for the target's import graph. Give the coordinator one daemon, using the same virtualenv, warning policy and derived all-strong configuration as the focused ordinary checker. Keep status, logs, sockets and cache under `.work/tmp`. Do not use the daemon for precision reports or final acceptance. Installed dmypy ignores report-generation settings during startup.

The installed mypy 2.1.0 daemon failed this readiness check on 2026-10-14. With the actual plugins and import policy, repeated explicit checks crashed with `KeyError: 'snuba_sdk.mql'` in fine-grained import traversal. This occurred for `sentry.api.serializers.base` and the enum-only `sentry.api.api_owners`, under a derived all-strong profile. The configured-profile transactions target also failed on recheck. A successful startup or first check is insufficient. All owned daemons were stopped. Use ordinary incremental all-strong mypy for current iterations. Do not weaken import policy or patch the installed dependency to enable daemon mode.

The all-strong enum target passed ordinary and daemon cold checks with zero workers, in 12.94 and 13.23 seconds respectively. The first warm pair took 3.878 seconds for CLI and 2.929 seconds for daemon, but the next daemon check crashed. These incomplete samples establish no persistent speedup. The working CLI's next warm check took 3.098 seconds. The P2 core baseline is complete; repo-wide precision remains unmeasured.

Retest the following candidate workflow only after a demonstrated repair of the external checker failure, within the dependency-change authorization limits:

```sh
PYTHONWARNINGS=error::RuntimeWarning .venv/bin/dmypy --status-file .work/tmp/dmypy-status.json run --log-file .work/tmp/dmypy.log --timeout 600 -- --config-file .work/tmp/all-strong.toml --cache-dir .work/tmp/dmypy-cache --num-workers 0 --no-warn-unused-configs src/sentry/path/to/module.py
.venv/bin/dmypy --status-file .work/tmp/dmypy-status.json check src/sentry/path/to/module.py
.venv/bin/dmypy --status-file .work/tmp/dmypy-status.json stop
```

Replace the example path with the exact item module. `run` establishes the target set; use `recheck` only after parity tests prove repeated rechecks work with this target's import graph. Restart after changes to configuration, plugins, stubs, environment or target set. Keep any configured-profile daemon separate from the default all-strong daemon. Never reuse state across profiles. The `--timeout 600` flag expires an inactive server. It is not a deadline for a typecheck request. Enforce request deadlines externally and clean up the owned daemon after a timed-out request.

Installed mypy 2.1.0's daemon disables ordinary cache writes by setting its internal cache path to `/dev/null`. Its parallel build setup then tries to create that directory when `num_workers` is nonzero. The daemon therefore needs `--num-workers 0`; leave the repository's normal checker worker setting unchanged. Compare equivalent zero-worker CLI and daemon profiles when measuring speed. Recheck compatibility after a checker upgrade before removing this override.

Compare daemon and ordinary mypy diagnostics on the same target and profile before relying on feedback. Exercise an introduced error, its repair, and a changed imported signature. Sentry plugin canaries must also agree. Unknown, stale or divergent output disables daemon feedback for that affected scope until repaired. A crash or timeout invalidates its result. The fallback is the ordinary focused all-strong checker, with a loop investigation if it exceeds 60 seconds. This fallback permits adoption under the same acceptance gates. The external daemon blocker alone does not park otherwise verifiable typing work.

Measure the first run and three warm rechecks separately under the host-readiness policy. Target a warm module feedback loop below 10 seconds. This is a P0 loop target, not an observed speedup or permission to weaken acceptance. If the target cannot be met, identify the limiting work before continuing expensive iteration. Stop the daemon before changing branches, making defect worktrees, cold evaluations or shutdown. Stop or kill its owned process on failures and verify the status no longer refers to a live server. Never stop another user's daemon.

## Sequence

Each row is a coherent work item. Sizes are expected coordinator sessions, not deadlines. A session can continue the next item once its prerequisites pass. Launch disjoint item lanes as soon as their dependencies pass; keep shared configuration, repository checkers, and integration serialized. Every phase allows up to two additional read-only investigators within the memory budget.

| ID | Size | Prerequisites | Owned files | Acceptance |
| --- | --- | --- | --- | --- |
| P0 Ground | 1 | None | This document and scratch only | Recheck environment, existing helper tests, configured mypy, source discovery, and initial runtime test map. Record actual outcomes and timings. Repair or park invalid foundations before promotions. |
| P1 Helpers | 1–2 | P0 environment usable | Existing `tools/mypy_helpers` list, profile, generation and ranking helpers; matching `tests/tools/mypy_helpers` tests | Fail-before/pass-after tests for crash, notes, malformed markers, absent overrides, and zero debt. Existing helper tests pass. Normal valid generation preserves semantics. |
| P2 Evaluator | 2–4 | P1 | New `tools/mypy_helpers/typing_campaign.py`; matching `tests/tools/mypy_helpers/test_typing_campaign.py`; this document | Core measurement is implemented and the three repo-wide baselines are complete. Repair and pass exact-tree comparison before promotions. Complete the precision baseline as extraction becomes available. Relevant adversarial cases must pass before each permitted edit class. |
| P3 Metadata sweep | 1–2 | P2 core adoption gate | Assigned weaklist entry; coordinator-owned campaign log | Keep a finite queue of effectively weak modules. Stagger independent inspections and prepare one metadata candidate at a time. Promote one proven clean module per commit. Wildcard removals preserve coverage of still-weak siblings. The sweep may overlap P4 scheduling. |
| P4 Adoption | Repeated items | First accepted P3 pilot; P2 checks covering the edit class; dependency prerequisites per item | Assigned Python modules and their tests; serialized weaklist edit | Complete whole modules, remove effective weak coverage, pass evaluator and mapped runtime tests. Stagger disjoint implementation lanes while serializing shared configuration edits, repo checkers, integration, and database suites. Finish application code, tests, fixtures and tooling. |
| P5 Hardening | 1–3 plus discovered blockers | All unparked P3 and P4 obligations complete; P2 complete precision gate | Evaluator, touched plugin and stub tests, `.pre-commit-config.yaml`, `.github/workflows/backend.yml`, this document | Resolve uncovered negative cases. Wire non-mutating checks into local hooks and backend typing CI. Prove a new module, new untyped function, bypass and precision-erasing interface each fail. CI configuration parses. Preserve existing job permissions and writer behavior. |
| P6 Optimization | 0–2 | P5 parity and coverage complete | Only measured bottleneck files and their tests | Optional speed work meets the measurement policy below. Drop speculative speed work. No performance tuning may conceal missing coverage or loosen checks. |
| P7 Close | 1 | P6 complete or explicitly skipped | Debt overrides, proven obsolete helper paths and callers, this document | Two cold evaluations agree on all terminal conditions. Run required affected backend suites and final adversarial corpus. Review final diff, fix P1/P2 findings, commit report. No active writer or unrecorded blocker remains. |

P0 may discover work that invalidates its initial test map. Add the new suites before accepting the corresponding item. If P0 cannot run configured mypy, P1's isolated helper repairs may proceed, but source promotions remain blocked.

One ordinary commit is one accepted item. The minimum coupled atomic repair is also one accepted item. There is no batch of unvalidated intermediate commits. Run the evaluator for each intended item tree, plus full repository checking at P0, P5 and P7 because shared types can affect reverse dependents outside the edited files. Reuse a prior measurement only when every relevant source, effective option, plugin, stub, dependency and environment input is unchanged. Metadata-only promotions may reuse all-strong results because the removed exemptions were already absent in that profile. They still require configured-profile validation of the new tree. One full configured checkpoint may cover a recorded series of strictly configuration-only promotions. Record each reuse and its unchanged inputs. Full runtime testing means the union of affected subsystem suites selected by the procedure below. Do not launch workspace-wide pytest or all CI. Widen only for a specific uncovered integration risk recorded before the run.

## Evaluator contract

P2 provides these commands:

```sh
.venv/bin/python -m tools.mypy_helpers.typing_campaign baseline --output .work/tmp/baseline
.venv/bin/python -m tools.mypy_helpers.typing_campaign evaluate --parent ACCEPTED_PARENT --candidate-tree CANDIDATE_TREE --output .work/tmp/candidate
.venv/bin/python -m tools.mypy_helpers.typing_campaign evaluate-series \
  --parent ACCEPTED_PARENT --candidate-tree FIRST_TREE --candidate-tree SECOND_TREE \
  --output .work/tmp/series
.venv/bin/python -m tools.mypy_helpers.typing_campaign guard --parent ACCEPTED_PARENT --output .work/tmp/guard
.venv/bin/python -m tools.mypy_helpers.typing_campaign terminal --output .work/tmp/terminal
```

`ACCEPTED_PARENT` is the concrete Git revision saved immediately before editing. `CANDIDATE_TREE` is the intended commit's Git tree, not the live working tree. Only the coordinator can change evaluator policy, in a separate tested infrastructure commit with no adoption credit. Run evaluation without concurrent edits. Use the evaluator from the last accepted infrastructure revision, loaded from scratch with its own imports, while inspecting candidate files as data. Do not execute candidate evaluator policy to approve that candidate.

`evaluate-series` accepts ordered `--candidate-tree` values. Each adjacent tree pair must change only `pyproject.toml` and pass the evaluator policy check. The command measures the parent once, measures each candidate once, and compares each candidate with the preceding measurement. It stops after the first rejected or invalid candidate. It measures configured and unsuppressed profiles for every candidate. It reuses the original parent's all-strong profile only when the configurations match after the weaklist section is cleared. The source inventory, source digests and graph coverage must also match. Otherwise, it measures all-strong for that candidate. Use this command for a linked series of metadata promotions. Do not use it for source changes.

Construct the intended tree using a separate `GIT_INDEX_FILE` under `.work/tmp`: initialize it with `git read-tree ACCEPTED_PARENT`, add only the item-owned paths, and obtain the tree with `git write-tree`. Never use the owner's index or include unrelated dirty files. Overlapping owner edits remain parked. Materialize this tree as a disposable source snapshot under `.work/tmp`, without a new branch or Git worktree. All first-party source reads, config paths, plugins, generated inputs and runtime test imports must resolve to this snapshot. Run the checker and tests from its root.

Reuse installed third-party dependencies, but override editable source resolution for the snapshot. Launch checker and test subprocesses with fresh imports, separately from the trusted evaluator process. Candidate plugins must not accidentally reuse trusted-policy modules already loaded under the same `tools` namespace. Prove the resolved origins of Sentry, first-party helpers, checker plugins and affected imports. Reject graph paths, module origins or first-party editable mappings that point back to the live checkout or an older snapshot. A candidate deletion must not fall back to the live module. For downstream GetSentry checks, resolve Sentry imports to this same candidate snapshot. If this isolation cannot be proved, defer acceptance. The dirty checkout remains usable for investigation only.

Commit only the owned paths, excluding unrelated staged changes with `git commit --only -- <owned-paths>`, and compare `HEAD^{tree}` directly with the validated tree before marking the item accepted. If a hook or any later edit changes content, revalidate the resulting intended tree. A mismatch is an unaccepted candidate and blocks further adoption until corrected. Do not reset owner files to force equality. Committed candidates and CI guards use their actual commit trees, never mutable checkout state.

### Establish the P2 gates

The core adoption gate requires complete checker measurements for configured, unsuppressed and all-strong profiles, correct profile derivation, owned-source reconciliation, effective weakness and suppression comparisons, bypass detection, exact-tree evaluation and the rejection cases for those mechanisms. Precision support is also required for the particular edit class being accepted:

| Edit class | Required precision coverage |
| --- | --- |
| Metadata only | Implementation sources and derived all-strong policy are unchanged. No source precision extraction is needed to prove that this edit introduces no dynamic typing. |
| Ordinary source annotations | Measure changed parameter, return and generic contracts and their affected consumers, including Any origins and newly untyped paths. Positive and negative canaries prove those measurements detect precision loss. |
| Plugins, decorators, stubs or dynamic boundaries | Measure the changed boundary's resolved types and affected consumers, including injected and imported Any. Keep the item blocked while that coverage is absent. |

Incomplete global precision extraction does not block metadata-only promotions that meet this gate. Source edits proceed only where available checks cover the changed contracts. No incomplete measurement may be presented as a successful measurement.

The complete precision gate requires repository-wide accounting of explicit, inferred, imported and plugin-derived Any, classified residual obligations, a complete precision baseline and all precision rejection cases. Continue precision work alongside authorized P3 and P4 lanes; keep repository checker runs serialized. Precision completion and P5 remain blocked until it passes.

Use the standard library and installed dependencies. Separate profile derivation and comparison decisions from subprocess and filesystem effects. Expose three outcomes: complete measurement, rejected candidate, invalid measurement. Exit 0 means a complete baseline measurement for `baseline`, an accepted improvement for `evaluate`, preserved invariants for `guard`, and actual completion for `terminal`. `guard` permits unchanged debt so ordinary commits can use it. `guard` also accepts `--candidate-tree` for the intended local commit. Without it, guards and terminal checks use `HEAD^{tree}` and ignore dirty content. Exit 1 means a measured rejection or unmet terminal obligations. Exit 2 means a checker, configuration, environment, timeout, or completeness failure. Preserve the original subprocess status and stderr in the report.

Derive profiles by removing uniquely delimited debt sections from a copy of `pyproject.toml` in `.work/tmp`. Accept absent sections as zero debt. Reject duplicates, unmatched markers, unexpected weakening, and parse failures. Run feedback from the checkout root and acceptance from the isolated snapshot root. Resolve configuration-relative paths against the corresponding source root before relocation, including stub paths. Acceptance paths must point inside its snapshot rather than the live checkout. Test that configured and unchanged derived profiles discover identical files and plugins. Never relocate configuration and assume relative paths still work.

| Profile | Change from configured policy | Proof required |
| --- | --- | --- |
| Configured | None | Complete measurement, no new owned diagnostics against the accepted parent, and a clean focused configured check for the changed item. Use `PYTHONWARNINGS=error::RuntimeWarning .venv/bin/mypy`. |
| Unsuppressed | Remove only generated Sentry error override | Ordinary diagnostics are valid debt data. No note becomes an error. |
| All-strong | Remove both Sentry debt overrides | Existing global checks apply to every owned implementation. No remaining per-module weakening is allowed for owned sources. |
| Precision | All-strong plus calibrated reports and selected extra checks | Calibrate return-Any, untyped calls and decorators, imported Any, generic omissions and plugin-derived Any against real installed mypy. Keep their results separate from core completion. |

Use a parser calibrated against mypy 2.1.0 output, including notes, multiline messages, error codes, filenames and summaries. Treat exit 1 as debt only when an ordinary completed checker run explains it. Exit 2, unexplained stderr, missing completion evidence, plugin crashes, unknown output, truncation and missing sources invalidate measurement. Store raw stdout and stderr under the command's output directory. Gzip the precision adapter's raw stdout to `worker.stdout.gz`. That stream contains the repository-wide Any inventory. Keep other profiles in `worker.stdout`. Do not regenerate lists from invalid data.

Build the coverage inventory from `git ls-tree -r` for `.py` and `.pyi` in the accepted parent and intended candidate tree. This includes newly added candidate files and excludes unrelated checkout changes. Compare parent and candidate path sets and mypy's actual build graph, including whether each owned body was checked. Use a version-checked adapter around installed `mypy.main.process_options` and `mypy.build.build`. Inspect `BuildResult.graph`, each state's path and effective options, and retained source trees with `preserve_asts=True`. Use `export_types=True` for precision extraction. Run this audit with zero internal workers and no incremental cache until tests prove retained data remains complete with another setting. Keep the ordinary configured checker at its normal worker count. The adapter is pinned to the locked checker and fails on an unsupported interface. Validate extraction against CLI diagnostics and canaries, including an untyped body, skipped import and shadowed implementation. Module names must account for `src/`, packages, namespace packages, and wildcard precedence. Calibrate effective options against mypy itself, not `check_stronglist`'s simplified regex.

Classify every source as owned implementation, owned stub, owned generated implementation, vendored implementation, or non-importable executable. Default unknown files to owned implementation. Audit `bin/`, `self-hosted/`, dot-directories, fixtures and tools explicitly. Check importable omissions in a derived all-strong invocation with explicit paths. Check non-importable executables individually with matching policy. Avoid duplicate module identities. Generated code is repaired through its generator. A `.pyi` selected instead of an owned `.py` cannot count as checking that implementation. A discovery problem is a blocker, never an exclusion to add.

Compare effective weak `(module, option)` and suppressed `(module, code)` pairs over that inventory. Detect source omissions, wildcard broadening, changed disabled codes, new import skips, rename masking and precision-erasing signatures. Record each remaining function signature, generic obligation, diagnostic and dynamic interface by path and qualified symbol. Use AST anchors to avoid claiming credit for shifted line numbers. Require every accepted item to remove at least one real obligation with all-strong errors non-increasing. Combine a foundational repair with its dependent corrections only under the demonstrated atomic-commit exception.

Measure explicit Any and source bypasses with AST and token inspection. Measure resolved interfaces, implicit Any, imports and plugin injections through calibrated checker reports or a read-only checker adapter. Any-expression and line reports are evidence, not sufficient proof. Positive and negative type canaries must prove that imported or injected Any is noticed. An Any obligation contains the owned path, qualified symbol or expression anchor, type position, origin, and exception association or explicit absence of an exception. Store these fields in the existing evaluator report, not another manifest. Compare the same extraction on parent and candidate so newly discovered pre-existing debt is distinguished from introduced debt. Incomplete extraction follows the edit-class gates above and blocks precision completion.

Reject new ignores, `no_type_check`, erasing casts, `Callable[..., Any]`, broad `dict[str, Any]`, unchecked stubs, precision-erasing changes and unsupported contract changes. Compare typing imports and qualified aliases as well as spelling. Existing sites remain backlog. Judge parameter types, return types, generic relationships and overloads according to their roles. Truthful annotation corrections preserving runtime behavior and public input acceptance are authorized when implementation, callers and tests support them. Route a demonstrated soundness defect through the defect procedure.

A read-only input corrected from `list[int]` to `Sequence[int]` is allowed when it describes the existing runtime contract. Changing `User` to `Any` loses checking and is rejected. Changing a `User` return to `object` merely to remove errors loses consumer guarantees and is rejected. `object` remains appropriate for a genuinely opaque input that is narrowed before use. Park changes that require new runtime behavior or an unsupported contract, not truthful corrections merely because their accepted type set is broader.

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
- An unrelated uncommitted dependency repair makes the live checkout pass while the intended commit fails. Exact-tree acceptance must reject that candidate. A deleted snapshot module must not resolve through the live checkout's editable installation.
- A truthful read-only input correction is accepted, while parameter Any erasure and unsupported return broadening are rejected. Metadata-only adoption remains possible with global precision extraction incomplete. An unmeasured dynamic-boundary edit remains blocked.

Existing reference tests are in `tests/tools/mypy_helpers/` and `tests/sentry/test_mypy_stronglist.py`. Build the corpus from the current helper implementations, their callers in `.pre-commit-config.yaml` and `.github/workflows/backend.yml`, and the cases above. Keep expected successful behavior and intentional changes visible in test names. Prove rejection by mutating one measured input at a time. Do not normalize away diagnostic codes, policy changes or missing sources.

## Runtime verification and annotation policy

### Verification selected by change class

Focused mypy with a positional filename replaces the configured `files = ["."]` root selection: mypy follows statically discoverable imports, but that is not whole-repository selection, does not discover every reverse dependent, does not strengthen dependencies (they keep their own weaklist entries and import policies), and proves nothing about runtime startup order or registration side effects. A large number of visited modules is not evidence that all affected consumers were verified. Apply acceptance according to the actual diff:

| Change class | Acceptance required |
| --- | --- |
| Weaklist deletion only | Focused mypy under the checked-in configuration after removal (this activates the strong settings for that module; no separate all-strong profile needed for activation), configuration guards, and full configured verification. One full configured checkpoint may cover a series of strictly configuration-only promotions; that sharing is deliberate policy recorded here, never inferred from targeted green runs. No repeated runtime suite solely because an unchanged module has import side effects. |
| Annotations with no import changes | All of the above for the item, plus full configured mypy of the new tree, all-strong debt comparison once the P2 gate operates, contract review, and relevant existing behavior tests. |
| Imports, `TYPE_CHECKING`, deferred annotations, decorators, base classes, stubs, or plugin contracts changed | All of the above, plus fresh-process startup and affected consumer tests, including assertions that required registrations and runtime annotation consumers still work. |

Supporting corrections: `--no-warn-unused-configs` only silences unused-section warnings and stays appropriate for focused runs. Exact weaklist patterns do not cover dotted children (`"sentry"` does not cover `sentry.__main__`). Checker setup through `sentry.conf.server_mypy` exercises mypy-path initialization, not CLI, web, or worker startup. The registration hazard is concrete: moving a registration import under `TYPE_CHECKING` keeps mypy green while the registration disappears, and runtime annotation evaluation can fail where static checking succeeds. Never claim a startup path from a typecheck.

Reusable startup checks for import-sensitive changes, each in a fresh process (`sys.modules` caching can otherwise skip the path under test, and the import walk does not prove every import order):

```sh
.venv/bin/pytest --reuse-db tests/sentry/test_devimports.py::test_startup_imports
.venv/bin/python -m sentry --help
```

The first walks application modules in a separate interpreter and rejects dev-only imports; the second exercises the `__main__` to `runner.main` path and its string-based command registration. Both are smoke tests, not behavior tests.

### Check GetSentry consumers at shared boundaries

Keep implementation adoption within Sentry. Use `../getsentry` as a read-only consumer when a changed module exports a contract it uses. Ordinary private leaf annotations and Sentry-only weaklist changes need no GetSentry gate. Before changing an exported signature, generic default, protocol, base class, decorator, plugin hook or stub, search GetSentry imports, subclasses and settings-selected implementations. Include those consumers when deciding the truthful type.

Known extension points include `sentry.api.serializers.Serializer`, endpoint bases, `sentry.quotas` and feature handlers. GetSentry's `BeaconSerializer` subclasses `Serializer` without a type argument, and `SubscriptionQuota` overrides Sentry quota methods. Do not remove a generic default or narrow an accepted override merely because only Sentry callers were checked. Those are contract changes under this campaign's existing limits.

For affected shared contracts, run the narrow GetSentry typing hook and existing consumer tests under GetSentry's own configuration. Record concrete file paths and collected nodeids before editing. Its pre-push hook requires `SENTRY_MYPY_PRE_PUSH=1`, `--stage pre-push` and explicit `--files`. Its settings module is `getsentry.conf.settings.dev_mypy`. Missing services or a blocked downstream check parks the shared-contract item. Continue independent Sentry modules. Do not change GetSentry annotations or suppressions just to make a Sentry promotion pass.

GetSentry has a separate `tools/mypy_helpers/plugin.py`, currently byte-identical to Sentry's copy, loaded under the same qualified name. Plugin changes in Sentry do not update that file. Report any required downstream policy change explicitly. Do not claim cross-repository precision from a Sentry-only plugin test. GetSentry's `sentry.*` import override uses `ignore_missing_imports`, which does not suppress checking available typed Sentry APIs.

Both local checkouts share Sentry's virtualenv through GetSentry's `.venv` symlink. Anchor each command to the intended checkout and keep daemon processes, status files, caches and plugin module imports separate. GetSentry CI selects Sentry through `sentry-version` and `sentry-uv-lock`; its green baseline is not evidence for this hillclimb's newer source. Do not bump those files during the hillclimb.

Do not run GetSentry's sync repair against this checkout. `devenv/checks/check_getsentry_synced.py` can check out GetSentry's pinned Sentry revision and move this branch away from `typing-hillclimb`. Use the existing environment for downstream checks, put any new GetSentry scratch under its own ignored `.work/`, and park environment problems that would require changing the campaign checkout.

Before editing an item, list its exact files, caller contracts, runtime annotation consumers and existing pytest nodeids in a short item entry. Map `src/sentry/<subsystem>` to `tests/sentry/<subsystem>` first, then search for imports, class names and function names in tests and direct callers. For tools, start in `tests/tools`. Choose focused nodeids from those matches and record their containing subsystem suites for phase checks. Use `--collect-only` on the selected files to confirm test identities. If no mapping exists, add a runtime contract test before the edit. If a truthful test needs unavailable services or an unresolved contract, park the item. For metadata-only changes, unchanged implementation plus full typing and scope proofs suffices. For annotations, run import smoke under Sentry's configured environment and the existing behavior tests. Annotation-only changes may affect Django, DRF, Pydantic, decorators, imports and introspection.

If no existing test exercises a touched behavior, add the smallest runtime contract test. For plugins or stubs, use paired valid and invalid type canaries and runtime checks against the real dependency where necessary. For a shared contract, add tests from at least one direct consumer and one reverse-dependent subsystem. If that cannot establish compatibility, park the cluster. Do not interpret an empty selection or unexpected skip as success.

For each accepted item run its focused tests, the independent evaluator, and applicable read-only lint against the intended tree. Apply only the explicit unchanged-input reuse rule above. At phase end run all tests added or changed in that phase, the affected subsystem files, and the helper corpus when helpers or policy changed. At P7 run the union of affected subsystem suites once against the final content. Use existing artifacts and `--reuse-db`. Do not rely on historical coverage alone or use `make test-selective` as the routine local loop.

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

External Any exceptions require an exact path, symbol and type position, dependency version, evidence of the dynamic boundary, containment, a contract test and a removal condition. Record only actual remaining exceptions here. Permit an exception only for an unavoidable third-party or runtime-dynamic boundary whose owned consumers narrow or validate the value. It may not erase a previously precise guarantee. Owned business logic and missing annotations never qualify. An investigator cannot approve its own exception. The coordinator reviews the evidence separately. If the test cannot establish containment, park the item.

## Acceptance and contract limits

| Deliverable | Executable proof |
| --- | --- |
| Trustworthy evaluator | `.venv/bin/pytest --reuse-db tests/tools/mypy_helpers/test_typing_campaign.py` and the complete existing helper corpus. Each negative case demonstrably rejects its bad input. |
| Core completion | `terminal` reports core checks passed: zero unaccounted owned implementations, zero effective weak settings, zero owned suppressed diagnostics, zero signature or generic omissions, zero all-strong errors. Remove both migration overrides, and prove helpers work with absent sections. |
| Precision completion | `terminal` reports zero unapproved explicit, inferred, imported or plugin-derived Any obligations. Every residual boundary has a tested containment entry. An incomplete audit blocks this claim. |
| Runtime preservation | All recorded affected tests and import checks pass without weakened assertions, missing collection or unexpected skips. Final affected subsystem suites pass. |
| Durable regression protection | Local and backend typing checks invoke the non-mutating evaluator checks against an explicit parent and intended tree. New module, untyped function, precision erasure, dirty dependency contamination and bypass mutations fail. Truthful annotation corrections pass. No secrets or permissions are added. |
| Close | Two independent cold `terminal` invocations against unchanged final content agree. Regeneration is unchanged. Final diff review has no unresolved P1/P2 issue. All results and parked items are committed here. |

`terminal` must report core and precision outcomes separately and exit 1 until both pass. Partial success is reported as partial success, never campaign completion.

P5 wires `guard` into the existing typing job before its regeneration step. Supply the pull request base SHA for existing PR events and the event's `before` SHA for push events. For manual events or an all-zero push base, use the candidate's first parent. Validate that the chosen commit exists, fetching only that history through existing read-only checkout permissions when necessary. A missing parent is an invalid measurement, not permission to compare with current HEAD. These workflow changes support the repository's existing events. These workflow edits create no PR and trigger no remote workflow. Separate defect PRs follow the authorized exception. Validate event selection with fixtures and the existing workflow schema hooks. If a parent predates the evaluator, use current tested policy against both trees and report that bootstrap explicitly. After bootstrap, evaluate ordinary changes with policy loaded from the accepted parent. Policy changes require the independent adversarial corpus and compatibility checks before becoming the new authority.

Pre-authorized contract changes are limited to helper failure behavior, accurate error ranking, support for absent debt sections, stronger typing checks, internal truthful type corrections, and the evaluator CLI described here. Update callers, tests and this document together. Preserve helper command entry points used by CI. Preserve runtime signatures, defaults and input acceptance. Report every actual contract change in the campaign log.

Forbidden changes include new product API and wire contracts, database schemas, permission policy, transaction boundaries, dependency upgrades, new dependencies, new bypasses, hidden source exclusions, relaxed test assertions, workflow credentials and deploy behavior. Confirmed correctness or typing soundness repairs use the exception below. Park an item requiring any remaining forbidden change, with the minimal proposed change. The campaign does not ask for approval or attempt the forbidden change.

### File confirmed defects separately

This exception includes existing helper bugs found during bootstrap, runtime bugs uncovered by typing, and unsound stubs or plugin contracts. A diagnostic alone is not a confirmed bug. First prove the intended contract from callers or the dependency, then keep a minimal failing regression test. Do not reproduce customer identifiers in public artifacts.

Fetch fresh master, reproduce the issue on the campaign branch, and classify it before creating a fix branch:

| Where the defect exists | Action |
| --- | --- |
| Reproduces on freshly fetched master | Follow the master-based draft PR procedure below. |
| Blocks the campaign but is already fixed upstream | Identify and import the smallest relevant existing fix and necessary prerequisites. Prove the repair on `typing-hillclimb`. Do not open a duplicate PR or merge all of master. |
| Exists only on the campaign branch | Prove and repair it locally in a separate fix commit. If the candidate introduced it, reject or repair the candidate before acceptance. Do not create a PR for a defect master does not have. |

If the upstream fix cannot be isolated within the authorized contract, park the dependent item. A dependency's own implementation defect is reported as an external blocker or a bounded workflow workaround when no Sentry fix is appropriate. Do not manufacture a Sentry PR that changes correct code to conceal an external tool failure.

1. Stop the owned daemon. Fetch `origin master` without altering local master. Create a dedicated branch from the freshly fetched `origin/master` in `.work/wt/bug-<short-name>`. Follow `create-branch`, `commit` and `pr-writer` skill conventions, using `.work/tmp` for PR bodies. Provision a worktree-specific virtualenv through `setup-dev` when needed. Do not repoint the hillclimb's editable installation. This worktree is exclusively for the defect, not typing adoption.
2. Reproduce on that fresh base. If the issue is absent, use the upstream-fixed or branch-only route above. If it exists, fix the root cause and prove fail-before/pass-after with the narrow regression test and affected existing tests. Keep one production module per commit where possible. Do not include unrelated typing or campaign documents in the defect branch.
3. Commit the tested fix. Push only that defect branch with an explicit remote and ref. Run `gh pr create --draft --base master --head <defect-branch> --title '<title>' --body-file <absolute-repo-path>/.work/tmp/pr-body.md`. Verify the resulting PR is a draft with base `master`. Do not approve, merge, or enable auto-merge. Record the PR URL, fix commit, affected modules and checks here.
4. If typing work requires the fix, cherry-pick the verified defect commit onto `typing-hillclimb` as its own commit, then revalidate affected typing and tests. Preserve its separation from annotation commits. If it does not apply cleanly, resolve only within the proven fix contract or park dependent typing. Never merge all of master merely to import the fix.
5. Remove a clean completed defect worktree. Retain its published branch. If publication is blocked by credentials or permissions, retain the committed branch, record the concrete failure, remove the clean worktree and continue independent work. A locally verified fix may still be imported into `typing-hillclimb` under the same demonstrated fix contract. Publication failure does not block that import. The filing deliverable remains parked until the draft PR is verified.

Only this defect flow authorizes remote writes. Scope changes beyond a demonstrated bug fix remain forbidden. If a defect requires a new product decision or a forbidden migration, park it with evidence instead of guessing its contract.

## Optimization and close

Optional P6 work targets verification latency, not a new checker architecture. Compare the same configured and all-strong commands on the same source set and environment. Record warm versus cold caches and peak memory. Use three interleaved baseline and candidate runs, CPU time where useful, and report the minimum and range. Keep a change only when the gain exceeds the observed spread and no comparable case regresses more than 10%. A repeatable regression above twice baseline must be investigated even before P6 when it prevents useful verification.

Run time gates only between successful `perf-gate-ready` and `perf-gate-ready -1`. Discard a run that overlaps host load. If the host remains busy, report `perf gate deferred: host busy`; defer the optimization and do not claim campaign completion with a required gate outstanding. Memory always stays within the charter budget. There is no application binary-size or build-time change planned. If a proposed optimization would change dependencies, build products or startup behavior, park it under the contract limits.

At close, remove dead debt-processing paths only after searching callers, tests, hooks, CI and generator inputs. Retain public helper entry points still used by CI and tests, with zero-state behavior. No compatibility shim is needed for an unconsumed internal path. Review the final changes with the repository's code-review and typing bug lenses, limited to this campaign's diff. Fix P1/P2 findings or park the affected deliverable. Do not audit unrelated repository code.

## Non-goals

This campaign does not upgrade mypy or Python, introduce product behavior, convert the repository to universal strict mode, promise universal Any-free Python, build an autonomous scheduling platform, or benchmark application runtime. Ordinary typing changes stay local. Only confirmed defects reproducing on fresh master receive new draft PRs. It does not type vendored code as owned code or award credit for deleting behavior. It does not run a repository-wide cleanup or full CI by default.

## Reference: how typing currently works

The authoritative configuration is `pyproject.toml`. It configures `check_untyped_defs`, `no_implicit_reexport`, `warn_unreachable`, `warn_unused_configs`, `warn_unused_ignores`, `warn_redundant_casts`, `disallow_any_generics`, `disallow_untyped_defs`, `strict_equality`, `local_partial_types`, and error codes `ignore-without-code` and `redundant-self`.

Local stubs live in `fixtures/stubs-for-mypy`. Plugins are `pydantic.mypy`, `mypy_django_plugin.main` and `tools.mypy_helpers.plugin`. Django uses `sentry.conf.server_mypy`. Normal discovery excludes `.venv/`, `venv/`, `self-hosted/` and `bin/`. Discovery from `.` alone does not prove complete owned-source coverage.

Four override groups have different purposes:

- `snuba_sdk.*` skips following imports because published types cause errors.
- The third-party list uses `ignore_missing_imports` for dependencies without usable types.
- The generated Sentry error list disables `arg-type`, `assignment`, `attr-defined`, `misc` and `union-attr` for `sentry.snuba.metrics.query_builder` and `sentry.testutils.cases`.
- The weaklist disables `disallow_any_generics`, `disallow_untyped_defs` and `strict_equality` for many application, test, fixture and tooling modules, including wildcard patterns.

The two Sentry lists are separate debt mechanisms. Removing one does not make the other disappear. `tools/mypy_helpers/mypy_without_ignores.py` removes only the generated error section. `find_easiest_modules.py` ranks completed error diagnostics by ascending count and filename. It is a selector, not a complete debt oracle.

`make_module_ignores.py` runs the unsuppressed helper, validates its complete output, writes `.artifacts/mypy-all`, and rewrites the marked section in `pyproject.toml`. It does not clear `.mypy_cache`. Run it only with a disposable configuration because a valid run updates the debt section. Its entry point is:

```sh
.venv/bin/python -m tools.mypy_helpers.make_module_ignores
```

`check_stronglist.py` treats absent debt overrides as empty, requires a unique override when a debt key is present, and requires suppressed modules to remain weak. `prevent_weaklist_additions.py` compares literal module strings with `HEAD`, not effective settings against a supplied accepted parent. The sorter and list validator run through prek. The bypass hook catches whole-line ignores and selected other forms, but it does not reject every inline coded ignore.

Backend typing CI installs from `uv.lock` using a private package index, sets up Sentry, and runs mypy with `RuntimeWarning` as an error. After success it regenerates debt and fails on config drift or selected message patterns in `.artifacts/mypy-all`. It can auto-commit generated config on a non-master ref. Its push trigger names master. Its aggregate backend check permits skipped child jobs. Local campaign checks must reproduce the relevant guarantees without assuming an aggregate green means typing ran.

`mypy_without_ignores.py` now accepts absent error-debt markers and rebases `files` and `mypy_path` against the source root before writing its temporary config under `.work/tmp`. It rejects malformed markers before invoking mypy. `make_module_ignores.py` validates the full run summary, exit status, stderr and diagnostics before writing either output. It counts error diagnostics only and clears the active override when debt is empty. `find_easiest_modules.py` ranks errors only, by ascending count and then filename.

The custom plugin injects Any into request attributes and other types. Source annotation counts alone miss these obligations. Existing positive and negative plugin tests live in `tests/tools/mypy_helpers/test_plugin.py`; serializer tests also live in `test_typed_validated_data.py` in that directory.

Initial metadata candidates were `sentry.api.api_owners`, `sentry.api.api_publish_status` and `sentry.api.endpoints.frontend_version`. The exact-tree evaluator accepted `api_owners`; the other two remain queued. Read-only inspection found `api_owners` has no methods, `api_publish_status` has an annotated property, and `frontend_version` has an annotated endpoint method.

Read-only triage prepared the next small candidates. The P2 core gate is open; each metadata candidate still needs its own exact-tree comparison and mapped behavior coverage.

| Module | Inspection finding | Existing behavior coverage |
| --- | --- | --- |
| `sentry.api.analytics` | 30-line event declarations with typed fields and no methods | No module-specific test found |
| `sentry.api.endpoints.auth_validate` | Typed `get(Request) -> Response` method | No focused test found |
| `sentry.api.endpoints.email_capture` | Typed endpoint, with an inferred `MarketoClient` global and `request.data` boundary | `tests/sentry/api/endpoints/test_email_capture.py` |
| `sentry.api.endpoints.system_health` | Typed endpoint; response types flow from status checks | No focused test found |
| `sentry.api.endpoints.warmup` | Typed helpers and endpoint; uses Django's private resolver cache | No focused test found |

Existing runtime suites include `tests/sentry/api/test_api_owners.py`, `tests/apidocs/test_hooks.py` for publish status, and `tests/sentry/api/endpoints/test_frontend_version.py`. Static inspection does not establish that a candidate is clean.

Editor integrations must use this virtualenv and `pyproject.toml`. Confirm errors with the repository mypy command because another language server may not load Sentry's plugins.

## Decision log

Append one line per consequential executor judgment: item, decision, evidence and reason. Do not repeat policy or record every command here.

- 2026-10-14: independent review of the range through `4a3e00a8` (15 commits: 15 weaklist removals plus two initializer annotations in `sentry.exceptions`) found the edits reasonable but the recorded verification thinner than the written campaign: no P2 evaluator exists yet, so unsuppressed/all-strong comparisons never ran and promotions preceded the prescribed bootstrap. Keep the commits; checkpoint before further source-changing work.
- 2026-10-14: verification is now selected by change class (see policy section): a config-only series may share one full configured checkpoint; annotation items need behavior tests plus debt comparison once P2 operates; import/`TYPE_CHECKING`/decorator/stub/plugin edits additionally need fresh-process startup with registration assertions. `--no-warn-unused-configs` stays for focused runs; positional-filename scope is not full-repo proof.
- 2026-10-14: owner authorized staggered item lanes in isolated `.work/wt/` worktrees after the P2 core gate. Keep shared weaklist edits and repository checker runs serialized; integrate only exact-tree-accepted candidates.
- 2026-10-14: sweep pivots from empty/tiny weaklist entries to ranked modules needing real annotation; trivial removals retire real obligations but do not demonstrate hillclimb progress on genuine debt.
- 2026-10-14: P1 keeps mypy generation non-mutating on crashes, stderr, incomplete summaries and malformed markers. Error ranking ignores notes and sorts ascending so the lowest-debt modules appear first.
- 2026-10-14: P2 compares effective options using installed mypy 2.1.0 fields. It records source targets and rejects count or graph mismatches. This keeps an incomplete adapter response from passing as a full profile. Git 2.54 rejects `git ls-tree --format=%(mode)`; use its supported `%(objectmode)` field and keep a temporary-repository regression test. Path relocation applies replacements from highest to lowest source offset because actual config order places `mypy_path` before `files`.

## Campaign log

Append one short entry per phase and parked item. Include accepted commits, changed contracts, exact verification commands, outcomes, elapsed times, remaining obligations and retry conditions. Keep raw transient checker output in scratch. Persist only the findings needed to resume or assess the campaign.

- 2026-10-14 checkpoint: full configured mypy over the branch passes with zero issues in 8229 source files. Ran with `--num-workers 2` as a documented deviation (7.65 GiB available was below the 8 GiB reserve). Unsuppressed/all-strong parent/candidate comparisons remain pending on the P2 evaluator gate. `test_startup_imports` passes; `python -m sentry --help` is clean with 35 commands registered. Commits after the reviewed range (`ingest.types`, `github.constants`, `middleware.placeholder`, `tempest.apps`, `testutils.helpers.discover`, `testutils.middleware`, `search.exceptions`, `db.models.fields.onetoone`) each carry focused mypy plus behavior or consumer checks in their messages; the full-repo result above covers them for the configured profile only.
- 2026-10-14 checkpoint 2: full configured mypy again green (8229 files, `--num-workers 2`), covering Lane D commits (`testutils.helpers.auth_header` annotated; `utils.cache`, `utils.flag`, `web.constants` metadata-only). `sentry.db.analyze` parked: zero callers, needs `type[Model]` plus new `Any` for the cursor return — owner call whether to type or delete. Four medium worker lanes fanned out for the next 20 modules; coordinator remains single writer.
- 2026-10-14 checkpoint 3: full configured mypy green (8231 files, `--num-workers 2`), covering Lanes A/B/C serializer, endpoint, and view promotions. Checker behaviors learned: bare `return` in a `-> X | None` body errors (spell `return None`, identical behavior); `== ""` does not narrow `list[str] | str` (narrow `ignore[arg-type]` with reason instead of restructuring); `TYPE_CHECKING` annotations require future annotations or they crash at import; `class_name() ==` does not narrow unions (use `isinstance`). Lane flow corrected two lane proposals (unused `ignore[override]` dropped on `project_event`; `list.py` ignore added) and added first contract tests for `actor` and `project_reprocessing`.
- 2026-10-14 P1: helper hardening changed generator failure behavior, made notes non-debt, removed active error overrides at zero debt, accepted absent debt overrides, and rebased temporary config paths. `TMPDIR=/Users/josh/dev/sentry/.work/tmp .venv/bin/pytest --basetemp=.work/tmp/pytest-p1-corpus -q tests/tools/mypy_helpers` passed 101 tests in 80.99 seconds. The focused new harness passed 29 tests in 0.48 seconds. Ruff and `git diff --check` passed. The targeted configured mypy run passed for seven helper modules. Its stderr included local option and SDK warnings; P2 must preserve and classify them before accepting profile measurements. No source promotion was included. The full helper corpus took 80.99 seconds; keep using the focused helper selector for iteration and the corpus for phase acceptance.
- 2026-10-14 P2 implementation checkpoint (`2303e7e35df`): the evaluator now measures configured, unsuppressed and all-strong profiles, audits each owned source against its build graph, compares debt and effective settings, and rejects new bypasses and Any obligations. It validates the target manifest against checked graph entries. Precision extraction is available per changed source tree; the synthetic imported/plugin Any canary matches CLI diagnostics. `TMPDIR=/Users/josh/dev/sentry/.work/tmp .venv/bin/pytest --basetemp=.work/tmp/pytest-p2-focused-final -q tests/tools/mypy_helpers/test_typing_campaign.py` passed 27 tests in 2.79 seconds. The first full helper corpus passed 128 tests in 63.16 seconds; after the Git compatibility regression test was added, a parallel corpus run had one isolated HTTP request plugin failure (128 passed), while the failing node passed alone and the serial full corpus passed all 129 tests in 88.20 seconds. Targeted mypy passed for `typing_campaign.py`, `mypy_output.py` and `test_typing_campaign.py`; Ruff, the bypass hook, `py_compile` and `git diff --check` passed. No repository-wide core or precision baseline has run yet. No promotion used this evaluator.
- 2026-10-14 P2 baseline bootstrap: the first baseline attempt stopped before mypy because Git rejected `%(mode)`; `c8272f058ec` switches to `%(objectmode)` and adds a temporary-repository regression test. The retry stopped before mypy because path relocation corrupted TOML when `mypy_path` precedes `files`; the config regression test reproduced it, then passed after replacements were ordered by source position. `TMPDIR=/Users/josh/dev/sentry/.work/tmp .venv/bin/pytest --reuse-db -n0 --basetemp=.work/tmp/pytest-p2-config-order-corpus -q tests/tools/mypy_helpers` passed 129 tests in 88.43 seconds. Targeted mypy and read-only Ruff passed for `mypy_config.py` and its test. No repository-wide configured, unsuppressed or all-strong baseline has completed; precision remains unmeasured. `perf-gate-ready` reported load 8.40 on 10 cores, so no elapsed time from these runs is performance evidence. No promotion used the evaluator.
- 2026-10-14 P2 baseline retry: the configured profile ran, then the evaluator rejected the known SDK setup warning because Python printed its source line as `warnings.warn(` while the parser expected `warnings.warn()`. The parser now accepts those two exact source lines and still rejects unexpected lines. `TMPDIR=/Users/josh/dev/sentry/.work/tmp .venv/bin/pytest --reuse-db -n0 --basetemp=.work/tmp/pytest-p2-sdk-warning-corpus -q tests/tools/mypy_helpers` passed 132 tests in 84.46 seconds. Read-only Ruff and targeted mypy passed for the evaluator, config helper and test. This baseline remains invalid; retry with a fresh output directory. Performance timings remain untrusted while the host gate is busy. No promotion used the evaluator.
- 2026-10-14 P2 note accounting: retry 3 reached configured mypy but rejected a note-only unused override diagnostic as an error. The adapter now filters parsed notes before creating debt records and normalizes profile status to error diagnostics. The precision adapter test includes an unused `P4` override, checks that a configured note-only profile has status 0 and no debt, then checks precision extraction. `TMPDIR=/Users/josh/dev/sentry/.work/tmp .venv/bin/pytest --reuse-db -n0 --basetemp=.work/tmp/pytest-p2-mypy-notes-final-corpus -q tests/tools/mypy_helpers` passed 132 tests in 83.06 seconds. Read-only Ruff and targeted mypy passed. No repository-wide core baseline has completed; retry with a fresh output directory. No promotion used the evaluator.
- 2026-10-14 P2 coverage throughput: the repo inventory has 270 standalone Python targets. The interrupted configured baseline had created 55 audit directories after about 11 minutes; it was not accepted. Standalone targets are now grouped in batches of 8 and remain serial, reducing the expected per-profile launch count from 270 to 34 while preserving target and graph validation. The integration test checks 9 sources across 2 batches. `TMPDIR=/Users/josh/dev/sentry/.work/tmp .venv/bin/pytest --reuse-db -n0 --basetemp=.work/tmp/pytest-p2-standalone-batches-corpus -q tests/tools/mypy_helpers` passed 133 tests in 83.73 seconds. Read-only Ruff and targeted mypy passed. The host performance gate was busy, so the partial elapsed time is not a performance result. Core baseline remains pending; retry with a fresh output directory.
- 2026-10-14 P2 soundness hardening (`f50802f8696`): generated mypy debt sections are schema-checked and all other config policy must match before measurements; vendor-like path names default to owned; namespace package directories are not source gaps; wildcard typing imports fail closed; existing signature omissions and residual suppressions remain measured debt rather than invalidating the core baseline. Focused evaluator tests passed 47 cases and the helper corpus passed 148 tests in 80.05 seconds. Targeted mypy, read-only Ruff, and `git diff --check` passed.
- 2026-10-14 P2 core baseline: `TMPDIR=/Users/josh/dev/sentry/.work/tmp PYTHONWARNINGS=error::RuntimeWarning .venv/bin/python -m tools.mypy_helpers.typing_campaign baseline --output .work/tmp/p2-baseline-20261014-hardened` completed for `f50802f8696`, with 0 core coverage gaps and 8,266/8,266 source paths covered. Configured/unsuppressed/all-strong reported 33/77/3,224 diagnostics, with profile elapsed times 188/183/180 seconds and peak RSS at most 3.24 GB. The 9,902 AST Any obligations, 24,796 signature omissions, 1,882 bypasses, 11,613 weak pairs, and 11 suppressions remain debt, not measurement failures. Precision canaries passed; repo-wide precision remains unmeasured. The baseline used four standalone batches per profile; the earlier 34-batch estimate assumed all 270 standalone sources were missing from the primary graph. No candidate promotion has yet passed repo-wide parent/candidate comparison.
- 2026-10-14 P2 acceptance repair: the first exact-tree comparison completed all six parent/candidate core profiles but failed postprocessing on an owned generated migration whose inventory module is absent. The evaluator now reads module identity from mypy's graph for owned generated paths, compares configured diagnostics against the parent, rejects added generated weak or suppression pairs, and checks the committed evaluator policy. Regression tests cover each case, including unmatched module patterns and new suppression codes. The evaluator test file passed 57 tests. The serial helper corpus passed 158 tests in 89.45 seconds. Targeted mypy, Ruff, and `git diff --check` passed. Saved profile outputs do not record enough evaluator or tree-integrity data for safe reuse, so the exact candidate comparison must run again. Do not promote until that comparison passes. This infrastructure repair receives no adoption credit.
- 2026-10-14 P2 exact-tree acceptance: `TMPDIR=/Users/josh/dev/sentry/.work/tmp PYTHONWARNINGS=error::RuntimeWarning .venv/bin/python -m tools.mypy_helpers.typing_campaign evaluate --parent a14fe390435 --candidate-tree 77e271e946fd3e2fd91a95f7d3c72a18122a9018 --output .work/tmp/p2-eval-api-owners-repaired` accepted commit `9c28a9c57d912098957f1dafb7319ce4db519df1` with adoption credit and no configured, unsuppressed, or all-strong additions. It removed three weak option pairs for `sentry.api.api_owners`; profile totals remained 33/77/3,224. Core coverage was complete across 8,266 paths. Precision remains incomplete.
- 2026-10-14 P2 loop improvement: added fail-closed same-evaluation reuse for a candidate whose only changed path is `pyproject.toml` and whose weaklist-cleared policy, source inventory, and source digests match the just-measured parent. Candidate configured and unsuppressed profiles still run; only candidate all-strong checking is reused, with explicit parent-tree provenance. Identical source contracts also reuse the in-memory parent analysis when precision is absent on both sides. Reuse cannot load older artifacts and falls back to fresh evaluation whenever its invariants differ. `TMPDIR=/Users/josh/dev/sentry/.work/tmp .venv/bin/pytest --basetemp=.work/tmp/pytest-p2-reuse -q tests/tools/mypy_helpers/test_typing_campaign.py` passed 59 tests in 7.96 seconds; read-only Ruff, targeted mypy, and `git diff --check` passed. This infrastructure change earns no adoption credit.

## For the owner afterwards

- Read the final campaign log for core and precision results, contract changes, external Any boundaries and parked blockers.
- Inspect the local typing commits on `typing-hillclimb`, one module per ordinary commit with any demonstrated atomic exceptions recorded. Review the separate draft PRs listed for confirmed defects. Any defect required by the hillclimb is imported as its own fix commit.
- A parked deliverable requires a new instruction only if you want to authorize its forbidden contract change. The executor finishes all independent authorized work first.

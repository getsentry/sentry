from __future__ import annotations

import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest

from tools.mypy_helpers.typing_campaign import (
    AnyObligation,
    Decision,
    DiagnosticRecord,
    ExitCode,
    InvalidMeasurement,
    ModuleState,
    Outcome,
    Profile,
    ProfileMeasurement,
    SourceFile,
    SourceKind,
    TreeMeasurement,
    _command_compare,
    _coverage_audits,
    _coverage_gaps,
    _diagnostic_record,
    _effective_pairs,
    _known_environment_warnings,
    _mypy_config_policy,
    _run_precision_canaries,
    _source_contracts,
    _validate_targets,
    classify_source,
    compare_error_debt,
    decide_candidate,
    decide_terminal,
    main,
    profile_config,
    run_profile,
    tree_inventory,
)


def _profile(
    profile: Profile,
    diagnostics: tuple[DiagnosticRecord, ...] = (),
    graph: tuple[ModuleState, ...] = (),
) -> ProfileMeasurement:
    return ProfileMeasurement(
        profile,
        "tree",
        int(bool(diagnostics)),
        1,
        diagnostics,
        graph,
        (),
        (),
        0.0,
        None,
        Path(".work/tmp/test"),
    )


def _tree(
    *,
    weak: frozenset[tuple[str, str]] = frozenset(),
    suppressed: frozenset[tuple[str, str]] = frozenset(),
    diagnostics: tuple[DiagnosticRecord, ...] = (),
    bypasses: frozenset[tuple[str, str]] = frozenset(),
    omissions: frozenset[tuple[str, str, str]] = frozenset(),
    any_obligations: frozenset[AnyObligation] = frozenset(),
    source_digests: dict[str, str] | None = None,
    signatures: dict[tuple[str, str, str], str] | None = None,
    graph: tuple[ModuleState, ...] = (),
    profiles: tuple[Profile, ...] = (
        Profile.CONFIGURED,
        Profile.UNSUPPRESSED,
        Profile.ALL_STRONG,
    ),
) -> TreeMeasurement:
    inventory = (SourceFile("src/sentry/example.py", "sentry.example", SourceKind.OWNED_IMPLEMENTATION),)
    return TreeMeasurement(
        "revision",
        "tree",
        Path(".work/tmp/snapshot"),
        inventory,
        {
            profile: _profile(
                profile,
                diagnostics if profile == Profile.ALL_STRONG else (),
                graph,
            )
            for profile in profiles
        },
        (),
        (),
        weak,
        suppressed,
        bypasses,
        signatures or {},
        omissions,
        any_obligations,
        frozenset({"src/sentry/example.py"}),
        source_digests or {"src/sentry/example.py": "unchanged"},
    )


def test_absent_migration_sections_derive_all_strong_profile() -> None:
    source = "[tool.mypy]\nstrict = true\n"

    assert profile_config(source, Profile.ALL_STRONG, Path("/candidate")) == source


def test_all_strong_derivation_clears_both_migration_sections() -> None:
    source = """\
[tool.mypy]
strict = true
# begin: sentry modules with typing issues
[[tool.mypy.overrides]]
module = ["sentry.a"]
disable_error_code = ["misc"]
# end: sentry modules with typing issues
# begin: not yet strongly typed
[[tool.mypy.overrides]]
module = ["sentry.a"]
disallow_untyped_defs = false
# end: not yet strongly typed
"""

    derived = profile_config(source, Profile.ALL_STRONG, Path("/candidate"))

    assert "module = [\"sentry.a\"]" not in derived
    assert "disallow_untyped_defs = false" not in derived
    assert "strict = true" in derived


def test_default_source_classification_keeps_unrecognized_paths_owned() -> None:
    record = classify_source(".tools/custom.py")

    assert record.kind == SourceKind.OWNED_IMPLEMENTATION
    assert record.module is None


@pytest.mark.parametrize(
    ("path", "kind"),
    (
        ("src/sentry/vendor/new_logic.py", SourceKind.OWNED_IMPLEMENTATION),
        ("src/sentry/third_party/new_logic.py", SourceKind.OWNED_IMPLEMENTATION),
        ("tools/vendor/new_stub.pyi", SourceKind.OWNED_STUB),
    ),
)
def test_vendor_named_paths_default_to_owned(path: str, kind: SourceKind) -> None:
    assert classify_source(path).kind == kind


def test_coverage_ignores_namespace_package_graph_nodes_but_rejects_unknown_sources() -> None:
    source = classify_source("src/sentry/example.py")
    checked_source = ModuleState(
        "sentry.example",
        source.path,
        True,
        True,
        False,
        (),
        (),
        "normal",
        "False",
        (),
    )
    namespace_package = ModuleState(
        "sentry.namespace",
        "src/sentry/namespace",
        True,
        True,
        False,
        (),
        (),
        "normal",
        "False",
        (),
    )
    unknown_source = ModuleState(
        "sentry.unknown",
        "src/sentry/unknown.py",
        True,
        True,
        False,
        (),
        (),
        "normal",
        "False",
        (),
    )

    assert _coverage_gaps((source,), (checked_source, namespace_package)) == ()
    assert any(
        "src/sentry/unknown.py" in gap
        for gap in _coverage_gaps((source,), (checked_source, unknown_source))
    )


@pytest.mark.parametrize("typing_module", ("typing", "typing_extensions"))
def test_typing_wildcard_import_fails_closed(
    tmp_path: Path, typing_module: str
) -> None:
    source_path = "src/sentry/example.py"
    source_file = tmp_path / source_path
    source_file.parent.mkdir(parents=True)
    source_file.write_text(f"from {typing_module} import *\n")

    bypasses, _, _, any_obligations = _source_contracts(source_path, tmp_path)

    anchor = f"typing-wildcard-import:{typing_module}#1"
    assert (source_path, anchor) in bypasses
    assert AnyObligation(
        source_path,
        anchor,
        "unresolved-imported-typing-names",
        "unknown-typing-wildcard",
    ) in any_obligations


def test_generated_mypy_sections_do_not_change_trusted_policy() -> None:
    parent = """\
[tool.mypy]
python_version = "3.13"
plugins = ["tools.mypy_helpers.plugin"]
mypy_path = ["fixtures/stubs-for-mypy"]
[[tool.mypy.overrides]]
module = ["external_package.*"]
follow_imports = "normal"
# begin: sentry modules with typing issues
[[tool.mypy.overrides]]
module = ["sentry.example"]
disable_error_code = ["misc"]
# end: sentry modules with typing issues
# begin: not yet strongly typed
[[tool.mypy.overrides]]
module = ["sentry.example"]
disallow_any_generics = false
disallow_untyped_defs = false
strict_equality = false
# end: not yet strongly typed
"""
    candidate = parent.replace('"sentry.example"', '"sentry.updated"')

    assert _mypy_config_policy(parent) == _mypy_config_policy(candidate)


@pytest.mark.parametrize(
    ("old", "new"),
    (
        ('python_version = "3.13"', 'python_version = "3.12"'),
        ('plugins = ["tools.mypy_helpers.plugin"]', 'plugins = []'),
        (
            'mypy_path = ["fixtures/stubs-for-mypy"]',
            'mypy_path = ["fixtures/other-stubs"]',
        ),
        ('follow_imports = "normal"', 'follow_imports = "silent"'),
    ),
)
def test_non_debt_mypy_settings_change_trusted_policy(old: str, new: str) -> None:
    source = (
        "[tool.mypy]\n"
        'python_version = "3.13"\n'
        'plugins = ["tools.mypy_helpers.plugin"]\n'
        'mypy_path = ["fixtures/stubs-for-mypy"]\n'
        '[[tool.mypy.overrides]]\n'
        'module = ["external_package.*"]\n'
        'follow_imports = "normal"\n'
    )

    assert _mypy_config_policy(source.replace(old, new)) != _mypy_config_policy(source)


def test_generated_mypy_section_rejects_unapproved_override_fields() -> None:
    source = """\
[tool.mypy]
# begin: sentry modules with typing issues
[[tool.mypy.overrides]]
module = ["sentry.example"]
disable_error_code = ["misc"]
ignore_missing_imports = true
# end: sentry modules with typing issues
"""

    with pytest.raises(InvalidMeasurement, match="unsupported override fields"):
        _mypy_config_policy(source)


def test_candidate_policy_rejection_precedes_measurement(tmp_path: Path) -> None:
    with (
        patch(
            "tools.mypy_helpers.typing_campaign.resolve_tree",
            return_value=("parent-revision", "parent-tree"),
        ),
        patch(
            "tools.mypy_helpers.typing_campaign._resolve_candidate_tree",
            return_value=("candidate-revision", "candidate-tree"),
        ),
        patch("tools.mypy_helpers.typing_campaign._assert_trusted_policy"),
        patch(
            "tools.mypy_helpers.typing_campaign._policy_changes",
            return_value=("pyproject.toml",),
        ),
        patch("tools.mypy_helpers.typing_campaign._changed_source_paths") as changed_sources,
        patch("tools.mypy_helpers.typing_campaign._measure_tree") as measure_tree,
    ):
        exit_code, report = _command_compare(
            Path("."),
            tmp_path,
            command="guard",
            parent_reference="parent",
            candidate_reference="candidate",
        )

    assert exit_code == ExitCode.REJECTED
    assert report["outcome"] == Outcome.REJECTED.value
    assert report["reasons"] == ["candidate changes evaluator policy: pyproject.toml"]
    changed_sources.assert_not_called()
    measure_tree.assert_not_called()


def test_preexisting_typing_debt_does_not_invalidate_candidate_comparison() -> None:
    omissions = frozenset({("src/sentry/example.py", "sentry.example.run#1", "return")})
    suppressed = frozenset({("sentry.example", "type-arg")})
    parent = _tree(omissions=omissions, suppressed=suppressed)
    candidate = _tree(omissions=omissions, suppressed=suppressed)

    decision = decide_candidate(parent, candidate, require_adoption_credit=False)

    assert decision.outcome == Outcome.COMPLETE
    assert decision.core_complete


def test_tree_inventory_reads_supported_git_tree_modes(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    source = repository / "src" / "sentry" / "example.py"
    source.parent.mkdir(parents=True)
    source.write_text("value = 1\n")
    subprocess.run(("git", "init", "-q"), cwd=repository, check=True)
    subprocess.run(("git", "add", "src/sentry/example.py"), cwd=repository, check=True)
    tree = subprocess.run(
        ("git", "write-tree"), cwd=repository, capture_output=True, check=True, text=True
    ).stdout.strip()

    inventory = tree_inventory(repository, tree, repository)

    assert inventory == (
        SourceFile("src/sentry/example.py", "sentry.example", SourceKind.OWNED_IMPLEMENTATION),
    )


@pytest.mark.parametrize("source_line", ("  warnings.warn(", "  warnings.warn()"))
def test_known_environment_warnings_classifies_sentry_sdk_warning(source_line: str) -> None:
    output = (
        "/checkout/src/sentry/utils/sdk.py:420: Warning: Sentry SDK not initialized: no DSN available. "
        "Set `backend_dsn` in SENTRY_SDK_CONFIG or ensure an internal project key exists.\n"
        f"{source_line}\n"
    )

    assert _known_environment_warnings(output) == (
        "Sentry SDK setup warning: no DSN is configured",
    )


def test_known_environment_warnings_rejects_unexpected_sdk_source_line() -> None:
    output = (
        "/checkout/src/sentry/utils/sdk.py:420: Warning: Sentry SDK not initialized: no DSN available. "
        "Set `backend_dsn` in SENTRY_SDK_CONFIG or ensure an internal project key exists.\n"
        "  warnings.warn(message)\n"
    )

    with pytest.raises(InvalidMeasurement, match="incomplete Sentry SDK warning"):
        _known_environment_warnings(output)


def test_relative_diagnostic_paths_resolve_inside_snapshot(tmp_path: Path) -> None:
    root = tmp_path / "snapshot"
    (root / "src" / "sentry").mkdir(parents=True)

    diagnostic = _diagnostic_record(
        "src/sentry/example.py:4: error: invalid value [arg-type]",
        root,
    )

    assert diagnostic.path == "src/sentry/example.py"
    assert diagnostic.message == "invalid value"


def test_explicit_any_and_bypass_audits_follow_import_aliases(tmp_path: Path) -> None:
    root = tmp_path / "snapshot"
    root.mkdir()
    source = """\
from typing import Any as Dynamic, Dict as Dictionary, TypeAlias

DynamicAlias: TypeAlias = Dynamic

def consume(value: Dynamic) -> Dictionary[str, Dynamic]:
    return {"value": value}
"""
    (root / "src").mkdir()
    (root / "src" / "example.py").write_text(source)

    bypasses, _, _, obligations = _source_contracts("src/example.py", root)

    assert len(obligations) == 3
    assert any("broad-dict-any" in bypass for _, bypass in bypasses)


def test_no_type_check_alias_is_a_bypass(tmp_path: Path) -> None:
    root = tmp_path / "snapshot"
    root.mkdir()
    source = (
        "from typing import no"
        + "_type_check as unchecked\n\n@unchecked\ndef run():\n    pass\n"
    )
    path = "src/example.py"
    (root / path).parent.mkdir(parents=True, exist_ok=True)
    (root / path).write_text(source)

    bypasses, _, _, _ = _source_contracts(path, root)

    assert any("no-type-check:" in bypass for _, bypass in bypasses)


def test_error_debt_sorting_handles_missing_and_present_codes() -> None:
    additions = compare_error_debt(
        (),
        (
            DiagnosticRecord("src/sentry/example.py", None, "missing code"),
            DiagnosticRecord("src/sentry/example.py", "arg-type", "typed code"),
        ),
    )

    assert {item.message for item in additions} == {"missing code", "typed code"}


def test_any_obligation_key_sorts_absent_and_present_exceptions() -> None:
    obligations = (
        AnyObligation("src/a.py", "anchor", "return", "explicit", "approved"),
        AnyObligation("src/a.py", "anchor", "return", "explicit"),
    )

    assert sorted(obligations, key=lambda item: item.key)


def test_adapter_target_count_must_match_target_manifest() -> None:
    with pytest.raises(InvalidMeasurement, match="target count mismatch"):
        _validate_targets(
            2,
            [{"module": "sentry.example", "path": "/snapshot/src/sentry/example.py"}],
            (),
            Path("/snapshot"),
        )


def test_precision_adapter_exports_stable_any_obligations(tmp_path: Path) -> None:
    root = tmp_path / "snapshot"
    package = root / "src" / "sentry"
    package.mkdir(parents=True)
    (package / "__init__.py").write_text("")
    (package / "example.py").write_text(
        "from typing import Any\n\n\ndef identity(value: Any) -> Any:\n    return value\n"
    )
    (root / "pyproject.toml").write_text(
        "[tool.mypy]\n"
        "python_version = '3.13'\n"
        "files = ['src/sentry']\n"
        "mypy_path = ['src']\n"
        "namespace_packages = true\n"
        "explicit_package_bases = true\n"
        "warn_unused_configs = true\n"
        "[[tool.mypy.overrides]]\n"
        "module = ['P4']\n"
        "ignore_missing_imports = true\n"
    )
    output = tmp_path / "measurements"
    output.mkdir()

    configured = run_profile(
        Profile.CONFIGURED,
        root,
        "synthetic-tree",
        output,
        label="configured",
        timeout_seconds=120,
    )

    assert "unused section(s)" in (configured.output_dir / "worker.stdout").read_text()
    assert configured.checker_status == 0
    assert configured.diagnostics == ()

    measurement = run_profile(
        Profile.PRECISION,
        root,
        "synthetic-tree",
        output,
        timeout_seconds=120,
    )

    assert measurement.adapter_status == 0
    assert measurement.checker_status in (0, 1)
    assert all("unused section(s)" not in item.message for item in measurement.diagnostics)
    assert any(item.origin == "explicit" for item in measurement.any_obligations)
    assert all(not item.anchor.startswith("unanchored:") for item in measurement.any_obligations)
    assert any(item.path == "src/sentry/example.py" for item in measurement.diagnostics)
    state = next(state for state in measurement.graph if state.module == "sentry.example")
    assert state.checked
    assert "implicit_reexport" in dict(state.effective_options)
    assert "no_implicit_reexport" not in dict(state.effective_options)


def test_coverage_audits_batch_standalone_sources(tmp_path: Path) -> None:
    root = tmp_path / "snapshot"
    package = root / "src" / "sentry"
    package.mkdir(parents=True)
    (package / "__init__.py").write_text("")
    standalone_paths = tuple(f"bin/script_{index}.py" for index in range(9))
    for path in standalone_paths:
        source_path = root / path
        source_path.parent.mkdir(parents=True, exist_ok=True)
        source_path.write_text("value: int = 1\n")
    (root / "pyproject.toml").write_text(
        "[tool.mypy]\n"
        "python_version = '3.13'\n"
        "files = ['src/sentry']\n"
        "mypy_path = ['src']\n"
        "namespace_packages = true\n"
        "explicit_package_bases = true\n"
    )
    output = tmp_path / "measurements"
    output.mkdir()
    primary_output = output / "configured"
    primary_output.mkdir()
    primary = ProfileMeasurement(
        Profile.CONFIGURED,
        "synthetic-tree",
        0,
        1,
        (),
        (
            ModuleState(
                "sentry",
                "src/sentry/__init__.py",
                True,
                True,
                False,
                (),
                (),
                "normal",
                "normal",
                (),
            ),
        ),
        (),
        (),
        0.0,
        None,
        primary_output,
    )
    inventory = (
        classify_source("src/sentry/__init__.py"),
        *(classify_source(path) for path in standalone_paths),
    )

    measured = _coverage_audits(primary, inventory, root, "synthetic-tree", output)

    checked_paths = {
        state.path for state in measured.graph if state.ast_retained and state.checked
    }
    assert set(standalone_paths).issubset(checked_paths)
    assert len(list(output.glob("configured-standalone-*"))) == 2


def test_precision_canaries_cover_imported_plugin_any_and_cli_parity(tmp_path: Path) -> None:
    calibration = _run_precision_canaries(tmp_path)

    assert calibration["complete"]
    assert isinstance(calibration["any_origins"], list)
    assert {"explicit", "special_form"}.issubset(calibration["any_origins"])
    assert calibration["invalid_call_rejected"]
    assert calibration["api_cli_diagnostics_match"]


def test_evaluate_rejects_candidate_with_unchanged_debt() -> None:
    measurement = _tree(weak=frozenset({("sentry.example", "disallow_untyped_defs")}))

    decision = decide_candidate(measurement, measurement, require_adoption_credit=True)

    assert decision.outcome == Outcome.REJECTED
    assert "candidate removes no measured typing debt" in decision.reasons
    assert not decision.adoption_credit


def test_guard_accepts_unchanged_debt_without_adoption_credit() -> None:
    measurement = _tree(weak=frozenset({("sentry.example", "disallow_untyped_defs")}))

    decision = decide_candidate(measurement, measurement, require_adoption_credit=False)

    assert decision.outcome == Outcome.COMPLETE, decision.reasons
    assert not decision.adoption_credit


def test_evaluate_accepts_removed_effective_weak_pair() -> None:
    parent = _tree(weak=frozenset({("sentry.example", "disallow_untyped_defs")}))
    candidate = _tree()

    decision = decide_candidate(parent, candidate, require_adoption_credit=True)

    assert decision.outcome == Outcome.COMPLETE
    assert decision.adoption_credit


def test_evaluate_rejects_debt_removal_across_multiple_modules() -> None:
    parent = _tree(
        weak=frozenset(
            {
                ("sentry.example", "disallow_untyped_defs"),
                ("sentry.other", "disallow_untyped_defs"),
            }
        )
    )
    candidate = _tree()

    decision = decide_candidate(parent, candidate, require_adoption_credit=True)

    assert decision.outcome == Outcome.REJECTED
    assert any("across modules" in reason for reason in decision.reasons)


def test_new_all_strong_diagnostic_rejects_candidate() -> None:
    parent = _tree()
    candidate = _tree(
        diagnostics=(DiagnosticRecord("src/sentry/example.py", "arg-type", "incompatible"),)
    )

    decision = decide_candidate(parent, candidate, require_adoption_credit=False)

    assert decision.outcome == Outcome.REJECTED
    assert any("new all-strong error" in reason for reason in decision.reasons)


def test_guard_rejects_weaker_effective_global_option() -> None:
    state = ModuleState(
        "sentry.example",
        "src/sentry/example.py",
        True,
        True,
        False,
        (),
        (),
        "normal",
        "normal",
        (("implicit_reexport", "False"),),
    )
    weakened_state = ModuleState(
        "sentry.example",
        "src/sentry/example.py",
        True,
        True,
        False,
        (),
        (),
        "normal",
        "normal",
        (("implicit_reexport", "True"),),
    )
    parent = _tree(graph=(state,))
    candidate = _tree(graph=(weakened_state,))

    decision = decide_candidate(parent, candidate, require_adoption_credit=False)

    assert decision.outcome == Outcome.REJECTED
    assert any("new effective weakening" in reason for reason in decision.reasons)


def test_guard_rejects_changed_effective_import_policy() -> None:
    parent_state = ModuleState(
        "sentry.example",
        "src/sentry/example.py",
        True,
        True,
        False,
        (),
        (),
        "normal",
        "False",
        (("follow_imports", "normal"), ("follow_imports_for_stubs", "False")),
    )
    candidate_state = ModuleState(
        "sentry.example",
        "src/sentry/example.py",
        True,
        True,
        False,
        (),
        (),
        "silent",
        "False",
        (("follow_imports", "silent"), ("follow_imports_for_stubs", "False")),
    )

    decision = decide_candidate(
        _tree(graph=(parent_state,)),
        _tree(graph=(candidate_state,)),
        require_adoption_credit=False,
    )

    assert decision.outcome == Outcome.REJECTED
    assert any("changed effective import policy" in reason for reason in decision.reasons)


def test_effective_pairs_captures_stub_import_skips() -> None:
    source = SourceFile("src/sentry/example.pyi", "sentry.example", SourceKind.OWNED_STUB)
    state = ModuleState(
        "sentry.example",
        source.path,
        False,
        True,
        True,
        ("follow_imports_for_stubs=true",),
        (),
        "skip",
        "True",
        (("follow_imports", "skip"), ("follow_imports_for_stubs", "True")),
    )

    weak, _ = _effective_pairs((source,), (state,))

    assert ("sentry.example", "follow_imports=skip") in weak
    assert ("sentry.example", "follow_imports_for_stubs=true") in weak


def test_new_any_obligation_rejects_candidate() -> None:
    parent = _tree()
    candidate = _tree(
        any_obligations=frozenset(
            {AnyObligation("src/sentry/example.py", "ast:abc#0", "return", "explicit")}
        )
    )

    decision = decide_candidate(parent, candidate, require_adoption_credit=False)

    assert decision.outcome == Outcome.REJECTED
    assert any("new Any obligation" in reason for reason in decision.reasons)


def test_source_changes_are_rejected_without_calibrated_precision() -> None:
    parent = _tree()
    candidate = _tree(source_digests={"src/sentry/example.py": "changed"})

    decision = decide_candidate(parent, candidate, require_adoption_credit=False)

    assert decision.outcome == Outcome.REJECTED
    assert not decision.precision_complete
    assert any("calibrated precision extraction" in reason for reason in decision.reasons)


def test_truthful_read_only_input_widening_is_accepted_with_precision() -> None:
    key = ("src/sentry/example.py", "sentry.example.consume#1", "parameter:values")
    parent = _tree(
        weak=frozenset({("sentry.example", "disallow_untyped_defs")}),
        signatures={key: "list[int]"},
        source_digests={"src/sentry/example.py": "before"},
        profiles=tuple(Profile),
    )
    candidate = _tree(
        signatures={key: "Sequence[int]"},
        source_digests={"src/sentry/example.py": "after"},
        profiles=tuple(Profile),
    )

    decision = decide_candidate(
        parent,
        candidate,
        require_adoption_credit=True,
        precision_calibrated=True,
    )

    assert decision.outcome == Outcome.COMPLETE, decision.reasons
    assert decision.adoption_credit
    assert decision.precision_complete


def test_return_broadening_is_rejected_even_with_precision() -> None:
    key = ("src/sentry/example.py", "sentry.example.lookup#1", "return")
    parent = _tree(
        signatures={key: "User"},
        source_digests={"src/sentry/example.py": "before"},
        profiles=tuple(Profile),
    )
    candidate = _tree(
        signatures={key: "object"},
        source_digests={"src/sentry/example.py": "after"},
        profiles=tuple(Profile),
    )

    decision = decide_candidate(
        parent,
        candidate,
        require_adoption_credit=False,
        precision_calibrated=True,
    )

    assert decision.outcome == Outcome.REJECTED
    assert any("precision-erasing signature change" in reason for reason in decision.reasons)


def test_new_owned_source_cannot_hide_missing_signatures() -> None:
    parent = _tree()
    candidate = _tree(
        source_digests={
            "src/sentry/example.py": "unchanged",
            "src/sentry/new_module.py": "new",
        },
        omissions=frozenset({("src/sentry/new_module.py", "sentry.new_module.run#1", "return")}),
    )

    decision = decide_candidate(parent, candidate, require_adoption_credit=False)

    assert decision.outcome == Outcome.REJECTED
    assert any("new signature omission" in reason for reason in decision.reasons)
    assert any("calibrated precision extraction" in reason for reason in decision.reasons)


def test_terminal_reports_precision_incomplete_separately_from_core() -> None:
    measurement = _tree(profiles=tuple(Profile))

    decision: Decision = decide_terminal(measurement)

    assert decision.outcome == Outcome.REJECTED
    assert decision.core_complete
    assert not decision.precision_complete
    assert "precision canaries have not been calibrated" in decision.reasons


def test_guard_cli_defaults_to_head_tree(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    with (
        patch("tools.mypy_helpers.typing_campaign._prepare_output", return_value=tmp_path),
        patch(
            "tools.mypy_helpers.typing_campaign._command_compare",
            return_value=(ExitCode.COMPLETE, {"outcome": "complete"}),
        ) as compare,
    ):
        exit_code = main(["guard", "--parent", "accepted-parent", "--output", ".work/tmp/guard"])

    assert exit_code == ExitCode.COMPLETE
    assert compare.call_args.kwargs["candidate_reference"] == "HEAD^{tree}"
    assert compare.call_args.kwargs["parent_reference"] == "accepted-parent"
    assert "complete:" in capsys.readouterr().out


@pytest.mark.parametrize(
    "source",
    [
        "[tool.mypy]\n# begin: not yet strongly typed\n",
        "[tool.mypy]\n# end: sentry modules with typing issues\n",
    ],
)
def test_malformed_profile_sections_fail_closed(source: str) -> None:
    with pytest.raises(ValueError):
        profile_config(source, Profile.ALL_STRONG, Path("/candidate"))

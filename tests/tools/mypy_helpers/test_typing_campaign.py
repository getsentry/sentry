from __future__ import annotations

import ast
import gzip
import hashlib
import subprocess
from dataclasses import replace
from pathlib import Path
from typing import cast
from unittest.mock import patch

import pytest

from sentry.utils import json
from tools.mypy_helpers.typing_campaign import (
    ERROR_SECTION,
    EXPECTED_MYPY_VERSION,
    WEAK_SECTION,
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
    _assert_tree_path,
    _assert_trusted_policy,
    _candidate_allstrong_reuse_allowed,
    _command_compare,
    _command_evaluate_series,
    _coverage_audits,
    _coverage_gaps,
    _diagnostic_record,
    _effective_option_changes,
    _effective_pairs,
    _known_environment_warnings,
    _measure_tree,
    _merge_profiles,
    _mypy_config_policy,
    _policy_changes,
    _precision_any_obligations,
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
    any_obligations: tuple[AnyObligation, ...] = (),
    unanchored_any_count: int = 0,
) -> ProfileMeasurement:
    return ProfileMeasurement(
        profile,
        "tree",
        int(bool(diagnostics)),
        1,
        diagnostics,
        graph,
        any_obligations,
        (),
        0.0,
        None,
        Path(".work/tmp/test"),
        unanchored_any_count=unanchored_any_count,
    )


def _tree(
    *,
    weak: frozenset[tuple[str, str]] = frozenset(),
    suppressed: frozenset[tuple[str, str]] = frozenset(),
    diagnostics: tuple[DiagnosticRecord, ...] = (),
    configured_diagnostics: tuple[DiagnosticRecord, ...] = (),
    bypasses: frozenset[tuple[str, str]] = frozenset(),
    omissions: frozenset[tuple[str, str, str]] = frozenset(),
    any_obligations: frozenset[AnyObligation] = frozenset(),
    precision_any_obligations: tuple[AnyObligation, ...] = (),
    unanchored_any_count: int = 0,
    source_digests: dict[str, str] | None = None,
    signatures: dict[tuple[str, str, str], str] | None = None,
    graph: tuple[ModuleState, ...] = (),
    inventory: tuple[SourceFile, ...] | None = None,
    profiles: tuple[Profile, ...] = (
        Profile.CONFIGURED,
        Profile.UNSUPPRESSED,
        Profile.ALL_STRONG,
    ),
) -> TreeMeasurement:
    inventory = inventory or (
        SourceFile("src/sentry/example.py", "sentry.example", SourceKind.OWNED_IMPLEMENTATION),
    )
    return TreeMeasurement(
        "revision",
        "tree",
        Path(".work/tmp/snapshot"),
        inventory,
        {
            profile: _profile(
                profile,
                diagnostics
                if profile == Profile.ALL_STRONG
                else configured_diagnostics
                if profile == Profile.CONFIGURED
                else (),
                graph,
                precision_any_obligations if profile == Profile.PRECISION else (),
                unanchored_any_count if profile == Profile.PRECISION else 0,
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
        frozenset(record.path for record in inventory),
        source_digests or {record.path: "unchanged" for record in inventory},
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


@pytest.mark.parametrize(
    ("section_name", "parent_block", "candidate_block"),
    (
        (
            WEAK_SECTION,
            '["sentry.example"]',
            '["sentry.example", "sentry.unmatched.*"]',
        ),
        (
            ERROR_SECTION,
            '["sentry.example"]',
            '["sentry.example", "sentry.unmatched.*"]',
        ),
    ),
)
def test_policy_rejects_unmatched_generated_module_patterns(
    section_name: str, parent_block: str, candidate_block: str
) -> None:
    section_setting = (
        'disable_error_code = ["misc"]'
        if section_name == ERROR_SECTION
        else "disallow_any_generics = false\n"
        "disallow_untyped_defs = false\n"
        "strict_equality = false"
    )
    start = f"# begin: {section_name}"
    end = f"# end: {section_name}"
    parent_config = (
        "[tool.mypy]\n"
        f"{start}\n"
        "[[tool.mypy.overrides]]\n"
        f"module = {parent_block}\n"
        f"{section_setting}\n"
        f"{end}\n"
    )
    candidate_config = parent_config.replace(
        f"module = {parent_block}", f"module = {candidate_block}"
    )

    with (
        patch("tools.mypy_helpers.typing_campaign._POLICY_PATHS", ()),
        patch(
            "tools.mypy_helpers.typing_campaign._tree_file",
            side_effect=lambda _repo, tree, path: {
                ("parent", "pyproject.toml"): parent_config.encode(),
                ("candidate", "pyproject.toml"): candidate_config.encode(),
            }.get((tree, path)),
        ),
    ):
        changes = _policy_changes(Path("."), "parent", "candidate")

    assert changes == ("pyproject.toml",)


def test_policy_allows_generated_debt_removals() -> None:
    parent_config = """\
[tool.mypy]
# begin: not yet strongly typed
[[tool.mypy.overrides]]
module = ["sentry.example"]
disallow_any_generics = false
disallow_untyped_defs = false
strict_equality = false
# end: not yet strongly typed
"""
    candidate_config = "[tool.mypy]\n"

    with (
        patch("tools.mypy_helpers.typing_campaign._POLICY_PATHS", ()),
        patch(
            "tools.mypy_helpers.typing_campaign._tree_file",
            side_effect=lambda _repo, tree, path: {
                ("parent", "pyproject.toml"): parent_config.encode(),
                ("candidate", "pyproject.toml"): candidate_config.encode(),
            }.get((tree, path)),
        ),
    ):
        changes = _policy_changes(Path("."), "parent", "candidate")

    assert changes == ()


def test_policy_rejects_new_generated_error_code() -> None:
    parent_config = """\
[tool.mypy]
# begin: sentry modules with typing issues
[[tool.mypy.overrides]]
module = ["sentry.example"]
disable_error_code = ["misc"]
# end: sentry modules with typing issues
"""
    candidate_config = parent_config.replace(
        'disable_error_code = ["misc"]',
        'disable_error_code = ["misc", "arg-type"]',
    )

    with (
        patch("tools.mypy_helpers.typing_campaign._POLICY_PATHS", ()),
        patch(
            "tools.mypy_helpers.typing_campaign._tree_file",
            side_effect=lambda _repo, tree, path: {
                ("parent", "pyproject.toml"): parent_config.encode(),
                ("candidate", "pyproject.toml"): candidate_config.encode(),
            }.get((tree, path)),
        ),
    ):
        changes = _policy_changes(Path("."), "parent", "candidate")

    assert changes == ("pyproject.toml",)


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


def test_weaklist_only_candidate_reuses_complete_allstrong_profile(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    source = repo / "src" / "sentry" / "example.py"
    source.parent.mkdir(parents=True)
    source.write_text("def run() -> int:\n    return 1\n")
    subprocess.run(("git", "init", "-q"), cwd=repo, check=True)

    parent_config = """\
[tool.mypy]
python_version = "3.13"
files = ["src/sentry/example.py"]
# begin: not yet strongly typed
[[tool.mypy.overrides]]
module = ["sentry.example"]
disallow_any_generics = false
disallow_untyped_defs = false
strict_equality = false
# end: not yet strongly typed
"""
    config_path = repo / "pyproject.toml"
    config_path.write_text(parent_config)
    subprocess.run(("git", "add", "."), cwd=repo, check=True)
    parent_tree = subprocess.run(
        ("git", "write-tree"), cwd=repo, capture_output=True, check=True, text=True
    ).stdout.strip()

    config_path.write_text(
        parent_config[: parent_config.index("# begin: not yet strongly typed")]
        + "# begin: not yet strongly typed\n# end: not yet strongly typed\n"
    )
    subprocess.run(("git", "add", "."), cwd=repo, check=True)
    candidate_tree = subprocess.run(
        ("git", "write-tree"), cwd=repo, capture_output=True, check=True, text=True
    ).stdout.strip()

    calls: list[Profile] = []

    def fake_run_profile(profile, root, tree, output, *, label):
        calls.append(profile)
        weak_options = (
            (
                "disallow_any_generics=false",
                "disallow_untyped_defs=false",
                "strict_equality=false",
            )
            if profile == Profile.CONFIGURED and tree == parent_tree
            else ()
        )
        graph = (
            ModuleState(
                "sentry.example",
                "src/sentry/example.py",
                True,
                True,
                False,
                weak_options,
                (),
                "normal",
                "normal",
                (),
            ),
        )
        return ProfileMeasurement(
            profile,
            tree,
            0,
            1,
            (),
            graph,
            (),
            (),
            0.1,
            None,
            output,
        )

    with (
        patch(
            "tools.mypy_helpers.typing_campaign.resolve_tree",
            return_value=("parent", parent_tree),
        ),
        patch(
            "tools.mypy_helpers.typing_campaign._resolve_candidate_tree",
            return_value=("candidate", candidate_tree),
        ),
        patch("tools.mypy_helpers.typing_campaign._assert_trusted_policy"),
        patch("tools.mypy_helpers.typing_campaign.run_profile", side_effect=fake_run_profile),
        patch(
            "tools.mypy_helpers.typing_campaign._coverage_audits",
            side_effect=lambda result, *_args: result,
        ),
    ):
        exit_code, report = _command_compare(
            repo,
            tmp_path / "evaluation",
            command="evaluate",
            parent_reference="parent",
            candidate_reference="candidate",
        )

    assert exit_code == ExitCode.COMPLETE
    assert report["adoption_credit"]
    assert calls == [
        Profile.CONFIGURED,
        Profile.UNSUPPRESSED,
        Profile.ALL_STRONG,
        Profile.CONFIGURED,
        Profile.UNSUPPRESSED,
    ]
    candidate_report = report["candidate"]
    assert isinstance(candidate_report, dict)
    assert candidate_report["source_contracts_reused_from_tree"] == parent_tree
    candidate_profiles = candidate_report["profiles"]
    assert isinstance(candidate_profiles, dict)
    reused = candidate_profiles[Profile.ALL_STRONG.value]
    assert isinstance(reused, dict)
    assert reused["tree"] == parent_tree
    assert reused["reused_from_tree"] == parent_tree
    assert reused["reuse_reason"] == (
        "weaklist-only candidate with identical inventory and source digests"
    )


def test_allstrong_profile_reuse_fails_closed_for_other_changes(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    source = repo / "src" / "sentry" / "example.py"
    source.parent.mkdir(parents=True)
    source.write_text("def run() -> int:\n    return 1\n")
    config_path = repo / "pyproject.toml"
    config_path.write_text("""\
[tool.mypy]
python_version = "3.13"
# begin: not yet strongly typed
[[tool.mypy.overrides]]
module = ["sentry.example"]
disallow_any_generics = false
disallow_untyped_defs = false
strict_equality = false
# end: not yet strongly typed
""")
    subprocess.run(("git", "init", "-q"), cwd=repo, check=True)
    subprocess.run(("git", "add", "."), cwd=repo, check=True)
    parent_tree = subprocess.run(
        ("git", "write-tree"), cwd=repo, capture_output=True, check=True, text=True
    ).stdout.strip()

    config_path.write_text("""\
[tool.mypy]
python_version = "3.12"
""")
    subprocess.run(("git", "add", "."), cwd=repo, check=True)
    config_change_tree = subprocess.run(
        ("git", "write-tree"), cwd=repo, capture_output=True, check=True, text=True
    ).stdout.strip()

    config_path.write_text("""\
[tool.mypy]
python_version = "3.13"
""")
    source.write_text("def run() -> int:\n    return 2\n")
    subprocess.run(("git", "add", "."), cwd=repo, check=True)
    source_change_tree = subprocess.run(
        ("git", "write-tree"), cwd=repo, capture_output=True, check=True, text=True
    ).stdout.strip()

    graph = (
        ModuleState(
            "sentry.example",
            "src/sentry/example.py",
            True,
            True,
            False,
            (),
            (),
            "normal",
            "normal",
            (),
        ),
    )
    parent = replace(
        _tree(graph=graph),
        tree=parent_tree,
        profiles={
            profile: replace(result, tree=parent_tree)
            for profile, result in _tree(graph=graph).profiles.items()
        },
    )

    calls: list[Profile] = []

    def fake_run_profile(profile, root, tree, output, *, label):
        calls.append(profile)
        return ProfileMeasurement(
            profile,
            tree,
            0,
            1,
            (),
            graph,
            (),
            (),
            0.1,
            None,
            output,
        )

    assert not _candidate_allstrong_reuse_allowed(
        repo, parent_tree, config_change_tree, (), parent
    )
    assert not _candidate_allstrong_reuse_allowed(
        repo, parent_tree, source_change_tree, ("src/sentry/example.py",), parent
    )
    assert not _candidate_allstrong_reuse_allowed(
        repo, parent_tree, config_change_tree, (), replace(parent, gaps=("incomplete",))
    )

    profiles = (Profile.CONFIGURED, Profile.UNSUPPRESSED, Profile.ALL_STRONG)
    with (
        patch("tools.mypy_helpers.typing_campaign.run_profile", side_effect=fake_run_profile),
        patch(
            "tools.mypy_helpers.typing_campaign._coverage_audits",
            side_effect=lambda result, *_args: result,
        ),
    ):
        changed_source = _measure_tree(
            repo,
            "source-change",
            source_change_tree,
            tmp_path / "source-change",
            profiles,
            reuse_from=parent,
        )

    assert calls == list(profiles)
    assert changed_source.profiles[Profile.ALL_STRONG].reused_from_tree is None


def test_evaluate_series_reuses_adjacent_configuration_measurements(
    tmp_path: Path,
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    config_path = repo / "pyproject.toml"
    config_path.write_text("[tool.mypy]\n")
    subprocess.run(("git", "init", "-q"), cwd=repo, check=True)
    subprocess.run(("git", "add", "."), cwd=repo, check=True)
    parent_tree = subprocess.run(
        ("git", "write-tree"), cwd=repo, capture_output=True, check=True, text=True
    ).stdout.strip()

    config_path.write_text("[tool.mypy]\n# first promotion\n")
    subprocess.run(("git", "add", "."), cwd=repo, check=True)
    first_tree = subprocess.run(
        ("git", "write-tree"), cwd=repo, capture_output=True, check=True, text=True
    ).stdout.strip()
    config_path.write_text("[tool.mypy]\n# second promotion\n")
    subprocess.run(("git", "add", "."), cwd=repo, check=True)
    second_tree = subprocess.run(
        ("git", "write-tree"), cwd=repo, capture_output=True, check=True, text=True
    ).stdout.strip()

    parent = replace(
        _tree(
            weak=frozenset(
                {
                    ("sentry.example", "disallow_untyped_defs"),
                    ("sentry.other", "disallow_untyped_defs"),
                }
            )
        ),
        tree=parent_tree,
    )
    first = replace(
        _tree(weak=frozenset({("sentry.other", "disallow_untyped_defs")})),
        tree=first_tree,
    )
    second = replace(_tree(), tree=second_tree)
    templates = {parent_tree: parent, first_tree: first, second_tree: second}
    measured: list[tuple[str, TreeMeasurement | None]] = []

    def fake_measure_tree(_repo, revision, tree, _output, _profiles, *, reuse_from=None):
        measured.append((tree, reuse_from))
        return replace(templates[tree], revision=revision)

    with (
        patch("tools.mypy_helpers.typing_campaign.resolve_tree", return_value=("parent", parent_tree)),
        patch(
            "tools.mypy_helpers.typing_campaign._resolve_candidate_tree",
            side_effect=[("first", first_tree), ("second", second_tree)],
        ),
        patch("tools.mypy_helpers.typing_campaign._assert_trusted_policy"),
        patch("tools.mypy_helpers.typing_campaign._policy_changes", return_value=()),
        patch(
            "tools.mypy_helpers.typing_campaign._candidate_allstrong_reuse_allowed",
            return_value=True,
        ),
        patch(
            "tools.mypy_helpers.typing_campaign._measure_tree",
            side_effect=fake_measure_tree,
        ),
    ):
        exit_code, report = _command_evaluate_series(
            repo,
            tmp_path / "evaluation",
            parent_reference="parent",
            candidate_references=("first", "second"),
        )

    assert exit_code == ExitCode.COMPLETE
    assert [tree for tree, _ in measured] == [parent_tree, first_tree, second_tree]
    assert measured[1][1] is measured[0][1] or measured[1][1] == replace(
        parent, revision="parent"
    )
    assert measured[2][1] is measured[1][1]
    transitions = report["transitions"]
    assert isinstance(transitions, list)
    expected = (
        decide_candidate(parent, first, require_adoption_credit=True),
        decide_candidate(first, second, require_adoption_credit=True),
    )
    for transition, decision in zip(transitions, expected, strict=True):
        assert transition["outcome"] == decision.outcome.value
        assert transition["reasons"] == list(decision.reasons)
        assert transition["adoption_credit"] == decision.adoption_credit
        assert transition["details"] == decision.details
    assert [transition["parent_tree"] for transition in transitions] == [
        parent_tree,
        first_tree,
    ]
    assert [transition["candidate_tree"] for transition in transitions] == [
        first_tree,
        second_tree,
    ]
    assert report["adoption_credit"] == [True, True]


def test_evaluate_series_stops_after_rejected_transition(tmp_path: Path) -> None:
    parent_tree = "parent-tree"
    first_tree = "first-tree"
    second_tree = "second-tree"
    parent = replace(_tree(), tree=parent_tree)
    first = replace(
        _tree(weak=frozenset({("sentry.example", "disallow_untyped_defs")})),
        tree=first_tree,
    )
    templates = {
        parent_tree: parent,
        first_tree: first,
        second_tree: replace(_tree(), tree=second_tree),
    }
    measured: list[str] = []

    def fake_measure_tree(_repo, revision, tree, _output, _profiles, *, reuse_from=None):
        measured.append(tree)
        return replace(templates[tree], revision=revision)

    with (
        patch(
            "tools.mypy_helpers.typing_campaign.resolve_tree",
            return_value=("parent", parent_tree),
        ),
        patch(
            "tools.mypy_helpers.typing_campaign._resolve_candidate_tree",
            side_effect=[("first", first_tree), ("second", second_tree)],
        ),
        patch("tools.mypy_helpers.typing_campaign._assert_trusted_policy"),
        patch(
            "tools.mypy_helpers.typing_campaign._changed_tree_paths",
            return_value=("pyproject.toml",),
        ),
        patch("tools.mypy_helpers.typing_campaign._changed_source_paths", return_value=()),
        patch("tools.mypy_helpers.typing_campaign._policy_changes", return_value=()),
        patch(
            "tools.mypy_helpers.typing_campaign._candidate_allstrong_reuse_allowed",
            return_value=True,
        ),
        patch(
            "tools.mypy_helpers.typing_campaign._measure_tree",
            side_effect=fake_measure_tree,
        ),
    ):
        exit_code, report = _command_evaluate_series(
            tmp_path,
            tmp_path / "evaluation",
            parent_reference="parent",
            candidate_references=("first", "second"),
        )

    assert exit_code == ExitCode.REJECTED
    assert measured == [parent_tree, first_tree]
    transitions = report["transitions"]
    assert isinstance(transitions, list)
    assert len(transitions) == 1
    transition = transitions[0]
    assert isinstance(transition, dict)
    assert transition["parent_tree"] == parent_tree
    assert transition["candidate_tree"] == first_tree
    assert transition["outcome"] == Outcome.REJECTED.value


def test_evaluate_series_stops_allstrong_reuse_after_ineligible_transition(
    tmp_path: Path,
) -> None:
    parent_tree = "parent-tree"
    first_tree = "first-tree"
    second_tree = "second-tree"
    parent = replace(
        _tree(
            weak=frozenset(
                {
                    ("sentry.example", "disallow_untyped_defs"),
                    ("sentry.other", "disallow_untyped_defs"),
                }
            )
        ),
        tree=parent_tree,
    )
    first = replace(
        _tree(weak=frozenset({("sentry.other", "disallow_untyped_defs")})),
        tree=first_tree,
    )
    second = replace(_tree(), tree=second_tree)
    templates = {parent_tree: parent, first_tree: first, second_tree: second}
    measurements: list[tuple[str, TreeMeasurement | None]] = []

    def fake_measure_tree(_repo, revision, tree, _output, _profiles, *, reuse_from=None):
        measurements.append((tree, reuse_from))
        return replace(templates[tree], revision=revision)

    with (
        patch(
            "tools.mypy_helpers.typing_campaign.resolve_tree",
            return_value=("parent", parent_tree),
        ),
        patch(
            "tools.mypy_helpers.typing_campaign._resolve_candidate_tree",
            side_effect=[("first", first_tree), ("second", second_tree)],
        ),
        patch("tools.mypy_helpers.typing_campaign._assert_trusted_policy"),
        patch("tools.mypy_helpers.typing_campaign._changed_tree_paths", return_value=("pyproject.toml",)),
        patch("tools.mypy_helpers.typing_campaign._changed_source_paths", return_value=()),
        patch("tools.mypy_helpers.typing_campaign._policy_changes", return_value=()),
        patch(
            "tools.mypy_helpers.typing_campaign._candidate_allstrong_reuse_allowed",
            side_effect=[True, False],
        ),
        patch(
            "tools.mypy_helpers.typing_campaign._measure_tree",
            side_effect=fake_measure_tree,
        ),
    ):
        exit_code, report = _command_evaluate_series(
            tmp_path,
            tmp_path / "evaluation",
            parent_reference="parent",
            candidate_references=("first", "second"),
        )

    assert exit_code == ExitCode.COMPLETE
    assert len(measurements) == 3
    assert measurements[1][1] is not None
    assert measurements[1][1].tree == parent_tree
    assert measurements[2][1] is None
    transitions = report["transitions"]
    assert isinstance(transitions, list)
    assert [transition["outcome"] for transition in transitions] == [
        Outcome.COMPLETE.value,
        Outcome.COMPLETE.value,
    ]


def test_evaluate_series_rechecks_allstrong_reuse_for_each_candidate(
    tmp_path: Path,
) -> None:
    parent_tree = "parent-tree"
    first_tree = "first-tree"
    second_tree = "second-tree"
    parent = replace(
        _tree(
            weak=frozenset(
                {
                    ("sentry.example", "disallow_untyped_defs"),
                    ("sentry.other", "disallow_untyped_defs"),
                }
            )
        ),
        tree=parent_tree,
    )
    first = replace(
        _tree(weak=frozenset({("sentry.other", "disallow_untyped_defs")})),
        tree=first_tree,
    )
    second = replace(_tree(), tree=second_tree)
    templates = {parent_tree: parent, first_tree: first, second_tree: second}
    measurements: list[tuple[str, TreeMeasurement | None]] = []

    def fake_measure_tree(_repo, revision, tree, _output, _profiles, *, reuse_from=None):
        measurements.append((tree, reuse_from))
        return replace(templates[tree], revision=revision)

    with (
        patch(
            "tools.mypy_helpers.typing_campaign.resolve_tree",
            return_value=("parent", parent_tree),
        ),
        patch(
            "tools.mypy_helpers.typing_campaign._resolve_candidate_tree",
            side_effect=[("first", first_tree), ("second", second_tree)],
        ),
        patch("tools.mypy_helpers.typing_campaign._assert_trusted_policy"),
        patch(
            "tools.mypy_helpers.typing_campaign._changed_tree_paths",
            return_value=("pyproject.toml",),
        ),
        patch("tools.mypy_helpers.typing_campaign._changed_source_paths", return_value=()),
        patch("tools.mypy_helpers.typing_campaign._policy_changes", return_value=()),
        patch(
            "tools.mypy_helpers.typing_campaign._candidate_allstrong_reuse_allowed",
            side_effect=[False, True],
        ),
        patch(
            "tools.mypy_helpers.typing_campaign._measure_tree",
            side_effect=fake_measure_tree,
        ),
    ):
        exit_code, _ = _command_evaluate_series(
            tmp_path,
            tmp_path / "evaluation",
            parent_reference="parent",
            candidate_references=("first", "second"),
        )

    assert exit_code == ExitCode.COMPLETE
    assert [tree for tree, _ in measurements] == [parent_tree, first_tree, second_tree]
    assert measurements[1][1] is None
    assert measurements[2][1] is not None
    assert measurements[2][1].tree == parent_tree


def test_evaluate_series_rejects_non_configuration_transition_before_measurement(
    tmp_path: Path,
) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    source = repo / "src" / "sentry" / "example.py"
    source.parent.mkdir(parents=True)
    source.write_text("value = 1\n")
    config_path = repo / "pyproject.toml"
    config_path.write_text("[tool.mypy]\n")
    subprocess.run(("git", "init", "-q"), cwd=repo, check=True)
    subprocess.run(("git", "add", "."), cwd=repo, check=True)
    parent_tree = subprocess.run(
        ("git", "write-tree"), cwd=repo, capture_output=True, check=True, text=True
    ).stdout.strip()
    source.write_text("value = 2\n")
    subprocess.run(("git", "add", "."), cwd=repo, check=True)
    candidate_tree = subprocess.run(
        ("git", "write-tree"), cwd=repo, capture_output=True, check=True, text=True
    ).stdout.strip()

    with (
        patch("tools.mypy_helpers.typing_campaign.resolve_tree", return_value=("parent", parent_tree)),
        patch(
            "tools.mypy_helpers.typing_campaign._resolve_candidate_tree",
            return_value=("candidate", candidate_tree),
        ),
        patch("tools.mypy_helpers.typing_campaign._assert_trusted_policy"),
        patch("tools.mypy_helpers.typing_campaign._measure_tree") as measure_tree,
    ):
        exit_code, report = _command_evaluate_series(
            repo,
            tmp_path / "evaluation",
            parent_reference="parent",
            candidate_references=("candidate",),
        )

    assert exit_code == ExitCode.REJECTED
    assert report["outcome"] == Outcome.REJECTED.value
    transitions = report["transitions"]
    assert isinstance(transitions, list)
    transition = transitions[0]
    assert isinstance(transition, dict)
    assert transition["parent_tree"] == parent_tree
    assert transition["changed_paths"] == ["src/sentry/example.py"]
    measure_tree.assert_not_called()


def test_evaluate_series_rejects_policy_change_before_measurement(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    config_path = repo / "pyproject.toml"
    config_path.write_text("[tool.mypy]\n")
    subprocess.run(("git", "init", "-q"), cwd=repo, check=True)
    subprocess.run(("git", "add", "."), cwd=repo, check=True)
    parent_tree = subprocess.run(
        ("git", "write-tree"), cwd=repo, capture_output=True, check=True, text=True
    ).stdout.strip()
    config_path.write_text("[tool.mypy]\npython_version = '3.13'\n")
    subprocess.run(("git", "add", "."), cwd=repo, check=True)
    candidate_tree = subprocess.run(
        ("git", "write-tree"), cwd=repo, capture_output=True, check=True, text=True
    ).stdout.strip()

    with (
        patch("tools.mypy_helpers.typing_campaign.resolve_tree", return_value=("parent", parent_tree)),
        patch(
            "tools.mypy_helpers.typing_campaign._resolve_candidate_tree",
            return_value=("candidate", candidate_tree),
        ),
        patch("tools.mypy_helpers.typing_campaign._assert_trusted_policy"),
        patch(
            "tools.mypy_helpers.typing_campaign._policy_changes",
            return_value=("pyproject.toml",),
        ),
        patch("tools.mypy_helpers.typing_campaign._measure_tree") as measure_tree,
    ):
        exit_code, report = _command_evaluate_series(
            repo,
            tmp_path / "evaluation",
            parent_reference="parent",
            candidate_references=("candidate",),
        )

    assert exit_code == ExitCode.REJECTED
    assert report["outcome"] == Outcome.REJECTED.value
    assert report["reasons"] == ["candidate changes evaluator policy: pyproject.toml"]
    transitions = report["transitions"]
    assert isinstance(transitions, list)
    transition = transitions[0]
    assert isinstance(transition, dict)
    assert transition["parent_tree"] == parent_tree
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


def test_source_contracts_account_for_pep695_alias_and_type_parameters(
    tmp_path: Path,
) -> None:
    source_path = "src/example.py"
    source = """\
from typing import Any

type Alias[T: Any = Any] = dict[str, Any]

class Box[T: Any = Any]:
    payload: Any

def identity[T: Any = Any](value: T) -> Any:
    return value
"""
    source_file = tmp_path / source_path
    source_file.parent.mkdir(parents=True)
    source_file.write_text(source)

    _, signatures, _, obligations = _source_contracts(source_path, tmp_path)

    assert signatures[(source_path, "example.Alias#1", "generic:T")] == "T: Any = Any"
    assert signatures[(source_path, "example.Box#1", "generic:T")] == "T: Any = Any"
    assert signatures[(source_path, "example.identity#1", "generic:T")] == "T: Any = Any"
    assert any(item.anchor == "type-alias:Alias" for item in obligations)
    assert any(
        item.anchor.startswith("annotation:payload:") and item.origin == "explicit"
        for item in obligations
    )
    assert sum(item.anchor.startswith("signature:") for item in obligations) == 7


@pytest.mark.parametrize("module_name", ["typing", "typing_extensions"])
def test_typing_wildcard_import_is_accounted_as_unknown(tmp_path: Path, module_name: str) -> None:
    source_path = "src/example.py"
    source = f"""\
from {module_name} import *

def unchecked(value):
    return cast(Any, value)

@no{"_type_check"}
def ignored(value):
    return value

callback: Callable[..., Any]
mapping: dict[str, Any]
"""
    source_file = tmp_path / source_path
    source_file.parent.mkdir(parents=True)
    source_file.write_text(source)

    bypasses, _, _, obligations = _source_contracts(source_path, tmp_path)

    anchor = f"typing-wildcard-import:{module_name}#1"
    assert bypasses == frozenset({(source_path, anchor)})
    assert obligations == frozenset(
        {
            AnyObligation(
                source_path,
                anchor,
                "unresolved-imported-typing-names",
                "unknown-typing-wildcard",
            )
        }
    )


def test_candidate_with_new_typing_wildcard_import_is_rejected(tmp_path: Path) -> None:
    source_path = "src/sentry/example.py"
    source_file = tmp_path / source_path
    source_file.parent.mkdir(parents=True)
    source_file.write_text("from typing import *\n")
    bypasses, _, _, obligations = _source_contracts(source_path, tmp_path)
    parent = _tree(source_digests={source_path: "parent"})
    candidate = _tree(
        bypasses=bypasses,
        any_obligations=obligations,
        source_digests={source_path: "candidate"},
    )

    decision = decide_candidate(
        parent, candidate, require_adoption_credit=True, precision_calibrated=True
    )

    assert decision.outcome == Outcome.REJECTED
    assert any("new typing bypass" in reason for reason in decision.reasons)
    assert any("new Any obligation" in reason for reason in decision.reasons)


def test_source_contracts_reuse_any_nodes_for_nested_types_and_bypasses(tmp_path: Path) -> None:
    source_path = "src/example.py"
    source = """\
from typing import Any, Callable, cast

def consume(value: list[tuple[Any, Any]]) -> Any:
    cast(Any, value)
    return value

alias = tuple[Any, list[Any]]
typed_alias: object = tuple[Any, Any]
callback: Callable[..., Any]
mapping: dict[str, list[Any]]
"""
    source_file = tmp_path / source_path
    source_file.parent.mkdir(parents=True)
    source_file.write_text(source)
    module = ast.parse(source)
    callback_node = module.body[4]
    mapping_node = module.body[5]
    assert isinstance(callback_node, ast.AnnAssign)
    assert isinstance(mapping_node, ast.AnnAssign)
    callback_annotation = ast.dump(callback_node.annotation, include_attributes=False)
    mapping_annotation = ast.dump(mapping_node.annotation, include_attributes=False)

    bypasses, signatures, omissions, obligations = _source_contracts(source_path, tmp_path)

    assert signatures == {
        (source_path, "example.consume#1", "parameter:value"): "list[tuple[Any, Any]]",
        (source_path, "example.consume#1", "return"): "Any",
    }
    assert omissions == frozenset()
    assert obligations == frozenset(
        {
            AnyObligation(
                source_path, "signature:example.consume#1", "parameter:value:0", "explicit"
            ),
            AnyObligation(
                source_path, "signature:example.consume#1", "parameter:value:1", "explicit"
            ),
            AnyObligation(source_path, "signature:example.consume#1", "return:0", "explicit"),
            AnyObligation(source_path, "type-alias:alias", "alias:0", "explicit"),
            AnyObligation(source_path, "type-alias:alias", "alias:1", "explicit"),
            AnyObligation(source_path, "type-alias:typed_alias", "alias:0", "explicit"),
            AnyObligation(source_path, "type-alias:typed_alias", "alias:1", "explicit"),
            AnyObligation(
                source_path,
                f"annotation:callback:{callback_annotation}",
                "variable:0",
                "explicit",
            ),
            AnyObligation(
                source_path,
                f"annotation:mapping:{mapping_annotation}",
                "variable:0",
                "explicit",
            ),
        }
    )
    assert bypasses == frozenset(
        {
            (source_path, "callable-any:Callable[..., Any]"),
            (source_path, "broad-dict-any:dict[str, list[Any]]"),
            (source_path, "erasing-cast:cast(Any, value)"),
        }
    )


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


def test_precision_any_obligations_normalizes_each_raw_path_once(tmp_path: Path) -> None:
    root = tmp_path / "snapshot"
    in_root_path = str(root / "src" / "sentry" / "example.py")
    out_of_root_path = str(tmp_path / "external.py")
    raw_obligations = [
        {
            "path": in_root_path,
            "anchor": "ast:one#0",
            "type_position": "expression:0",
            "origin": "explicit",
        },
        {
            "path": out_of_root_path,
            "anchor": "ast:two#0",
            "type_position": "expression:0",
            "origin": "unannotated",
        },
        {
            "path": in_root_path,
            "anchor": "ast:three#0",
            "type_position": "expression:1",
            "origin": "explicit",
        },
        {
            "path": out_of_root_path,
            "anchor": "ast:four#0",
            "type_position": "expression:1",
            "origin": "unannotated",
        },
    ]
    normalized: list[str] = []
    normalize_path = _assert_tree_path

    def record_normalization(path: str, source_root: Path, *, owned_module: bool = False) -> str:
        normalized.append(path)
        return normalize_path(path, source_root, owned_module=owned_module)

    with patch(
        "tools.mypy_helpers.typing_campaign._assert_tree_path",
        side_effect=record_normalization,
    ):
        obligations = _precision_any_obligations(raw_obligations, root)

    assert normalized == [in_root_path, out_of_root_path]
    assert obligations == (
        AnyObligation(
            "src/sentry/example.py",
            "ast:one#0",
            "expression:0",
            "explicit",
        ),
        AnyObligation(
            "src/sentry/example.py",
            "ast:three#0",
            "expression:1",
            "explicit",
        ),
    )


def test_precision_adapter_exports_stable_any_obligations(tmp_path: Path) -> None:
    root = tmp_path / "snapshot"
    package = root / "src" / "sentry"
    package.mkdir(parents=True)
    (package / "__init__.py").write_text("")
    example_path = package / "example.py"
    example_path.write_text(
        "from typing import Any, TypeAlias\n\n"
        "Alias: TypeAlias = dict[str, Any]\n\n"
        "type PEP695Alias = list[Any]\n\n"
        "def identity(value: Any) -> Any:\n    return value\n"
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
    compressed_worker_output = (measurement.output_dir / "worker.stdout.gz").read_bytes()
    worker_output = json.loads(gzip.decompress(compressed_worker_output))
    assert worker_output["mypy_version"] == EXPECTED_MYPY_VERSION
    assert not (measurement.output_dir / "worker.stdout").exists()
    assert all("unused section(s)" not in item.message for item in measurement.diagnostics)
    assert any(item.origin == "explicit" for item in measurement.any_obligations)
    assert all(not item.anchor.startswith("unanchored:") for item in measurement.any_obligations)
    example_module = ast.parse(example_path.read_text())
    alias_node = example_module.body[1]
    pep695_alias_node = example_module.body[2]
    assert isinstance(alias_node, ast.AnnAssign)
    assert isinstance(pep695_alias_node, ast.TypeAlias)
    assert alias_node.value is not None
    assert pep695_alias_node.value is not None
    alias_value = alias_node.value
    alias_fingerprint = hashlib.sha256(
        ast.dump(alias_value, include_attributes=False).encode()
    ).hexdigest()[:20]
    alias_anchor = f"precision:ast:{alias_fingerprint}#0:any-leaf:"
    pep695_value = pep695_alias_node.value
    pep695_fingerprint = hashlib.sha256(
        ast.dump(pep695_value, include_attributes=False).encode()
    ).hexdigest()[:20]
    pep695_rhs_anchor = f"precision:ast:{pep695_fingerprint}#0:any-leaf:"
    assert any(
        item.path == "src/sentry/example.py" and item.anchor.startswith(alias_anchor)
        for item in measurement.any_obligations
    )
    assert any(
        item.path == "src/sentry/example.py" and item.anchor.startswith(pep695_rhs_anchor)
        for item in measurement.any_obligations
    )
    assert any(item.path == "src/sentry/example.py" for item in measurement.diagnostics)
    state = next(state for state in measurement.graph if state.module == "sentry.example")
    assert state.checked
    assert "implicit_reexport" in dict(state.effective_options)
    assert "no_implicit_reexport" not in dict(state.effective_options)


def test_precision_adapter_accounts_for_declaration_expression_sentinels(
    tmp_path: Path,
) -> None:
    root = tmp_path / "snapshot"
    package = root / "src" / "sentry"
    package.mkdir(parents=True)
    (package / "__init__.py").write_text("")
    source_path = "src/sentry/example.py"
    (root / source_path).write_text(
        "from enum import Enum\n"
        "from typing import Any, NamedTuple, NewType, ParamSpec, TypeAlias, TypeVar, "
        "TypeVarTuple, TypedDict\n\n"
        "Alias: TypeAlias = list[Any]\n"
        "T = TypeVar('T')\n"
        "P = ParamSpec('P')\n"
        "Ts = TypeVarTuple('Ts')\n"
        "Point = NamedTuple('Point', [('value', Any)])\n"
        "Payload = TypedDict('Payload', {'value': Any})\n"
        "Color = Enum('Color', 'RED')\n"
        "Identifier = NewType('Identifier', int)\n"
        "missing: Any\n"
    )
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

    measurement = run_profile(
        Profile.PRECISION,
        root,
        "synthetic-tree",
        output,
        timeout_seconds=120,
    )

    assert measurement.adapter_status == 0
    assert measurement.unanchored_any_count == 0
    assert all(
        not item.anchor.startswith("unanchored:")
        for item in measurement.any_obligations
        if item.path == source_path
    )
    _, _, _, source_obligations = _source_contracts(source_path, root)
    assert any(item.anchor == "type-alias:Alias" for item in source_obligations)
    assert any(
        item.anchor.startswith("annotation:missing:") for item in source_obligations
    )


def test_precision_adapter_anchors_unique_import_and_exception_binders(
    tmp_path: Path,
) -> None:
    root = tmp_path / "snapshot"
    package = root / "src" / "sentry"
    package.mkdir(parents=True)
    (package / "__init__.py").write_text("")
    (package / "provider.py").write_text(
        "from typing import Any\n\nplain: Any\naliased: Any\n"
    )
    (package / "unique.py").write_text(
        "from typing import Any\n\n"
        "plain = 0\n"
        "from sentry.provider import plain\n\n"
        "Alias = 0\n"
        "from sentry.provider import aliased as Alias\n\n"
        "def caught() -> Any:\n"
        "    try:\n"
        "        raise ValueError()\n"
        "    except Any as error:\n"
        "        return error\n\n"
        "def divided(value: Any, base: int):\n"
        "    return divmod(value, base)\n"
    )
    (package / "ambiguous.py").write_text(
        "conflict = 0\n"
        "from sentry.provider import plain as conflict, aliased as conflict\n"
    )
    (package / "wildcard.py").write_text(
        "from typing import *\n\n"
        "def identity(value: Any) -> Any:\n"
        "    return value\n"
    )
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

    measurement = run_profile(
        Profile.PRECISION,
        root,
        "synthetic-tree",
        output,
        timeout_seconds=120,
    )

    assert measurement.adapter_status == 0
    unique = [
        item for item in measurement.any_obligations if item.path == "src/sentry/unique.py"
    ]
    ambiguous = [
        item
        for item in measurement.any_obligations
        if item.path == "src/sentry/ambiguous.py"
    ]
    wildcard = [
        item
        for item in measurement.any_obligations
        if item.path == "src/sentry/wildcard.py"
    ]
    unique_tree = ast.parse((package / "unique.py").read_text())
    expected_import_anchor_prefixes = {
        "precision:ast-role:import-binding:"
        + hashlib.sha256(ast.dump(alias, include_attributes=False).encode()).hexdigest()[:20]
        + "#"
        for statement in ast.walk(unique_tree)
        if isinstance(statement, ast.ImportFrom) and statement.module == "sentry.provider"
        for alias in statement.names
    }
    assert any(item.anchor.startswith("precision:ast-role:exception-handler:") for item in unique)
    assert all(
        any(item.anchor.startswith(prefix) and ":any-leaf:" in item.anchor for item in unique)
        for prefix in expected_import_anchor_prefixes
    )
    assert any("unanchored:OpExpr::" in item.anchor and ":-1:None:None" in item.anchor for item in unique)
    assert any("unanchored:NameExpr:conflict:" in item.anchor for item in ambiguous)
    assert wildcard
    assert all(not item.anchor.startswith("precision:ast-role:import-binding:") for item in wildcard)


def test_precision_adapter_handles_namespace_package_directory(tmp_path: Path) -> None:
    root = tmp_path / "snapshot"
    package = root / "src" / "sentry"
    package_paths = (
        package,
        package / "api",
        package / "api" / "endpoints",
        package / "api" / "endpoints" / "integrations",
        package / "api" / "endpoints" / "integrations" / "sentry_apps",
    )
    for package_path in package_paths:
        package_path.mkdir(parents=True, exist_ok=True)
        (package_path / "__init__.py").write_text("")
    namespace_package = package_paths[-1] / "installation"
    child_package = namespace_package / "child"
    child_package.mkdir(parents=True)
    (child_package / "__init__.py").write_text(
        "from typing import Any\n\n\ndef identity(value: Any) -> Any:\n    return value\n"
    )
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

    measurement = run_profile(
        Profile.PRECISION,
        root,
        "synthetic-tree",
        output,
        timeout_seconds=120,
    )

    assert measurement.adapter_status == 0
    namespace_state = next(
        state
        for state in measurement.graph
        if state.module == "sentry.api.endpoints.integrations.sentry_apps.installation"
    )
    assert namespace_state.path == "src/sentry/api/endpoints/integrations/sentry_apps/installation"
    assert (root / namespace_state.path).is_dir()
    assert measurement.unanchored_any_count == 0
    assert any(item.origin == "explicit" for item in measurement.any_obligations)
    assert all(not item.anchor.startswith("unanchored:") for item in measurement.any_obligations)


def test_precision_adapter_anchors_source_kinds_and_rejects_ambiguous_rewrites(
    tmp_path: Path,
) -> None:
    root = tmp_path / "snapshot"
    package = root / "src" / "sentry"
    package.mkdir(parents=True)
    (package / "__init__.py").write_text("")
    (package / "ordinary.py").write_text(
        "from typing import Any, cast\n\n"
        "def expressions(value: Any, other: Any) -> Any:\n"
        "    assigned = (captured := value)\n"
        "    binary = value + other\n"
        "    boolean = value and other\n"
        "    return assigned, binary, boolean\n\n"
        "def generator(value: Any):\n"
        "    yield value\n"
        "    yield from [value]\n\n"
        "class Parent:\n"
        "    def method(self, value: Any) -> Any:\n"
        "        return value\n\n"
        "class Child(Parent):\n"
        "    def method(self, value: Any) -> Any:\n"
        "        return super().method(value)\n\n"
        "async def awaited(value: Any) -> Any:\n"
        "    return await value\n\n"
        "def casted(value: Any) -> Any:\n"
        "    return cast(Any, value)\n\n"
        "def dictionary(value: Any) -> dict[str, Any]:\n"
        "    return dict(value=value)\n\n"
        "def lambda_expression(value: Any) -> Any:\n"
        "    function = lambda: value\n"
        "    return function()\n\n"
        "def formatted(value: Any) -> Any:\n"
        "    return f'{value.attr}'\n"
    )
    (package / "generic.py").write_text(
        "from typing import Any, TypeVar\n\n"
        "T = TypeVar('T')\n\n"
        "def identity(value: T) -> T:\n"
        "    return value\n\n"
        "def specialized(value: Any) -> Any:\n"
        "    return identity[Any](value)\n"
    )
    (package / "mismatched.py").write_text(
        "from typing import Any, cast\n\n"
        "def formatted(value: Any) -> str:\n"
        "    return f'{ value.attr }'\n\n"
        "def ambiguous_cast(value: Any) -> Any:\n"
        "    return cast(Any, value)()\n"
    )
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

    measurement = run_profile(
        Profile.PRECISION,
        root,
        "synthetic-tree",
        output,
        timeout_seconds=120,
    )

    assert measurement.adapter_status == 0
    ordinary = [
        item for item in measurement.any_obligations if item.path == "src/sentry/ordinary.py"
    ]
    generic = [
        item for item in measurement.any_obligations if item.path == "src/sentry/generic.py"
    ]
    mismatched = [
        item for item in measurement.any_obligations if item.path == "src/sentry/mismatched.py"
    ]
    assert measurement.unanchored_any_count > 0
    assert ordinary
    unanchored_ordinary = [
        item.anchor for item in ordinary if item.anchor.startswith("unanchored:")
    ]
    assert not unanchored_ordinary, unanchored_ordinary
    assert generic
    assert all("unanchored:TypeVarExpr:" not in item.anchor for item in generic)
    assert all("unanchored:TypeApplication:" not in item.anchor for item in generic)
    assert any("unanchored:MemberExpr:" in item.anchor for item in mismatched)
    assert any("unanchored:CastExpr:" in item.anchor for item in mismatched)


def test_precision_any_identity_ignores_inserted_non_any_siblings(tmp_path: Path) -> None:
    root = tmp_path / "snapshot"
    package = root / "src" / "sentry"
    package.mkdir(parents=True)
    (package / "__init__.py").write_text("")
    source_path = package / "example.py"
    shared_source = (
        "from typing import Any\n\n"
        "class Typed:\n"
        "    attr: str\n\n"
        "def any_first(value: Any) -> None:\n"
        "    result = value.attr\n\n"
        "def typed_middle(value: Typed) -> None:\n"
        "    result = value.attr\n\n"
    )
    typed_insertion = (
        "def typed_inserted(value: Typed) -> None:\n"
        "    result = value.attr\n\n"
    )
    source_path.write_text(
        shared_source
        + "def any_last(value: Any) -> None:\n"
        + "    result = value.attr\n"
    )
    (root / "pyproject.toml").write_text(
        "[tool.mypy]\n"
        "python_version = '3.13'\n"
        "files = ['src/sentry']\n"
        "mypy_path = ['src']\n"
        "namespace_packages = true\n"
        "explicit_package_bases = true\n"
    )
    parent_output = tmp_path / "parent-output"
    parent_output.mkdir()
    parent = run_profile(
        Profile.PRECISION,
        root,
        "parent-tree",
        parent_output,
        timeout_seconds=120,
    )

    source_path.write_text(
        shared_source
        + typed_insertion
        + "def any_last(value: Any) -> None:\n"
        + "    result = value.attr\n"
    )
    candidate_output = tmp_path / "candidate-output"
    candidate_output.mkdir()
    candidate = run_profile(
        Profile.PRECISION,
        root,
        "candidate-tree",
        candidate_output,
        timeout_seconds=120,
    )

    parent_rows = [item for item in parent.any_obligations if item.path == "src/sentry/example.py"]
    candidate_rows = [
        item for item in candidate.any_obligations if item.path == "src/sentry/example.py"
    ]
    assert parent.adapter_status == 0
    assert candidate.adapter_status == 0
    assert parent_rows
    assert [(item.anchor, item.type_position, item.origin) for item in candidate_rows] == [
        (item.anchor, item.type_position, item.origin) for item in parent_rows
    ]


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


def test_merge_profiles_preserves_repeated_diagnostic_counts(tmp_path: Path) -> None:
    error = DiagnosticRecord("src/sentry/example.py", "no-untyped-def", "missing annotation")
    parent_primary = replace(
        _profile(Profile.ALL_STRONG, diagnostics=(error, error)), output_dir=tmp_path
    )
    supplemental = _profile(Profile.ALL_STRONG, diagnostics=(error, error))

    parent = _merge_profiles(Profile.ALL_STRONG, "tree", parent_primary, (supplemental,))

    candidate_primary = replace(parent_primary, diagnostics=(error, error, error))
    candidate = _merge_profiles(
        Profile.ALL_STRONG, "tree", candidate_primary, (supplemental,)
    )

    assert len(parent.diagnostics) == 2
    assert compare_error_debt(parent.diagnostics, candidate.diagnostics) == (error,)


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


def test_evaluate_accepts_unchanged_configured_debt() -> None:
    configured_error = DiagnosticRecord(
        "src/sentry/example.py", "arg-type", "existing configured debt"
    )
    parent = _tree(
        weak=frozenset({("sentry.example", "disallow_untyped_defs")}),
        configured_diagnostics=(configured_error,),
    )
    candidate = _tree(configured_diagnostics=(configured_error,))

    decision = decide_candidate(parent, candidate, require_adoption_credit=True)

    assert decision.outcome == Outcome.COMPLETE, decision.reasons
    assert decision.adoption_credit
    assert decision.details["configured_error_additions"] == []


def test_new_configured_diagnostic_rejects_candidate() -> None:
    configured_error = DiagnosticRecord(
        "src/sentry/example.py", "arg-type", "new configured debt"
    )

    decision = decide_candidate(
        _tree(),
        _tree(configured_diagnostics=(configured_error,)),
        require_adoption_credit=False,
    )

    assert decision.outcome == Outcome.REJECTED
    assert any("new configured error" in reason for reason in decision.reasons)


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


def test_trusted_policy_uses_committed_head_for_prior_candidate(tmp_path: Path) -> None:
    policy_path = "tools/mypy_helpers/typing_campaign.py"
    trusted_path = tmp_path / policy_path
    trusted_path.parent.mkdir(parents=True)
    trusted_path.write_bytes(b"trusted infrastructure")

    with (
        patch("tools.mypy_helpers.typing_campaign._POLICY_PATHS", (policy_path,)),
        patch(
            "tools.mypy_helpers.typing_campaign._tree_file",
            return_value=b"trusted infrastructure",
        ) as tree_file,
    ):
        _assert_trusted_policy(tmp_path)

    tree_file.assert_called_once_with(tmp_path, "HEAD", policy_path)


def test_trusted_policy_rejects_uncommitted_evaluator_changes(tmp_path: Path) -> None:
    policy_path = "tools/mypy_helpers/typing_campaign.py"
    trusted_path = tmp_path / policy_path
    trusted_path.parent.mkdir(parents=True)
    trusted_path.write_bytes(b"uncommitted change")

    with (
        patch("tools.mypy_helpers.typing_campaign._POLICY_PATHS", (policy_path,)),
        patch(
            "tools.mypy_helpers.typing_campaign._tree_file",
            return_value=b"committed infrastructure",
        ),
        pytest.raises(InvalidMeasurement, match="differs from committed HEAD"),
    ):
        _assert_trusted_policy(tmp_path)


def test_effective_pairs_uses_graph_module_for_generated_source() -> None:
    source = SourceFile(
        "src/sentry/releases/migrations/0001_release_models.py",
        None,
        SourceKind.OWNED_GENERATED,
    )
    state = ModuleState(
        "sentry.releases.migrations.0001_release_models",
        source.path,
        True,
        True,
        False,
        ("disallow_untyped_defs=false",),
        (),
        "normal",
        "False",
        (("disallow_untyped_defs", "False"),),
    )

    weak, _ = _effective_pairs((source,), (state,))

    assert (
        "sentry.releases.migrations.0001_release_models",
        "disallow_untyped_defs=false",
    ) in weak


def test_guard_detects_generated_source_weakening_without_inventory_module() -> None:
    source = SourceFile(
        "src/sentry/releases/migrations/0001_release_models.py",
        None,
        SourceKind.OWNED_GENERATED,
    )
    parent_state = ModuleState(
        "sentry.releases.migrations.0001_release_models",
        source.path,
        True,
        True,
        False,
        (),
        (),
        "normal",
        "False",
        (("disallow_untyped_defs", "True"),),
    )
    candidate_state = ModuleState(
        "sentry.releases.migrations.0001_release_models",
        source.path,
        True,
        True,
        False,
        (),
        (),
        "normal",
        "False",
        (("disallow_untyped_defs", "False"),),
    )

    additions, _, _ = _effective_option_changes(
        _tree(graph=(parent_state,), inventory=(source,)),
        _tree(graph=(candidate_state,), inventory=(source,)),
    )

    assert (
        "sentry.releases.migrations.0001_release_models",
        "disallow_untyped_defs=false",
    ) in additions


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
            {
                AnyObligation(
                    "src/sentry/example.py",
                    "precision:ast:abc#0:any-leaf:0",
                    "return",
                    "explicit",
                )
            }
        )
    )

    decision = decide_candidate(parent, candidate, require_adoption_credit=False)

    assert decision.outcome == Outcome.REJECTED
    assert any("new Any obligation" in reason for reason in decision.reasons)


def test_precision_any_origin_and_position_changes_keep_the_same_debt_identity() -> None:
    path = "src/sentry/example.py"
    anchor = "precision:ast:abc#0:any-leaf:0"
    parent_any = AnyObligation(path, anchor, "expression:0", "from_another_any")
    candidate_any = AnyObligation(path, anchor, "expression:0.1", "from_error")
    profiles = tuple(Profile)
    parent = _tree(
        any_obligations=frozenset({parent_any}),
        precision_any_obligations=(parent_any,),
        source_digests={path: "before"},
        profiles=profiles,
    )
    candidate = _tree(
        any_obligations=frozenset({candidate_any}),
        precision_any_obligations=(candidate_any,),
        source_digests={path: "after"},
        profiles=profiles,
    )

    decision = decide_candidate(
        parent,
        candidate,
        require_adoption_credit=False,
        precision_calibrated=True,
    )

    assert decision.outcome == Outcome.COMPLETE, decision.reasons
    assert decision.details["new_any_obligations"] == []
    assert decision.details["any_obligation_metadata_changes"] == [
        {
            "path": path,
            "anchor": anchor,
            "parent_type_position": "expression:0",
            "candidate_type_position": "expression:0.1",
            "parent_origin": "from_another_any",
            "candidate_origin": "from_error",
        }
    ]


def test_source_changes_are_rejected_without_calibrated_precision() -> None:
    parent = _tree()
    candidate = _tree(source_digests={"src/sentry/example.py": "changed"})

    decision = decide_candidate(parent, candidate, require_adoption_credit=False)

    assert decision.outcome == Outcome.REJECTED
    assert not decision.precision_complete
    assert any("calibrated precision extraction" in reason for reason in decision.reasons)


def test_precision_residual_in_unchanged_file_allows_measuring_other_source_change() -> None:
    changed_path = "src/sentry/changed.py"
    residual_path = "src/sentry/residual.py"
    residual = AnyObligation(
        residual_path,
        "unanchored:OpExpr:divmod:10:-1:None:None",
        "expression:0",
        "unannotated",
    )
    inventory = (
        SourceFile(changed_path, "sentry.changed", SourceKind.OWNED_IMPLEMENTATION),
        SourceFile(residual_path, "sentry.residual", SourceKind.OWNED_IMPLEMENTATION),
    )
    parent = _tree(
        any_obligations=frozenset({residual}),
        precision_any_obligations=(residual,),
        unanchored_any_count=1,
        source_digests={changed_path: "before", residual_path: "same"},
        profiles=tuple(Profile),
        inventory=inventory,
    )
    candidate = _tree(
        any_obligations=frozenset({residual}),
        precision_any_obligations=(residual,),
        unanchored_any_count=1,
        source_digests={changed_path: "after", residual_path: "same"},
        profiles=tuple(Profile),
        inventory=inventory,
    )

    decision = decide_candidate(
        parent,
        candidate,
        require_adoption_credit=False,
        precision_calibrated=True,
    )

    assert decision.outcome == Outcome.COMPLETE, decision.reasons
    assert decision.precision_complete
    residual_details = cast(dict[str, object], decision.details["precision_residuals"])
    assert residual_details["parent"] == {
        "expression_count": 1,
        "obligation_count": 1,
        "paths": [residual_path],
    }
    assert residual_details["candidate"] == residual_details["parent"]
    assert residual_details["non_unchanged_source_obligation_count"] == 0
    assert residual_details["non_unchanged_source_residual_paths"] == []


def test_precision_residual_in_changed_file_blocks_precision_completeness() -> None:
    changed_path = "src/sentry/changed.py"
    residual_path = "src/sentry/residual.py"
    residual = AnyObligation(
        residual_path,
        "unanchored:OpExpr:divmod:10:-1:None:None",
        "expression:0",
        "unannotated",
    )
    inventory = (
        SourceFile(changed_path, "sentry.changed", SourceKind.OWNED_IMPLEMENTATION),
        SourceFile(residual_path, "sentry.residual", SourceKind.OWNED_IMPLEMENTATION),
    )
    parent = _tree(
        any_obligations=frozenset({residual}),
        precision_any_obligations=(residual,),
        unanchored_any_count=1,
        source_digests={changed_path: "before", residual_path: "before"},
        profiles=tuple(Profile),
        inventory=inventory,
    )
    candidate = _tree(
        any_obligations=frozenset({residual}),
        precision_any_obligations=(residual,),
        unanchored_any_count=1,
        source_digests={changed_path: "after", residual_path: "after"},
        profiles=tuple(Profile),
        inventory=inventory,
    )

    decision = decide_candidate(
        parent,
        candidate,
        require_adoption_credit=False,
        precision_calibrated=True,
    )

    assert decision.outcome == Outcome.REJECTED
    assert not decision.precision_complete
    assert any(
        "unanchored Any obligation rows without unchanged source digests" in reason
        and residual_path in reason
        for reason in decision.reasons
    )
    residual_details = cast(dict[str, object], decision.details["precision_residuals"])
    assert residual_details["non_unchanged_source_obligation_count"] == 2
    assert residual_details["non_unchanged_source_residual_paths"] == [residual_path]


def test_new_unanchored_any_residual_is_rejected_by_any_set_comparison() -> None:
    changed_path = "src/sentry/changed.py"
    residual_path = "src/sentry/residual.py"
    residual = AnyObligation(
        residual_path,
        "unanchored:OpExpr:divmod:10:-1:None:None",
        "expression:0",
        "unannotated",
    )
    inventory = (
        SourceFile(changed_path, "sentry.changed", SourceKind.OWNED_IMPLEMENTATION),
        SourceFile(residual_path, "sentry.residual", SourceKind.OWNED_IMPLEMENTATION),
    )
    parent = _tree(
        source_digests={changed_path: "before", residual_path: "same"},
        profiles=tuple(Profile),
        inventory=inventory,
    )
    candidate = _tree(
        any_obligations=frozenset({residual}),
        precision_any_obligations=(residual,),
        unanchored_any_count=1,
        source_digests={changed_path: "after", residual_path: "same"},
        profiles=tuple(Profile),
        inventory=inventory,
    )

    decision = decide_candidate(
        parent,
        candidate,
        require_adoption_credit=False,
        precision_calibrated=True,
    )

    assert decision.outcome == Outcome.REJECTED
    assert decision.precision_complete
    assert any("new Any obligation" in reason for reason in decision.reasons)


@pytest.mark.parametrize("incomplete_gate", ["unknown-origin", "coverage-gap"])
def test_source_change_precision_still_rejects_unknown_origins_and_coverage_gaps(
    incomplete_gate: str,
) -> None:
    source_path = "src/sentry/example.py"
    parent = _tree(
        source_digests={source_path: "before"},
        profiles=tuple(Profile),
    )
    candidate = _tree(
        source_digests={source_path: "after"},
        profiles=tuple(Profile),
    )
    if incomplete_gate == "unknown-origin":
        unknown = AnyObligation(source_path, "ast:unknown#0", "return", "unknown-origin")
        parent = replace(parent, any_obligations=frozenset({unknown}))
        candidate = replace(candidate, any_obligations=frozenset({unknown}))
    else:
        candidate = replace(candidate, precision_gaps=("precision source coverage missing",))

    decision = decide_candidate(
        parent,
        candidate,
        require_adoption_credit=False,
        precision_calibrated=True,
    )

    assert decision.outcome == Outcome.REJECTED
    assert not decision.precision_complete
    assert any("source changes require calibrated precision extraction" in reason for reason in decision.reasons)


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


def test_signature_any_obligations_allow_a_precise_return_improvement() -> None:
    source_path = "src/sentry/example.py"
    symbol = "sentry.example.lookup#1"
    key = (source_path, symbol, "return")
    obligation = AnyObligation(source_path, f"signature:{symbol}", "return:0", "explicit")
    parent = _tree(
        weak=frozenset({("sentry.example", "disallow_untyped_defs")}),
        any_obligations=frozenset({obligation}),
        precision_any_obligations=(obligation,),
        signatures={key: "Any"},
        source_digests={source_path: "before"},
        profiles=tuple(Profile),
    )
    candidate = _tree(
        signatures={key: "User"},
        source_digests={source_path: "after"},
        profiles=tuple(Profile),
    )

    decision = decide_candidate(
        parent,
        candidate,
        require_adoption_credit=True,
        precision_calibrated=True,
    )

    assert decision.outcome == Outcome.COMPLETE, decision.reasons
    assert decision.details["signature_improvements"] == [key]


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


def test_terminal_completion_keeps_precision_residuals_as_outstanding_debt() -> None:
    residual_path = "src/sentry/residual.py"
    residual = AnyObligation(
        residual_path,
        "unanchored:OpExpr:divmod:10:-1:None:None",
        "expression:0",
        "unannotated",
    )
    measurement = _tree(
        any_obligations=frozenset({residual}),
        precision_any_obligations=(residual,),
        unanchored_any_count=1,
        profiles=tuple(Profile),
        inventory=(SourceFile(residual_path, "sentry.residual", SourceKind.OWNED_IMPLEMENTATION),),
    )

    decision = decide_terminal(measurement, precision_calibrated=True)

    assert decision.outcome == Outcome.REJECTED
    assert not decision.precision_complete
    assert any("Any expressions lack stable AST anchors" in reason for reason in decision.reasons)
    precision_residuals = cast(dict[str, object], decision.details["precision_residuals"])
    assert precision_residuals["paths"] == [residual_path]


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


def test_evaluate_series_cli_accepts_ordered_candidate_trees(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    with (
        patch("tools.mypy_helpers.typing_campaign._prepare_output", return_value=tmp_path),
        patch(
            "tools.mypy_helpers.typing_campaign._command_evaluate_series",
            return_value=(ExitCode.COMPLETE, {"outcome": "complete"}),
        ) as evaluate_series,
    ):
        exit_code = main(
            [
                "evaluate-series",
                "--parent",
                "accepted-parent",
                "--candidate-tree",
                "candidate-one",
                "--candidate-tree",
                "candidate-two",
                "--output",
                ".work/tmp/series",
            ]
        )

    assert exit_code == ExitCode.COMPLETE
    assert evaluate_series.call_args.kwargs["parent_reference"] == "accepted-parent"
    assert evaluate_series.call_args.kwargs["candidate_references"] == [
        "candidate-one",
        "candidate-two",
    ]
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

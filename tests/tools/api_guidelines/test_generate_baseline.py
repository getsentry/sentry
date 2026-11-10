from __future__ import annotations

from tools.api_guidelines.generate_baseline import build_entries
from tools.api_guidelines.rules import ApiRule
from tools.flake8_plugin import ApiInputViolation

PATH = "src/sentry/api/endpoints/example.py"
OWNER_MAP = {PATH: {"ExampleEndpoint": "issues-feed"}}
TODAY = "2026-11-09"


def _violation(
    rule: str, scope: str, key: str, line: int = 1, caller: str | None = None, path: str = PATH
) -> tuple[str, ApiInputViolation]:
    """A (path, finding) pair, the shape `build_entries` takes"""
    violation = ApiInputViolation(
        rule=ApiRule(rule),
        message="m",
        line=line,
        column=0,
        end_line=line,
        end_column=1,
        severity="warning",
        scope=scope,
        key=key,
        caller=caller,
    )
    return (path, violation)


def test_findings_with_the_same_signature_become_one_counted_entry() -> None:
    entries = build_entries(
        [
            _violation("S026", "ExampleEndpoint.get", "query:id", line=5),
            _violation("S026", "ExampleEndpoint.get", "query:id", line=9),
        ],
        OWNER_MAP,
        TODAY,
    )
    assert len(entries) == 1
    assert entries[0]["count"] == 2


def test_same_key_in_different_scopes_stays_separate() -> None:
    entries = build_entries(
        [
            _violation("S026", "ExampleEndpoint.get", "query:id"),
            _violation("S026", "ExampleEndpoint.put", "query:id"),
        ],
        OWNER_MAP,
        TODAY,
    )
    assert len(entries) == 2
    assert entries[0]["count"] == 1
    assert entries[1]["count"] == 1


def test_entry_has_the_imported_defaults_and_field_order() -> None:
    entries = build_entries(
        [_violation("S028", "ExampleEndpoint.get", "body:helper")], OWNER_MAP, TODAY
    )
    assert entries == [
        {
            "rule": "S028",
            "path": PATH,
            "scope": "ExampleEndpoint.get",
            "key": "body:helper",
            "count": 1,
            "owner": "issues-feed",
            "status": "debt-breaking",
            "reason": "legacy: predates S028",
            "first_seen": TODAY,
        }
    ]
    assert list(entries[0].keys()) == [
        "rule",
        "path",
        "scope",
        "key",
        "count",
        "owner",
        "status",
        "reason",
        "first_seen",
    ]
    assert type(entries[0]["rule"]) is str


def test_module_level_helper_gets_its_owner_through_the_caller() -> None:
    entries = build_entries(
        [_violation("S026", "build_query", "query:id", caller="ExampleEndpoint.get")],
        OWNER_MAP,
        TODAY,
    )
    assert entries[0]["owner"] == "issues-feed"


def test_caller_comes_from_the_first_finding_of_a_signature() -> None:
    owner_map = {PATH: {"ExampleEndpoint": "issues-feed", "OtherEndpoint": "ingest"}}
    entries = build_entries(
        [
            _violation("S026", "build_query", "query:id", line=5, caller="OtherEndpoint.get"),
            _violation("S026", "build_query", "query:id", line=9, caller="ExampleEndpoint.get"),
        ],
        owner_map,
        TODAY,
    )
    assert entries[0]["count"] == 2
    assert entries[0]["owner"] == "ingest"


def test_file_missing_from_the_owner_map_is_unowned() -> None:
    entries = build_entries(
        [_violation("S026", "OtherEndpoint.get", "query:id", path="src/sentry/other.py")],
        OWNER_MAP,
        TODAY,
    )
    assert entries[0]["owner"] == "unowned"


def test_path_is_normalized() -> None:
    entries = build_entries(
        [_violation("S026", "ExampleEndpoint.get", "query:id", path=f"./{PATH}")],
        OWNER_MAP,
        TODAY,
    )
    assert entries[0]["path"] == PATH
    # the owner lookup uses the normalized path too
    assert entries[0]["owner"] == "issues-feed"


def test_entries_are_sorted_by_path_scope_rule_then_key() -> None:
    other_path = "src/sentry/api/endpoints/aaa.py"
    entries = build_entries(
        [
            _violation("S026", "ExampleEndpoint.put", "query:b"),
            _violation("S028", "ExampleEndpoint.get", "query:a"),
            _violation("S026", "ExampleEndpoint.get", "query:b"),
            _violation("S026", "ExampleEndpoint.get", "query:a"),
            _violation("S026", "OtherEndpoint.get", "query:a", path=other_path),
        ],
        OWNER_MAP,
        TODAY,
    )
    order = []
    for entry in entries:
        order.append((entry["path"], entry["scope"], entry["rule"], entry["key"]))
    assert order == [
        (other_path, "OtherEndpoint.get", "S026", "query:a"),
        (PATH, "ExampleEndpoint.get", "S026", "query:a"),
        (PATH, "ExampleEndpoint.get", "S026", "query:b"),
        (PATH, "ExampleEndpoint.get", "S028", "query:a"),
        (PATH, "ExampleEndpoint.put", "S026", "query:b"),
    ]


def test_no_findings_gives_no_entries() -> None:
    assert build_entries([], OWNER_MAP, TODAY) == []

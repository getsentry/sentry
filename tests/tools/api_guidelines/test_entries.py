from __future__ import annotations

from tools.api_guidelines.entries import describe_entry, diff_entries

PATH = "src/sentry/api/endpoints/example.py"


def _entry(key: str, count: int) -> dict[str, object]:
    """A small entry for the diff_entries tests, only the fields it reads"""
    return {
        "rule": "S026",
        "path": PATH,
        "scope": "ExampleEndpoint.get",
        "key": key,
        "count": count,
        "owner": "issues-feed",
    }


def test_diff_entries_finds_added_removed_and_changed() -> None:
    old = [_entry("query:a", 1), _entry("query:b", 2), _entry("query:c", 1)]
    new = [_entry("query:a", 1), _entry("query:b", 3), _entry("query:d", 1)]

    added, removed, changed = diff_entries(old_entries=old, new_entries=new)

    assert added == [_entry("query:d", 1)]
    assert removed == [_entry("query:c", 1)]
    assert changed == [(_entry("query:b", 2), _entry("query:b", 3))]


def test_diff_entries_with_no_changes() -> None:
    entries = [_entry("query:a", 1)]

    assert diff_entries(old_entries=entries, new_entries=entries) == ([], [], [])


def test_describe_entry_names_rule_path_scope_key_and_owner() -> None:
    assert describe_entry(_entry("query:a", 1)) == (
        "S026 src/sentry/api/endpoints/example.py ExampleEndpoint.get query:a (issues-feed)"
    )


def test_describe_entry_without_a_key() -> None:
    entry = _entry("query:a", 1)
    entry["key"] = None

    assert describe_entry(entry) == (
        "S026 src/sentry/api/endpoints/example.py ExampleEndpoint.get - (issues-feed)"
    )

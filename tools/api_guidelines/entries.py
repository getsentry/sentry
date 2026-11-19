from __future__ import annotations

from pathlib import Path

EXCEPTIONS_PATH = Path("api_exceptions/exceptions.json")


def entry_signature(entry: dict[str, object]) -> tuple[object, object, object, object]:
    """An entry's (rule, path, scope, key), which is what identifies it between runs"""
    return (entry["rule"], entry["path"], entry["scope"], entry["key"])


def _entry_sort_key(entry: dict[str, object]) -> tuple[str, str, str, str]:
    """The order exceptions.json is sorted in, for entries that are already dicts: path, scope, rule, then key"""
    return (str(entry["path"]), str(entry["scope"]), str(entry["rule"]), str(entry["key"] or ""))


def merge_entries(
    new_entries: list[dict[str, object]],
    old_entries: list[dict[str, object]],
    kept_entries: list[dict[str, object]],
) -> list[dict[str, object]]:
    """Merges the rescanned files' entries back into the rest of exceptions.json
    `new_entries` the entries built from rescanning the `--files` paths
    `old_entries` every entry in exceptions.json before this run
    `kept_entries` the old entries for files that weren't rescanned, kept as is
    Returns every entry, sorted by path, scope, rule and key. A rescanned entry that was already
    in the file keeps its status, reason and first_seen, and takes the new count and owner
    """
    # {(rule, path, scope, key) -> {entry dict}}
    old_by_signature: dict[tuple[object, object, object, object], dict[str, object]] = {}

    for entry in old_entries:
        old_by_signature[entry_signature(entry)] = entry

    # list of entries that shouldn't be modified and should be merged with new entries
    merged: list[dict[str, object]] = []
    for entry in kept_entries:
        merged.append(entry)

    for entry in new_entries:
        old = old_by_signature.get(entry_signature(entry))
        # the finding was already recorded so keep what was decided about it and when it was first seen
        if old is not None:
            entry["status"] = old["status"]
            entry["reason"] = old["reason"]
            entry["first_seen"] = old["first_seen"]
        merged.append(entry)

    merged.sort(key=_entry_sort_key)
    return merged


def diff_entries(
    old_entries: list[dict[str, object]],
    new_entries: list[dict[str, object]],
) -> tuple[
    list[dict[str, object]],
    list[dict[str, object]],
    list[tuple[dict[str, object], dict[str, object]]],
]:
    """Compares two versions of exceptions.json, i.e before and after a --files run, or an older
    file and the current one for the report card's --compare
    `old_entries` every entry in the older version
    `new_entries` every entry in the newer version
    Returns (added, removed, changed): the entries that are new, the entries that are gone (fixed),
    and (old, new) pairs for the entries whose count changed
    """
    old_by_signature: dict[tuple[object, object, object, object], dict[str, object]] = {}
    for entry in old_entries:
        old_by_signature[entry_signature(entry)] = entry

    new_signatures: set[tuple[object, object, object, object]] = set()
    added: list[dict[str, object]] = []
    changed: list[tuple[dict[str, object], dict[str, object]]] = []
    for entry in new_entries:
        signature = entry_signature(entry)
        new_signatures.add(signature)
        old = old_by_signature.get(signature)
        if old is None:
            added.append(entry)
        elif old["count"] != entry["count"]:
            changed.append((old, entry))

    removed: list[dict[str, object]] = []
    for entry in old_entries:
        if entry_signature(entry) not in new_signatures:
            removed.append(entry)

    return added, removed, changed


def describe_entry(entry: dict[str, object], with_owner: bool = True) -> str:
    """One line naming an entry for the printed summary: rule, path, scope, key and owner
    `with_owner` False leaves the "(owner)" off, for output already grouped by team
    """
    line = f"{entry['rule']} {entry['path']} {entry['scope']} {entry['key'] or '-'}"
    if with_owner:
        line += f" ({entry['owner']})"
    return line

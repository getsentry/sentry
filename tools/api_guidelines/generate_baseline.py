from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

from tools.api_guidelines.owners import owner_for
from tools.api_guidelines.rules import BASELINED_RULES
from tools.api_guidelines.scan import collect_findings
from tools.api_guidelines.signature import BaselineSignature, normalize_path
from tools.flake8_plugin import ApiInputViolation

EXCEPTIONS_PATH = Path("api_exceptions/exceptions.json")
OWNER_MAP_PATH = Path(".artifacts/api-endpoint-owners.json")
_REPO_ROOT = Path(__file__).resolve().parents[2]


def _sort_key(signature: BaselineSignature) -> tuple[str, str, str, str]:
    """A helper for organizing entries into exceptions.json's in sorted order: path, then scope, then rule, then key (key can be None)"""
    return (signature.path, signature.scope, signature.rule, signature.key or "")


def build_entries(
    findings: list[tuple[str, ApiInputViolation]],
    owner_map: dict[str, dict[str, str]],
    today: str,
) -> list[dict[str, object]]:
    """One entry per signature (rule, path, scope, key), counted, with the imported defaults
    `findings` a list of (path of the violation, ApiInputViolation) pairs
    `owner_map` {path: {class name: owner}}, from `make api-owner-map`
    `today` a string representing the date the entry was added to exceptions.json

    Returns a list of entry dicts that are sorted by path, scope, rule, and key
    """

    # {signature: (how many times it appeared -> count, the caller of its first violation -> caller)}
    count_caller_signature: dict[BaselineSignature, tuple[int, str | None]] = {}

    for path, finding in findings:
        new_signature = BaselineSignature(
            rule=finding.rule, path=path, scope=finding.scope, key=finding.key
        )

        # check if the signature is already in the dict
        if new_signature in count_caller_signature:
            # add one to its count and keep the first violation's caller
            count, first_caller = count_caller_signature[new_signature]
            count_caller_signature[new_signature] = (count + 1, first_caller)

        else:
            count_caller_signature[new_signature] = (1, finding.caller)

    # go through the signatures in sorted order: path, then scope, then rule, then key
    entries: list[dict[str, object]] = []
    for signature in sorted(count_caller_signature, key=_sort_key):
        count, first_caller = count_caller_signature[signature]

        entries.append(
            {
                "rule": str(signature.rule),
                "path": signature.path,
                "scope": signature.scope,
                "key": signature.key,
                "count": count,
                "owner": owner_for(signature.path, signature.scope, first_caller, owner_map),
                # the safe default until the review issue sets the real status
                "status": "debt-breaking",
                "reason": f"legacy: predates {signature.rule}",
                "first_seen": today,
            }
        )

    return entries


def write_exceptions(entries: list[dict[str, object]], dest_file: Path) -> None:
    """Writes entries to the exceptions.json file.
    `entries` a list of already generated entries to go into the exceptions.json baseline
    `dest_file` the path of the file to write to, i.e api_exceptions/exceptions.json. Its folder is created if it doesn't exist and an existing file is replaced
    Returns nothing since it only writes the file

    Note: we need dest_file as a param, even though every time this is called `dest_file` is almost always exceptions.json just for handling test cases since we don't want to override exceptions.json for testing
    """

    # turn each entry into one line of JSON
    json_lines: list[str] = []
    for entry in entries:
        json_lines.append(json.dumps(entry))

    if json_lines:
        text = '{"version": 1, "entries": [\n' + ",\n".join(json_lines) + "\n]}\n"
    else:
        text = '{"version": 1, "entries": []}\n'

    # create the output's folder if needed then write the file (create it or replace it)
    dest_file.parent.mkdir(parents=True, exist_ok=True)
    dest_file.write_text(text)


def _entry_signature(entry: dict[str, object]) -> tuple[object, object, object, object]:
    """An entry's (rule, path, scope, key), which is what identifies it between runs"""
    return (entry["rule"], entry["path"], entry["scope"], entry["key"])


def _entry_sort_key(entry: dict[str, object]) -> tuple[str, str, str, str]:
    """The same order as _sort_key, for entries that are already dicts: path, scope, rule, then key"""
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
        old_by_signature[_entry_signature(entry)] = entry

    # list of entries that shouldn't be modified and should be merged with new entries
    merged: list[dict[str, object]] = []
    for entry in kept_entries:
        merged.append(entry)

    for entry in new_entries:
        old = old_by_signature.get(_entry_signature(entry))
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
    """Compares exceptions.json before and after a run
    `old_entries` every entry in the file before this run
    `new_entries` every entry this run writes
    Returns (added, removed, changed): the entries that are new, the entries that are gone (fixed),
    and (old, new) pairs for the entries whose count changed
    """
    old_by_signature: dict[tuple[object, object, object, object], dict[str, object]] = {}
    for entry in old_entries:
        old_by_signature[_entry_signature(entry)] = entry

    new_signatures: set[tuple[object, object, object, object]] = set()
    added: list[dict[str, object]] = []
    changed: list[tuple[dict[str, object], dict[str, object]]] = []
    for entry in new_entries:
        signature = _entry_signature(entry)
        new_signatures.add(signature)
        old = old_by_signature.get(signature)
        if old is None:
            added.append(entry)
        elif old["count"] != entry["count"]:
            changed.append((old, entry))

    removed: list[dict[str, object]] = []
    for entry in old_entries:
        if _entry_signature(entry) not in new_signatures:
            removed.append(entry)

    return added, removed, changed


def _describe(entry: dict[str, object]) -> str:
    """One line naming an entry for the printed summary: rule, path, scope, key and owner"""
    return (
        f"{entry['rule']} {entry['path']} {entry['scope']} {entry['key'] or '-'} ({entry['owner']})"
    )


def main(argv: list[str] | None = None) -> int:
    """Generates the exceptions.json baseline from every existing API violation.
    `argv` the CLI arguments. None means use the real ones (tests pass their own list)
    Returns 0 when the file was written and 1 when it stopped early
    """

    # parse and read the arguments
    parser = argparse.ArgumentParser(description="Generate the API exceptions baseline once.")
    parser.add_argument("--owner-map", type=Path, default=_REPO_ROOT / OWNER_MAP_PATH)
    parser.add_argument("--output", type=Path, default=_REPO_ROOT / EXCEPTIONS_PATH)
    parser.add_argument("--date", type=str, default=date.today().isoformat())
    parser.add_argument("--force", action="store_true")
    parser.add_argument(
        "--files", nargs="+", help="only rescan these files and merge them into the existing file"
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=_REPO_ROOT,
        help="the checkout to scan, i.e an older commit's worktree. The rules, owner map and output still come from this checkout",
    )
    args = parser.parse_args(argv)

    if not args.owner_map.exists():
        print(
            f"{args.owner_map} not found. Run `make api-owner-map` first (needs Redis: `devservices up`).",
            file=sys.stderr,
        )
        return 1

    if args.files:
        if not args.output.exists():
            print(
                f"{args.output} not found. Run without --files first to generate it.",
                file=sys.stderr,
            )
            return 1
    elif args.output.exists() and not args.force:
        print(
            f"{args.output} already exists. Pass --force to replace it (this resets every reviewed status and reason).",
            file=sys.stderr,
        )
        return 1

    if not (args.root / "src").is_dir():
        print(
            f"{args.root} has no src folder. Pass the top folder of a sentry checkout.",
            file=sys.stderr,
        )
        return 1

    owner_map: dict[str, dict[str, str]] = json.loads(args.owner_map.read_text())

    rescan_paths: list[str] | None = None
    old_entries: list[dict[str, object]] = []
    kept_entries: list[dict[str, object]] = []

    if args.files:
        rescan_paths = []
        for path in args.files:
            path = normalize_path(path)
            if path.startswith("src/") and path.endswith(".py"):
                rescan_paths.append(path)

        old_entries = json.loads(args.output.read_text())["entries"]
        for entry in old_entries:
            if entry["path"] not in rescan_paths:
                kept_entries.append(entry)

    # the scan returns every rule's findings, and only the rules with a baseline are kept. This
    # happens before build_entries so the count check below still adds up
    finding: list[tuple[str, ApiInputViolation]] = []
    for path, scanned in collect_findings(args.root, rescan_paths):
        if scanned.rule in BASELINED_RULES:
            finding.append((path, scanned))

    entries = build_entries(findings=finding, owner_map=owner_map, today=args.date)

    # every finding should land in exactly one entry so stop before writing a wrong file
    counted = 0
    for entry in entries:
        count = entry["count"]
        assert isinstance(count, int)
        counted += count

    if counted != len(finding):
        print(
            f"bug: entries count {counted} findings but the scan found {len(finding)}",
            file=sys.stderr,
        )
        return 1

    if args.files:
        entries = merge_entries(
            new_entries=entries, old_entries=old_entries, kept_entries=kept_entries
        )

    write_exceptions(entries, dest_file=args.output)

    if args.files:
        assert rescan_paths is not None
        added, removed, changed = diff_entries(old_entries=old_entries, new_entries=entries)
        print(
            f"Rescanned {len(rescan_paths)} files ({len(finding)} findings). {args.output} now has {len(entries)} entries"
        )
        print(f"    {len(added)} new, {len(removed)} fixed, {len(changed)} with a changed count")
        for entry in added:
            print(f"    new    {_describe(entry)}")
        for entry in removed:
            print(f"    fixed  {_describe(entry)}")
        for old, new in changed:
            print(f"    count  {_describe(new)}: {old['count']} -> {new['count']}")
    else:
        print(f"Wrote {len(entries)} entries ({len(finding)} findings) to {args.output}")

    # the per-owner totals cover the whole file so with `--files` they include the entries that weren't rescanned
    findings_per_owner: Counter[str] = Counter()
    entries_per_owner: Counter[str] = Counter()
    for entry in entries:
        count = entry["count"]
        assert isinstance(count, int)
        owner = str(entry["owner"])
        findings_per_owner[owner] += count
        entries_per_owner[owner] += 1

    # unowned is expected to be ~25 findings so many more means the owner map is stale (re-run make api-owner-map)
    print(f"    {'owner':35}{'findings':>9}{'entries':>9}")
    for owner, findings in findings_per_owner.most_common():
        print(f"    {owner:35}{findings:>9}{entries_per_owner[owner]:>9}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

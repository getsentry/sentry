from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import Counter
from datetime import date
from pathlib import Path

from tools.api_guidelines.entries import (
    EXCEPTIONS_PATH,
    describe_entry,
    diff_entries,
    merge_entries,
)
from tools.api_guidelines.owners import owner_for
from tools.api_guidelines.rules import BASELINED_RULES
from tools.api_guidelines.scan import collect_findings
from tools.api_guidelines.signature import BaselineSignature
from tools.flake8_plugin import ApiInputViolation

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


def write_exceptions(
    entries: list[dict[str, object]], dest_file: Path, generated: str, commit: str | None = None
) -> None:
    """Writes entries to the exceptions.json file.
    `entries` a list of already generated entries to go into the exceptions.json baseline
    `dest_file` the path of the file to write to, i.e api_exceptions/exceptions.json. Its folder is created if it doesn't exist and an existing file is replaced
    `generated` the date of this run, written at the top so the report card can say what the file is as of
    `commit` the commit of the last full scan, so you can tell what code the file reflects. A
    `--files` run keeps the previous value since most entries weren't rescanned
    Returns nothing since it only writes the file

    Note: we need dest_file as a param, even though every time this is called `dest_file` is almost always exceptions.json just for handling test cases since we don't want to override exceptions.json for testing
    """

    data = {"version": 1, "generated": generated, "commit": commit, "entries": entries}

    # create the output's folder if needed then write the file (create it or replace it)
    dest_file.parent.mkdir(parents=True, exist_ok=True)
    dest_file.write_text(json.dumps(data, indent=2) + "\n")


def _possible_moves(
    removed: list[dict[str, object]], added: list[dict[str, object]]
) -> list[tuple[dict[str, object], dict[str, object]]]:
    """Finds entries that look like they moved to another file, i.e because the file was renamed
    `removed` the entries a run removed
    `added` the entries a run added
    Returns (removed, added) pairs with the same rule, scope and key in different files. A moved
    entry starts over with the defaults, so its old status and reason need copying by hand
    """
    # {(rule, scope, key) -> [added entries]}
    added_by_finding: dict[tuple[object, object, object], list[dict[str, object]]] = {}
    for entry in added:
        added_by_finding.setdefault((entry["rule"], entry["scope"], entry["key"]), []).append(entry)

    moves: list[tuple[dict[str, object], dict[str, object]]] = []
    for old in removed:
        for new in added_by_finding.get((old["rule"], old["scope"], old["key"]), []):
            moves.append((old, new))
    return moves


def _rescan_path(path: str, root: Path) -> str | None:
    """A `--files` path as a repo-relative path in `root`
    `path` the path as given, i.e "src/sentry/a.py", "./src/sentry/a.py" or an absolute path inside `root`
    `root` the checkout being scanned
    Returns the path like "src/sentry/a.py", or None when it isn't a Python file under root/src
    """
    path = path.replace("\\", "/")
    if path.startswith("/"):
        try:
            path = Path(path).resolve().relative_to(root.resolve()).as_posix()
        except ValueError:
            return None

    path = path.removeprefix("./")
    if not (path.startswith("src/") and path.endswith(".py")):
        return None
    return path


def _head_commit(root: Path) -> str | None:
    """The commit checked out in `root`. Local changes that aren't committed aren't part of it
    `root` the checkout that was scanned
    Returns None when `root` isn't the top of a git checkout, i.e a plain copy that sits inside
    another repo, where git would answer with the outer repo's HEAD
    """
    try:
        result = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "--show-toplevel", "HEAD"],
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return None
    if result.returncode != 0:
        return None
    toplevel, commit = result.stdout.splitlines()
    if Path(toplevel).resolve() != root.resolve():
        return None
    return commit


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
        "--update",
        action="store_true",
        help="rescan every file and merge into the existing file, keeping each entry's status, reason and first_seen",
    )
    parser.add_argument(
        "--commit",
        help="the commit to record in the file. Defaults to the scanned checkout's HEAD, or the existing file's commit with --files",
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

    if args.update and (args.files or args.force):
        print("--update can't be combined with --files or --force.", file=sys.stderr)
        return 1

    # --files and --update both merge into the existing file instead of replacing it
    merging = bool(args.files) or args.update

    if merging:
        if not args.output.exists():
            print(
                f"{args.output} not found. Run without --files or --update first to generate it.",
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

    # {path of a file that's gone but wasn't in --files -> how many entries it had}
    unlisted_gone: Counter[str] = Counter()

    old_commit: str | None = None
    if merging:
        old_data = json.loads(args.output.read_text())
        old_entries = old_data["entries"]
        old_commit = old_data.get("commit")

    if args.files:
        paths_with_entries: set[object] = set()
        for entry in old_entries:
            paths_with_entries.add(entry["path"])

        rescan_paths = []
        for given in args.files:
            path = _rescan_path(given, args.root)
            if path is None:
                print(f"Skipped {given}: not a .py file under {args.root}/src", file=sys.stderr)
            # a missing file with entries was deleted so rescanning it removes them. Without
            # entries there's nothing to remove and it's often a typo like exampel.py
            elif not (args.root / path).exists() and path not in paths_with_entries:
                print(
                    f"Skipped {given}: it's not in {args.root} and has no entries (a typo, or a deleted file with no findings)",
                    file=sys.stderr,
                )
            # skip repeats too i.e file.py and ./file.py, so the "Rescanned N files" count is right
            elif path not in rescan_paths:
                rescan_paths.append(path)

        if not rescan_paths:
            print(
                "None of the --files paths can be rescanned. Nothing was changed.", file=sys.stderr
            )
            return 1

        for entry in old_entries:
            if entry["path"] in rescan_paths:
                continue
            # a file that's gone has no findings left, i.e it was renamed and only its new path was
            # listed. Keeping its entries would leave them next to the new ones. It has to be gone
            # from this checkout too: an older --root may not have a file that exists here yet
            path = str(entry["path"])
            if not (args.root / path).exists() and not (_REPO_ROOT / path).exists():
                unlisted_gone[path] += 1
                continue
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

    if merging:
        entries = merge_entries(
            new_entries=entries, old_entries=old_entries, kept_entries=kept_entries
        )

    if args.commit:
        commit: str | None = args.commit
    # only the listed files were scanned now, so the rest still reflects the last full scan
    elif args.files:
        commit = old_commit
    else:
        commit = _head_commit(args.root)
    write_exceptions(entries, dest_file=args.output, generated=args.date, commit=commit)

    if merging:
        added, removed, changed = diff_entries(old_entries=old_entries, new_entries=entries)
        rescanned = f"{len(rescan_paths)} files" if rescan_paths is not None else "every file"
        print(
            f"Rescanned {rescanned} ({len(finding)} findings). {args.output} now has {len(entries)} entries"
        )
        print(f"    {len(added)} new, {len(removed)} fixed, {len(changed)} with a changed count")
        for entry in added:
            print(f"    new    {describe_entry(entry)}")
        for entry in removed:
            print(f"    fixed  {describe_entry(entry)}")
        for old, new in changed:
            print(f"    count  {describe_entry(new)}: {old['count']} -> {new['count']}")
        moved_from: set[object] = set()
        for old, new in _possible_moves(removed, added):
            moved_from.add(old["path"])
            print(
                f"Possibly moved: {describe_entry(old)} -> {new['path']}. Its status and reason were not "
                "carried over, so copy them by hand if they were reviewed.",
                file=sys.stderr,
            )
        # a renamed file whose new path wasn't listed: its findings show up as new on the next run
        for path in sorted(unlisted_gone):
            if path not in moved_from:
                print(
                    f"Removed {unlisted_gone[path]} entries for {path}: the file is gone and it "
                    "wasn't in --files. If it was renamed, rescan its new path too.",
                    file=sys.stderr,
                )
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

    # unowned much higher than the last run means the owner map is stale (re-run make api-owner-map)
    print(f"    {'owner':35}{'findings':>9}{'entries':>9}")
    for owner, findings in findings_per_owner.most_common():
        print(f"    {owner:35}{findings:>9}{entries_per_owner[owner]:>9}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

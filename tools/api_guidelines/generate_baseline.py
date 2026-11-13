from __future__ import annotations

import argparse
import ast
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

from tools.api_guidelines.owners import owner_for
from tools.api_guidelines.rules import BASELINED_RULES
from tools.api_guidelines.signature import BaselineSignature
from tools.flake8_plugin import ApiInputViolation, get_api_violations

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


def collect_findings(root: Path) -> list[tuple[str, ApiInputViolation]]:
    """Collects every finding of a baselined rule (S025-S028) under root/src as a list
    `root` the repo's top folder, the one that contains /src
    Returns a list of (`path`, `ApiInputViolation`) pairs where path is repo-based (i.e, "src/sentry/etc")
    """

    files = sorted((root / "src").rglob("*.py"))

    # [("path", ApiInputViolation())]
    path_violation: list[tuple[str, ApiInputViolation]] = []

    for file in files:
        root_path = file.relative_to(root).as_posix()

        module_node = ast.parse(source=file.read_text(encoding="utf-8"), filename=root_path)

        violations = get_api_violations(tree=module_node, filename=root_path, all_rules=True)

        # one pair per violation and all point at the same file. Note that rules without a baseline are
        # skipped here and not later so the count check in main() still adds up
        for violation in violations:
            if violation.rule in BASELINED_RULES:
                path_violation.append((root_path, violation))

    return path_violation


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
    args = parser.parse_args(argv)

    if not args.owner_map.exists():
        print(
            f"{args.owner_map} not found. Run `make api-owner-map` first (needs Redis: `devservices up`).",
            file=sys.stderr,
        )
        return 1

    if args.output.exists() and not args.force:
        print(
            f"{args.output} already exists. Pass --force to replace it (this resets every reviewed status and reason).",
            file=sys.stderr,
        )
        return 1

    owner_map: dict[str, dict[str, str]] = json.loads(args.owner_map.read_text())

    finding = collect_findings(_REPO_ROOT)

    entries = build_entries(findings=finding, owner_map=owner_map, today=args.date)

    # add up the counts to print as summarries
    counted = 0
    findings_per_owner: Counter[str] = Counter()
    entries_per_owner: Counter[str] = Counter()

    for entry in entries:
        count = entry["count"]
        assert isinstance(count, int)
        owner = str(entry["owner"])

        counted += count
        findings_per_owner[owner] += count
        entries_per_owner[owner] += 1

    # every finding should land in exactly one entry so stop before writing a wrong file
    if counted != len(finding):
        print(
            f"bug: entries count {counted} findings but the scan found {len(finding)}",
            file=sys.stderr,
        )
        return 1

    write_exceptions(entries, dest_file=args.output)

    print(f"Wrote {len(entries)} entries ({len(finding)} findings) to {args.output}")

    # unowned is expected to be ~25 findings so many more means the owner map is stale (re-run make api-owner-map)
    print(f"    {'owner':35}{'findings':>9}{'entries':>9}")
    for owner, findings in findings_per_owner.most_common():
        print(f"    {owner:35}{findings:>9}{entries_per_owner[owner]:>9}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

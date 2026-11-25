from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from tools.api_guidelines.entries import EXCEPTIONS_PATH
from tools.api_guidelines.rules import BASELINED_RULES, RULES, ApiRule
from tools.api_guidelines.scan import collect_findings
from tools.api_guidelines.signature import BaselineSignature
from tools.flake8_plugin import ApiInputViolation

_REPO_ROOT = Path(__file__).resolve().parents[2]

Finding = tuple[str, ApiInputViolation]


def changed_paths(raw: str | None) -> list[str]:
    """The changed files the API rules can check
    `raw` CHANGED_FILES, a JSON array of repo paths. Empty when the PR changed over 1000 files
    Returns the Python files under src/, sorted and without duplicates
    """
    if not raw:
        return []

    kept: set[str] = set()
    for path in json.loads(raw):
        if path.startswith("src/") and path.endswith(".py"):
            kept.add(path)
    return sorted(kept)


def baselined_counts(exceptions_file: Path) -> dict[BaselineSignature, int]:
    """How many findings exceptions.json already records for each signature
    `exceptions_file` the exceptions.json to read
    Returns {signature: count}
    """
    data = json.loads(exceptions_file.read_text())
    counts: dict[BaselineSignature, int] = {}
    for entry in data["entries"]:
        signature = BaselineSignature(
            rule=ApiRule(entry["rule"]), path=entry["path"], scope=entry["scope"], key=entry["key"]
        )
        counts[signature] = int(entry["count"])
    return counts


def find_new(
    root: Path, paths: list[str], counts: dict[BaselineSignature, int]
) -> tuple[list[Finding], list[str]]:
    """Rescans `paths` and keeps the findings exceptions.json doesn't account for
    `root` the checkout to scan
    `paths` repo paths of the files to rescan
    `counts` {signature: count} from baselined_counts
    Returns (new findings, paths that couldn't be parsed). When a signature has more findings than
    its entry's count, every one of them is new, since there's no way to tell which line was added
    """
    by_signature: dict[BaselineSignature, list[Finding]] = {}
    unparsed: list[str] = []

    for path in paths:
        try:
            findings = collect_findings(root, [path])
        except (SyntaxError, UnicodeDecodeError):
            unparsed.append(path)
            continue

        for found_path, violation in findings:
            if violation.rule not in BASELINED_RULES:
                continue
            signature = BaselineSignature(
                rule=violation.rule, path=found_path, scope=violation.scope, key=violation.key
            )
            by_signature.setdefault(signature, []).append((found_path, violation))

    new: list[Finding] = []
    for signature, found in by_signature.items():
        if len(found) > counts.get(signature, 0):
            new += found
    new.sort(key=lambda finding: (finding[0], finding[1].line))
    return new, unparsed


def _escape_data(value: str) -> str:
    """A workflow command's message, escaped the way GitHub expects"""
    return value.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def _escape_property(value: str) -> str:
    """A workflow command's property (i.e file or title), escaped the way GitHub expects"""
    return _escape_data(value).replace(":", "%3A").replace(",", "%2C")


def format_finding(path: str, violation: ApiInputViolation) -> str:
    """One new finding as a github warning annotation that shows on that line of the PR
    `path` the finding's repo path
    `violation` the finding
    Returns a line like "::warning file=src/sentry/x.py,line=12,title=New API finding S026::S026 xyz"
    """
    rule = violation.rule
    message = (
        f"{rule} {RULES[rule].summary}. If it's intentional, mark it with "
        f"`# api-exception: {rule} <status> - <reason>` (this doesn't silence the warning yet)"
    )
    properties = f"file={_escape_property(path)},line={violation.line},title=New API finding {rule}"
    return f"::warning {properties}::{_escape_data(message)}"


def main(root: Path = _REPO_ROOT) -> int:
    """Prints the new findings in CHANGED_FILES
    `root` the checkout to scan
    Returns 0 every time, since the check is report-only
    """
    paths = changed_paths(os.environ.get("CHANGED_FILES"))
    if not paths:
        return 0

    try:
        counts = baselined_counts(root / EXCEPTIONS_PATH)
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"Couldn't read {EXCEPTIONS_PATH} ({error}), so no files were checked")
        return 0

    new, unparsed = find_new(root, paths, counts)
    for path in unparsed:
        print(f"::notice file={_escape_property(path)}::doesn't parse, so it wasn't checked")

    for path, violation in new:
        print(format_finding(path, violation))
    print(f"{len(new)} new API findings in {len(paths)} checked files")
    return 0


if __name__ == "__main__":
    sys.exit(main())

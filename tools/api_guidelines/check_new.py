from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from tools.api_guidelines.rules import BASELINED_RULES, RULES
from tools.api_guidelines.scan import collect_findings
from tools.api_guidelines.signature import BaselineSignature
from tools.flake8_plugin import ApiInputViolation

_REPO_ROOT = Path(__file__).resolve().parents[2]
# the comment step in .github/workflows/pre-commit.yml reads it from NEW_API_FINDINGS_PATH
FINDINGS_PATH = Path(".artifacts/new-api-findings.json")

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


def _git(root: Path, *args: str) -> bytes:
    """Runs git in `root`, leaving its errors on stderr for the workflow log
    `root` the checkout
    `args` the git arguments
    Returns git's stdout
    """
    return subprocess.run(["git", *args], cwd=root, stdout=subprocess.PIPE, check=True).stdout


def write_base_files(root: Path, merge_base: str, paths: list[str], into: Path) -> list[str]:
    """Writes each changed file's version at the merge base under `into`
    `root` the checkout, which only has the PR's head commit until the merge base is fetched
    `merge_base` the commit the PR branched from
    `paths` repo paths of the changed files
    `into` the folder to write them to
    Returns the paths that exist at the merge base, since a file the PR added has no base version
    """
    _git(root, "fetch", "--no-tags", "--depth=1", "origin", merge_base)
    listed = _git(root, "ls-tree", "-r", "-z", "--name-only", merge_base, "--", *paths)

    existing: list[str] = []
    for path in listed.decode().split("\0"):
        if not path:
            continue
        file = into / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(_git(root, "show", f"{merge_base}:{path}"))
        existing.append(path)
    return existing


def scan(root: Path, paths: list[str]) -> tuple[dict[BaselineSignature, list[Finding]], list[str]]:
    """Scans `paths` and groups the baselined rules' findings by signature
    `root` the folder the paths are under
    `paths` repo paths of the files to scan
    Returns ({signature: findings}, paths that couldn't be parsed)
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
    return by_signature, unparsed


def base_counts(base_root: Path, paths: list[str]) -> dict[BaselineSignature, int]:
    """How many findings each signature has in the base versions of the changed files
    `base_root` the folder write_base_files wrote them to
    `paths` repo paths of the files that exist at the merge base
    Returns {signature: count}. A base file that doesn't parse counts as having none
    """
    by_signature, _ = scan(base_root, paths)
    counts: dict[BaselineSignature, int] = {}
    for signature, found in by_signature.items():
        counts[signature] = len(found)
    return counts


def find_new(
    root: Path, paths: list[str], counts: dict[BaselineSignature, int]
) -> tuple[list[Finding], list[str]]:
    """Rescans `paths` and keeps the findings their base versions don't have
    `root` the checkout to scan
    `paths` repo paths of the files to rescan
    `counts` {signature: count} from base_counts
    Returns (new findings, paths that couldn't be parsed). When a signature has more findings than
    its base count, every one of them is new, since there's no way to tell which line was added
    """
    by_signature, unparsed = scan(root, paths)

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


def write_findings(file: Path, new: list[Finding]) -> None:
    """Writes the new findings as JSON for the step that comments them on the PR
    `file` where to write them
    `new` the new findings
    """
    rows: list[dict[str, object]] = []
    for path, violation in new:
        rule = RULES[violation.rule]
        rows.append(
            {
                "path": path,
                "line": violation.line,
                "rule": violation.rule,
                "title": rule.title,
                "fix": rule.fix,
            }
        )
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(rows))


def main(root: Path = _REPO_ROOT) -> int:
    """Prints the CHANGED_FILES findings that aren't at MERGE_BASE and writes them to FINDINGS_PATH
    `root` the checkout to scan
    Returns 1 only when the files at MERGE_BASE can't be read, so the PR comment says the check
    couldn't run. The workflow step's continue-on-error keeps that from blocking the PR
    """
    paths = changed_paths(os.environ.get("CHANGED_FILES"))
    if not paths:
        return 0

    merge_base = os.environ.get("MERGE_BASE")
    if not merge_base:
        print("No merge base, so no files were checked")
        return 1

    with tempfile.TemporaryDirectory() as base_dir:
        try:
            base_paths = write_base_files(root, merge_base, paths, Path(base_dir))
        except subprocess.CalledProcessError:
            print(f"Couldn't read the changed files at {merge_base}, so no files were checked")
            return 1
        counts = base_counts(Path(base_dir), base_paths)

    new, unparsed = find_new(root, paths, counts)
    for path in unparsed:
        print(f"::notice file={_escape_property(path)}::doesn't parse, so it wasn't checked")

    for path, violation in new:
        print(format_finding(path, violation))
    print(f"{len(new)} new API findings in {len(paths)} checked files")
    write_findings(root / FINDINGS_PATH, new)
    return 0


if __name__ == "__main__":
    sys.exit(main())

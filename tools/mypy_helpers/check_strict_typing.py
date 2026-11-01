"""Strict-typing ratchet.

Runs mypy with ``--strict`` and compares per-file error counts against a
checked-in baseline. Counts may never increase; decreases must be recorded
with ``--update`` so the baseline only moves down.

Run with changed files in pre-commit, or with ``--all`` for the whole repo.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import defaultdict
from collections.abc import Iterable, Sequence
from pathlib import Path

BASELINE = Path(__file__).with_name("strict_baseline.json")
ERROR_RE = re.compile(
    r"^(?P<path>[^:]+\.py):(?P<line>\d+): error: (?P<message>.*?) \[(?P<code>[\w-]+)\]$"
)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _run_mypy(files: Sequence[str]) -> tuple[dict[str, dict[str, int]], list[str]]:
    counts: defaultdict[str, defaultdict[str, int]] = defaultdict(lambda: defaultdict(int))
    unparsed: list[str] = []
    seen: set[str] = set()
    batches = [files[i : i + 200] for i in range(0, len(files), 200)] or [[]]
    for batch in batches:
        command = [
            sys.executable,
            "-m",
            "mypy",
            "--strict",
            "--no-error-summary",
            "--no-pretty",
            "--show-error-codes",
            *batch,
        ]
        result = subprocess.run(
            command, cwd=_repo_root(), capture_output=True, text=True, check=False
        )
        output = result.stdout + result.stderr
        for line in output.splitlines():
            if line in seen:
                continue
            seen.add(line)
            match = ERROR_RE.match(line)
            if match is None:
                if " error: " in line:
                    unparsed.append(line)
                continue
            counts[Path(match.group("path")).as_posix()][match.group("code")] += 1
    return {path: dict(codes) for path, codes in counts.items()}, unparsed


def _load_baseline() -> dict[str, dict[str, int]]:
    if not BASELINE.exists():
        return {}
    data = json.loads(BASELINE.read_text())
    if not isinstance(data, dict):
        raise ValueError(f"{BASELINE} must contain an object")
    baseline: dict[str, dict[str, int]] = {}
    for path, codes in data.items():
        if not isinstance(path, str) or not isinstance(codes, dict):
            raise ValueError(f"{BASELINE} has an invalid entry for {path!r}")
        baseline[path] = {}
        for code, count in codes.items():
            if not isinstance(code, str) or not isinstance(count, int):
                raise ValueError(f"{BASELINE} has an invalid count for {path!r}")
            baseline[path][code] = count
    return baseline


def _write_baseline(baseline: dict[str, dict[str, int]]) -> None:
    serialized = {
        path: {code: count for code, count in sorted(codes.items()) if count}
        for path, codes in sorted(baseline.items())
        if any(codes.values())
    }
    BASELINE.write_text(json.dumps(serialized, indent=2, sort_keys=True) + "\n")


def _normalize(filenames: Iterable[str]) -> list[str]:
    return [Path(filename).as_posix() for filename in filenames if filename.endswith(".py")]


def _scope(filenames: Sequence[str], files: Sequence[str]) -> set[str]:
    if not filenames:
        return set(files)
    normalized = {Path(filename).as_posix() for filename in filenames}
    return {
        path
        for path in files
        if path in normalized or any(path.startswith(f"{name.rstrip('/')}/") for name in normalized)
    }


def _compare(
    baseline: dict[str, dict[str, int]],
    current: dict[str, dict[str, int]],
    scope: set[str],
) -> int:
    regressions: list[str] = []
    stale: list[str] = []
    for path in sorted(scope):
        baseline_codes = baseline.get(path, {})
        current_codes = current.get(path, {})
        for code in sorted(set(baseline_codes) | set(current_codes)):
            before = baseline_codes.get(code, 0)
            after = current_codes.get(code, 0)
            if after > before:
                regressions.append(f"{path}: {code} increased from {before} to {after}")
            elif after < before:
                stale.append(f"{path}: {code} decreased from {before} to {after}")

    if regressions:
        print("New strict typing errors:", file=sys.stderr)
        for item in regressions:
            print(f"  {item}", file=sys.stderr)
    if stale:
        print("Strict typing baseline can be lowered:", file=sys.stderr)
        for item in stale:
            print(f"  {item}", file=sys.stderr)
        print(
            "  Run `python -m tools.mypy_helpers.check_strict_typing --update` "
            "(add --all for the whole repo).",
            file=sys.stderr,
        )
    return 1 if regressions or stale else 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("filenames", nargs="*")
    parser.add_argument("--all", action="store_true", help="check the whole repository")
    parser.add_argument("--update", action="store_true", help="record current counts")
    args = parser.parse_args(argv)

    filenames = [] if args.all else _normalize(args.filenames)
    if not args.all and not filenames:
        return 0

    current, unparsed = _run_mypy(filenames)
    for line in unparsed:
        print(line, file=sys.stderr)
    if unparsed:
        return 2

    if args.update:
        if args.all:
            baseline = current
        else:
            baseline = _load_baseline()
            for path in filenames:
                baseline.pop(path, None)
                if path in current:
                    baseline[path] = current[path]
        _write_baseline(baseline)
        return 0

    baseline = _load_baseline()
    scope = _scope(filenames, sorted(set(baseline) | set(current)))
    return _compare(baseline, current, scope)


if __name__ == "__main__":
    raise SystemExit(main())

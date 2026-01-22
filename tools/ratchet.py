"""
Ratchet system for tracking code migration progress.

A ratchet tracks patterns that should decrease over time and prevents regression.
If the count increases, the check fails. If the count decreases, it prompts you
to update the ceiling to lock in the progress.

See: https://qntm.org/ratchet
"""

from __future__ import annotations

import argparse
import csv
import fnmatch
import functools
import io
import json
import logging
import os
import re as re_mod
import shutil
import subprocess
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from typing import cast

logger = logging.getLogger(__name__)

from tools.lib import gitroot

ALL_TS = ("static/**/*.ts", "static/**/*.tsx")
ALL_PY = ("src/sentry/**/*.py",)


@dataclass(frozen=True)
class Ratchet:
    id: str
    team: str
    description: str
    pattern: str
    ceiling: int
    file_glob: str | tuple[str, ...]


# =============================================================================
# RATCHET CONFIGURATION
#
# Add new ratchets here. Each ratchet tracks a pattern that should decrease
# over time as code is migrated.
# =============================================================================

RATCHETS: list[Ratchet] = [
    Ratchet(
        id="deprecated-list-builds-endpoint",
        team="preprod",
        description="Use /preprod/builds/ instead of /preprodartifacts/list-builds/",
        pattern=r"preprodartifacts/list-builds/",
        ceiling=4,
        file_glob=ALL_TS + ALL_PY,
    ),
]

# =============================================================================
# Implementation
# =============================================================================

CHECK_FIELDS = ("id", "status", "count", "ceiling", "file_count", "pattern", "description")
LS_FIELDS = ("ratchet", "file", "line", "column", "match")
TEST_FIELDS = ("file", "line", "column", "match")


@functools.cache
def _has_ripgrep() -> bool:
    return shutil.which("rg") is not None


def _should_use_ripgrep(args: argparse.Namespace) -> bool:
    return not args.use_grep and _has_ripgrep()


@functools.cache
def _git_ls_files(root: str, file_glob: str) -> tuple[str, ...]:
    git_result = subprocess.run(
        ["git", "ls-files", file_glob],
        cwd=root,
        capture_output=True,
        text=True,
    )
    return tuple(f for f in git_result.stdout.strip().split("\n") if f)


def git_tracked_files(root: str, file_glob: str | tuple[str, ...]) -> tuple[str, ...]:
    globs = (file_glob,) if isinstance(file_glob, str) else file_glob
    files: list[str] = []
    for glob in globs:
        files.extend(_git_ls_files(root, glob))
    return tuple(files)


def count_matches(
    root: str, pattern: str, file_glob: str | tuple[str, ...], args: argparse.Namespace
) -> tuple[int, int]:
    files = git_tracked_files(root, file_glob)

    if not files:
        return 0, 0

    if _should_use_ripgrep(args):
        cmd = ["rg", "--count", pattern, *files]
    else:
        cmd = ["grep", "-cEH", pattern, *files]

    result = subprocess.run(cmd, cwd=root, capture_output=True, text=True)

    total = 0
    file_count = 0
    for line in result.stdout.strip().split("\n"):
        if line and ":" in line:
            count = int(line.rsplit(":", 1)[1])
            if count > 0:
                total += count
                file_count += 1

    return total, file_count


def _resolve_color(color: str) -> bool:
    if color == "auto":
        return sys.stdout.isatty()
    return color == "always"


def _rg_color(color: str) -> str:
    return "always" if _resolve_color(color) else "never"


def _ansi(text: str, code: str, use_color: bool) -> str:
    if not use_color:
        return text
    return f"\033[{code}m{text}\033[0m"


def _bold(text: str, c: bool) -> str:
    return _ansi(text, "1", c)


def _red(text: str, c: bool) -> str:
    return _ansi(text, "31", c)


def _bold_red(text: str, c: bool) -> str:
    return _ansi(text, "1;31", c)


def _green(text: str, c: bool) -> str:
    return _ansi(text, "32", c)


def _bold_green(text: str, c: bool) -> str:
    return _ansi(text, "1;32", c)


def _dim(text: str, c: bool) -> str:
    return _ansi(text, "2", c)


def compute_check_results(
    root: str, ratchets: list[Ratchet], args: argparse.Namespace
) -> list[dict[str, object]]:
    """Compute check status for each ratchet. Pure data, no output."""
    results: list[dict[str, object]] = []
    for ratchet in ratchets:
        count, file_count = count_matches(root, ratchet.pattern, ratchet.file_glob, args)
        if count > ratchet.ceiling:
            status = "failed"
        elif count < ratchet.ceiling:
            status = "tighten"
        else:
            status = "ok"
        results.append(
            {
                "id": ratchet.id,
                "status": status,
                "count": count,
                "ceiling": ratchet.ceiling,
                "file_count": file_count,
                "pattern": ratchet.pattern,
                "description": ratchet.description,
            }
        )
    return results


def compute_ls_matches(
    root: str, ratchets: list[Ratchet], args: argparse.Namespace
) -> list[dict[str, object]]:
    """Compute all matches for the given ratchets, tagged with ratchet id."""
    all_matches: list[dict[str, object]] = []
    for ratchet in ratchets:
        for m in find_matches(root, ratchet.pattern, ratchet.file_glob, args):
            m["ratchet"] = ratchet.id
            all_matches.append(m)
    return all_matches


def _has_failed(results: list[dict[str, object]]) -> bool:
    return any(r["status"] != "ok" for r in results)


def _print_json(data: list[dict[str, object]]) -> None:
    print(json.dumps(data, indent=2))


def _print_csv(data: list[dict[str, object]], fields: Sequence[str]) -> None:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(data)
    sys.stdout.write(buf.getvalue())


def _matches_in_changed_files(
    root: str,
    ratchet: Ratchet,
    changed_files: list[str] | None,
    use_color: bool,
    args: argparse.Namespace,
) -> list[str]:
    """Find matches in changed files that match the ratchet's file glob."""
    if not changed_files:
        return []

    globs = (ratchet.file_glob,) if isinstance(ratchet.file_glob, str) else ratchet.file_glob
    filtered = [f for f in changed_files if any(fnmatch.fnmatch(f, g) for g in globs)]
    if not filtered:
        return []

    # Only include files that still exist (skip deleted files)
    existing = [f for f in filtered if os.path.isfile(os.path.join(root, f))]
    if not existing:
        return []

    color_flag = "always" if use_color else "never"
    if _should_use_ripgrep(args):
        cmd = ["rg", "--line-number", "--column", "--color", color_flag, ratchet.pattern, *existing]
    else:
        cmd = ["grep", "-nEH", f"--color={color_flag}", ratchet.pattern, *existing]

    result = subprocess.run(cmd, cwd=root, capture_output=True, text=True)
    return [line for line in result.stdout.strip().split("\n") if line]


def _print_check_text(
    root: str,
    ratchets: list[Ratchet],
    results: list[dict[str, object]],
    verbose: bool,
    use_color: bool,
    args: argparse.Namespace,
    changed_files: list[str] | None = None,
) -> None:
    """Unified text output for check and precommit commands."""
    c = use_color
    ratchet_by_id = {r.id: r for r in ratchets}
    first_failure = True

    for result in results:
        status = result["status"]
        rid = cast(str, result["id"])
        ratchet = ratchet_by_id[rid]
        count = cast(int, result["count"])
        ceiling = cast(int, result["ceiling"])

        if status == "failed":
            diff = count - ceiling
            heading = (
                f"{_bold_red('ERROR', c)} {_bold(rid, c)}"
                f"  ceiling={ceiling} actual={_red(str(count), c)}"
                f" {_red(f'(+{diff})', c)}"
            )
            lines = [heading, f"  {_dim(ratchet.description, c)}"]

            matches = _matches_in_changed_files(root, ratchet, changed_files, c, args)
            if matches:
                for m in matches:
                    lines.append(f"  {m}")
            else:
                lines.append(
                    f"  Run {_bold('python -m tools.ratchet ls ' + rid, c)} to see all occurrences"
                )
            if not first_failure:
                print()
            first_failure = False
            print("\n".join(lines))

        elif status == "tighten":
            diff = ceiling - count
            heading = (
                f"{_bold_green('TIGHTEN', c)} {_bold(rid, c)}"
                f"  ceiling={ceiling} actual={_green(str(count), c)}"
                f" {_green(f'(-{diff})', c)}"
            )
            lines = [heading, f"  {_dim(ratchet.description, c)}"]
            lines.append(f"  Update ceiling in tools/ratchet.py: ceiling={count}")
            lines.append("  LLM agents: use /tighten-ratchet")
            if not first_failure:
                print()
            first_failure = False
            print("\n".join(lines))

        elif verbose:
            msg = f"Ratchet '{rid}': OK ({count} matches)"
            msg += f"\n  Pattern: {ratchet.pattern}\n  Files: {result['file_count']}"
            print(msg)

    if not _has_failed(results) and not verbose:
        print(f"All {len(results)} ratchet(s) OK")


def _print_ls_text(
    root: str, ratchets: list[Ratchet], color: str, args: argparse.Namespace
) -> None:
    """Text output for ls command — uses rg/grep native colored output."""
    color_flag = _rg_color(color)

    first = True
    for ratchet in ratchets:
        files = git_tracked_files(root, ratchet.file_glob)
        if not files:
            continue

        if not first:
            print()
        first = False
        print(f"--- {ratchet.id}: {ratchet.description} ---")

        if _should_use_ripgrep(args):
            cmd = [
                "rg",
                "--line-number",
                "--column",
                "--color",
                color_flag,
                ratchet.pattern,
                *files,
            ]
        else:
            cmd = ["grep", "-nEH", f"--color={color_flag}", ratchet.pattern, *files]
        subprocess.run(cmd, cwd=root)


def _print_test_text(
    root: str,
    pattern: str,
    file_glob: str | tuple[str, ...],
    verbose: bool,
    color: str,
    args: argparse.Namespace,
) -> int:
    """Text output for test command — uses rg/grep native output. Returns exit code."""
    files = git_tracked_files(root, file_glob)
    if not files:
        print("0")
        return 0

    if not verbose:
        count, _ = count_matches(root, pattern, file_glob, args)
        print(count)
        return 0

    color_flag = _rg_color(color)
    if _should_use_ripgrep(args):
        cmd = ["rg", "--line-number", "--column", "--color", color_flag, pattern, *files]
    else:
        cmd = ["grep", "-nEH", f"--color={color_flag}", pattern, *files]

    result = subprocess.run(cmd, cwd=root)
    return result.returncode if result.returncode != 1 else 0


def find_matches(
    root: str, pattern: str, file_glob: str | tuple[str, ...], args: argparse.Namespace
) -> list[dict[str, object]]:
    files = git_tracked_files(root, file_glob)
    if not files:
        return []

    if _should_use_ripgrep(args):
        return _find_matches_rg(root, pattern, files)
    else:
        return _find_matches_grep(root, pattern, files)


def _find_matches_rg(root: str, pattern: str, files: tuple[str, ...]) -> list[dict[str, object]]:
    rg_result = subprocess.run(
        ["rg", "--json", pattern, *files],
        cwd=root,
        capture_output=True,
        text=True,
    )

    matches = []
    for line in rg_result.stdout.strip().split("\n"):
        if not line:
            continue
        msg = json.loads(line)
        if msg["type"] != "match":
            continue
        data = msg["data"]
        for submatch in data["submatches"]:
            matches.append(
                {
                    "file": data["path"]["text"],
                    "line": data["line_number"],
                    "column": submatch["start"] + 1,
                    "match": submatch["match"]["text"],
                }
            )
    return matches


def _find_matches_grep(root: str, pattern: str, files: tuple[str, ...]) -> list[dict[str, object]]:
    result = subprocess.run(
        ["grep", "-nEH", pattern, *files],
        cwd=root,
        capture_output=True,
        text=True,
    )

    compiled = re_mod.compile(pattern)
    matches = []
    for line in result.stdout.strip().split("\n"):
        if not line:
            continue
        # Format: file:line:content
        parts = line.split(":", 2)
        if len(parts) < 3:
            continue
        filepath, lineno, content = parts
        for m in compiled.finditer(content):
            matches.append(
                {
                    "file": filepath,
                    "line": int(lineno),
                    "column": m.start() + 1,
                    "match": m.group(),
                }
            )
    return matches


def _resolve_ratchets(ids: list[str] | None) -> list[Ratchet] | None:
    if not ids:
        return RATCHETS
    by_id = {r.id: r for r in RATCHETS}
    ratchets: list[Ratchet] = []
    for rid in ids:
        if rid not in by_id:
            print(f"ERROR: Unknown ratchet ID: {rid}")
            print(f"Available ratchets: {', '.join(r.id for r in RATCHETS)}")
            return None
        ratchets.append(by_id[rid])
    return ratchets


def _get_diff_specifier() -> list[str]:
    """Return git diff arguments based on hook context.

    Pre-push hooks set PRE_COMMIT_FROM_REF and PRE_COMMIT_TO_REF.
    Pre-commit hooks (and direct invocation) use --cached.
    """
    from_ref = os.environ.get("PRE_COMMIT_FROM_REF")
    to_ref = os.environ.get("PRE_COMMIT_TO_REF")
    if from_ref and to_ref:
        return [f"{from_ref}...{to_ref}"]
    return ["--cached"]


def _get_diff_lines(root: str, diff_spec: list[str]) -> str | None:
    """Get added/removed lines from diff, stripped of diff markers.

    Returns None if git is not available or the diff command fails.
    """
    try:
        result = subprocess.run(
            ["git", "diff", "-U0", *diff_spec],
            cwd=root,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return None
    if result.returncode != 0:
        return None
    lines = []
    for line in result.stdout.splitlines():
        if line.startswith(("+", "-")) and not line.startswith(("+++", "---")):
            lines.append(line[1:])
    return "\n".join(lines)


def _pattern_in_diff(diff_text: str, pattern: str, args: argparse.Namespace) -> bool:
    """Check if a pattern matches anywhere in the diff text."""
    if _should_use_ripgrep(args):
        cmd = ["rg", "-q", pattern]
    else:
        cmd = ["grep", "-qE", pattern]

    result = subprocess.run(cmd, input=diff_text, capture_output=True, text=True)
    return result.returncode == 0


def cmd_check(args: argparse.Namespace) -> int:
    root = gitroot()
    use_color = _resolve_color(args.color)

    ratchets = RATCHETS
    if args.id:
        ratchets = [r for r in RATCHETS if r.id == args.id]
        if not ratchets:
            print(f"ERROR: Unknown ratchet ID: {args.id}")
            print(f"Available ratchets: {', '.join(r.id for r in RATCHETS)}")
            return 1

    results = compute_check_results(root, ratchets, args)

    if args.format == "json":
        _print_json(results)
    elif args.format == "csv":
        _print_csv(results, CHECK_FIELDS)
    else:
        _print_check_text(root, ratchets, results, args.verbose, use_color, args)

    if args.report_only:
        return 0
    return 1 if _has_failed(results) else 0


def cmd_precommit(args: argparse.Namespace) -> int:
    root = gitroot()
    use_color = _resolve_color(args.color)

    ratchets = RATCHETS

    for key, value in sorted(os.environ.items()):
        if key.startswith("PRE_COMMIT_"):
            logger.info("%s=%s", key, value)

    diff_spec = _get_diff_specifier()

    # Fast path: only check ratchets whose pattern appears in the diff.
    # Always do a full scan if the ratchet script itself changed (ceilings, patterns, etc.).
    # If git diff fails (e.g. git not available), fall through to full check.
    if "tools/ratchet.py" in args.filenames:
        logger.info("tools/ratchet.py is in changeset, running full scan")
    else:
        diff_text = _get_diff_lines(root, diff_spec)
        if diff_text is not None:
            matched = [r for r in ratchets if _pattern_in_diff(diff_text, r.pattern, args)]
            if not matched:
                logger.info("No ratchet patterns found in diff, skipping")
                return 0
            skipped = set(r.id for r in ratchets) - set(r.id for r in matched)
            logger.info(
                "Checking %d ratchet(s) matching diff: %s",
                len(matched),
                ", ".join(r.id for r in matched),
            )
            if skipped:
                logger.info(
                    "Skipping %d unaffected ratchet(s): %s",
                    len(skipped),
                    ", ".join(sorted(skipped)),
                )
            ratchets = matched
        else:
            logger.info("Could not read diff, running full scan")

    results = compute_check_results(root, ratchets, args)

    if args.format == "json":
        _print_json(results)
    elif args.format == "csv":
        _print_csv(results, CHECK_FIELDS)
    else:
        _print_check_text(
            root,
            ratchets,
            results,
            args.verbose,
            use_color,
            args,
            changed_files=args.filenames,
        )

    return 1 if _has_failed(results) else 0


def cmd_ls(args: argparse.Namespace) -> int:
    root = gitroot()

    ratchets = _resolve_ratchets(args.id)
    if ratchets is None:
        return 1

    if args.format == "text":
        _print_ls_text(root, ratchets, args.color, args)
    elif args.format == "json":
        _print_json(compute_ls_matches(root, ratchets, args))
    elif args.format == "csv":
        _print_csv(compute_ls_matches(root, ratchets, args), LS_FIELDS)

    return 0


def cmd_test(args: argparse.Namespace) -> int:
    root = gitroot()
    globs: tuple[str, ...] = tuple(args.glob) if args.glob else ALL_TS + ALL_PY

    if args.format == "text":
        return _print_test_text(root, args.pattern, globs, args.verbose, args.color, args)

    matches = find_matches(root, args.pattern, globs, args)
    if args.format == "json":
        _print_json(matches)
    elif args.format == "csv":
        _print_csv(matches, TEST_FIELDS)

    return 0


def main(argv: Sequence[str] | None = None) -> int:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--verbose", "-v", action="store_true", help="Show detailed output")
    common.add_argument("--use-grep", action="store_true", help="Use grep instead of ripgrep")
    common.add_argument(
        "--color",
        choices=("always", "auto", "never"),
        default="auto",
        help="Color output: always, auto (default, detect tty), or never",
    )

    format_all = argparse.ArgumentParser(add_help=False)
    format_all.add_argument(
        "--format",
        choices=("text", "json", "csv"),
        default="text",
        help="Output format (default: text)",
    )

    parser = argparse.ArgumentParser(
        description="Check code migration ratchets to prevent regression",
    )
    subparsers = parser.add_subparsers(dest="command")

    check_parser = subparsers.add_parser(
        "check",
        help="Check ratchets for regression",
        parents=[common, format_all],
    )
    check_parser.add_argument(
        "-n",
        "--report-only",
        action="store_true",
        help="Print results but always exit 0",
    )
    check_parser.add_argument("id", nargs="?", help="Only check the specified ratchet by ID")

    precommit_parser = subparsers.add_parser(
        "precommit",
        help="Like check, but skips ratchets not touched by the staged diff",
        parents=[common, format_all],
    )
    precommit_parser.add_argument(
        "filenames", nargs="*", default=[], help="Changed files (passed by pre-commit)"
    )

    ls_parser = subparsers.add_parser(
        "ls",
        help="List all occurrences of ratcheted patterns",
        parents=[common, format_all],
    )
    ls_parser.add_argument("id", nargs="*", help="Ratchet IDs to list (default: all)")

    test_parser = subparsers.add_parser(
        "test",
        help="Test a regex pattern against git-tracked files",
        parents=[common, format_all],
    )
    test_parser.add_argument("pattern", help="Ripgrep regex pattern to search for")
    test_parser.add_argument(
        "--glob",
        action="append",
        default=None,
        help="File glob to search (repeatable, default: ALL_TS + ALL_PY)",
    )

    effective_argv = list(argv) if argv is not None else sys.argv[1:]
    if not any(arg in {"check", "precommit", "test", "ls"} for arg in effective_argv):
        effective_argv.append("check")

    args = parser.parse_args(effective_argv)

    logging.basicConfig(
        format="%(message)s",
        level=logging.INFO if args.verbose else logging.WARNING,
    )

    if not _should_use_ripgrep(args):
        logger.warning(
            "ripgrep (rg) not found, falling back to grep. "
            "Install ripgrep for better performance: https://github.com/BurntSushi/ripgrep#installation"
        )

    if args.command == "check":
        return cmd_check(args)
    elif args.command == "precommit":
        return cmd_precommit(args)
    elif args.command == "ls":
        return cmd_ls(args)
    elif args.command == "test":
        return cmd_test(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

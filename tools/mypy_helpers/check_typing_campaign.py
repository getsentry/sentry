"""Diff-aware typing campaign gates.

Checks added lines in the current change for:

- new ``Any`` usage in modules that are already off the mypy weaklist
- casts at trust boundaries without a ``# justification:`` comment

Run without ``--base`` in a pre-commit hook to check staged changes, or with
``--base origin/master`` to check the whole branch. ``--status`` prints the
strict/weak split for changed modules instead of running the gates.
"""

from __future__ import annotations

import argparse
import ast
import io
import re
import subprocess
import sys
import tokenize
import tomllib
from collections.abc import Iterable, Sequence
from pathlib import Path

from tools.mypy_helpers.prevent_weaklist_additions import _modules_for_override_key

TRUST_BOUNDARY_CASTS = (
    re.compile(r"\bjson\.loads?\b"),
    re.compile(r"\.json\(\)"),
    re.compile(r"\brequests\."),
    re.compile(r"\bhttpx\."),
    re.compile(r"\bresponse\b"),
    re.compile(r"\bresp\b"),
    re.compile(r"\bheaders\.get\("),
    re.compile(r"\bmetadata(?:\[|\.get\()"),
    re.compile(r"\bconfig(?:\[|\.get\()"),
    re.compile(r"\bself\.(?:get|post|put|request)\("),
)
JUSTIFICATION_RE = re.compile(r"#\s*justification:", re.IGNORECASE)
HUNK_RE = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")


def _run_git(*args: str) -> str:
    return subprocess.run(("git", *args), check=True, capture_output=True, text=True).stdout


def _repo_root() -> Path:
    return Path(_run_git("rev-parse", "--show-toplevel").strip())


def _module_for_path(path: str) -> str | None:
    normalized = Path(path).as_posix()
    if not normalized.startswith("src/") or not normalized.endswith(".py"):
        return None
    module = normalized.removesuffix(".py").removeprefix("src/").replace("/", ".")
    return module.removesuffix(".__init__")


def _weaklist() -> frozenset[str]:
    with open("pyproject.toml", "rb") as f:
        data = tomllib.load(f)
    return _modules_for_override_key(data, "disallow_untyped_defs", "pyproject.toml")


def _is_weaklisted(module: str, weaklist: frozenset[str]) -> bool:
    for pattern in weaklist:
        if pattern.endswith(".*"):
            base = pattern[:-2]
            if module == base or module.startswith(f"{base}."):
                return True
        elif module == pattern:
            return True
    return False


def _added_lines_by_file(diff: str) -> dict[str, set[int]]:
    result: dict[str, set[int]] = {}
    current: str | None = None
    new_line = 0
    for line in diff.splitlines():
        if line.startswith("+++ b/"):
            current = line[6:]
            result.setdefault(current, set())
        elif line.startswith("@@ "):
            match = HUNK_RE.match(line)
            if match is None:
                current = None
                continue
            new_line = int(match.group(1))
        elif current is not None and line.startswith("+"):
            result[current].add(new_line)
            new_line += 1
        elif current is not None and line.startswith(" "):
            new_line += 1
    return result


def _diff(base: str | None, filenames: Sequence[str], staged: bool) -> dict[str, set[int]]:
    paths = [path for path in filenames if path.endswith(".py")] or ["src"]
    if base is not None:
        diff = _run_git("diff", "--unified=0", f"{base}...HEAD", "--", *paths)
    elif staged:
        diff = _run_git("diff", "--cached", "--unified=0", "--", *paths)
    else:
        diff = _run_git("diff", "HEAD", "--unified=0", "--", *paths)
    return _added_lines_by_file(diff)


def _changed_files(base: str | None) -> list[str]:
    if base is not None:
        diff = _run_git("diff", "--name-only", f"{base}...HEAD", "--", "src")
    else:
        diff = _run_git("diff", "--cached", "--name-only", "--", "src")
    return [line for line in diff.splitlines() if line.endswith(".py")]


def _any_lines(text: str) -> list[int]:
    return [
        token.start[0]
        for token in tokenize.generate_tokens(io.StringIO(text).readline)
        if token.type == tokenize.NAME and token.string == "Any"
    ]


def _old_text(base: str | None, path: str, staged: bool) -> str:
    ref = base if base is not None else "HEAD"
    try:
        return _run_git("show", f"{ref}:{path}")
    except subprocess.CalledProcessError:
        return ""


def _cast_nodes(text: str) -> Iterable[ast.Call]:
    tree = ast.parse(text)
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "cast"
            and len(node.args) >= 2
        ):
            yield node


def _check_file(
    path: str,
    added: set[int],
    weaklist: frozenset[str],
    root: Path,
    old_text: str,
) -> list[str]:
    errors: list[str] = []
    source_path = root / path
    text = source_path.read_text()
    lines = text.splitlines()
    module = _module_for_path(path)

    new_any_lines = _any_lines(text)
    if (
        module is not None
        and not _is_weaklisted(module, weaklist)
        and len(new_any_lines) > len(_any_lines(old_text))
    ):
        for line_number in sorted(set(new_any_lines) & added):
            errors.append(
                f"{path}:{line_number}: new Any in graduated module {module}; "
                "fix the type or add a precise contract"
            )

    for node in _cast_nodes(text):
        if node.lineno not in added:
            continue
        value = node.args[1]
        value_source = ast.get_source_segment(text, value) or ""
        if not any(pattern.search(value_source) for pattern in TRUST_BOUNDARY_CASTS):
            continue
        previous_line = lines[node.lineno - 2] if node.lineno > 1 else ""
        current_line = lines[node.lineno - 1]
        if JUSTIFICATION_RE.search(current_line) or JUSTIFICATION_RE.search(previous_line):
            continue
        errors.append(
            f"{path}:{node.lineno}: cast at a trust boundary needs a '# justification:' comment"
        )

    return errors


def _status(base: str | None) -> int:
    weaklist = _weaklist()
    files = _changed_files(base)
    strong: list[str] = []
    weak: list[str] = []
    for path in files:
        module = _module_for_path(path)
        if module is None:
            continue
        (weak if _is_weaklisted(module, weaklist) else strong).append(module)
    print(f"changed src files: {len(files)}")
    print(f"strict-checked: {len(strong)}")
    print(f"still weaklisted: {len(weak)}")
    print(f"weaklist entries: {len(weaklist)}")
    print(f"exact entries: {sum(1 for entry in weaklist if not entry.endswith('.*'))}")
    print(f"wildcard entries: {sum(1 for entry in weaklist if entry.endswith('.*'))}")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("filenames", nargs="*")
    parser.add_argument("--base", help="git ref to diff against")
    parser.add_argument(
        "--staged", action="store_true", help="check staged changes (pre-commit default)"
    )
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--goal", action="store_true", help="fail until the weaklist is empty")
    args = parser.parse_args(argv)

    if args.goal:
        remaining = len(_weaklist())
        print(f"weaklist entries remaining: {remaining}")
        return 0 if remaining == 0 else 1

    if args.status:
        return _status(args.base)

    root = _repo_root()
    try:
        added = _diff(args.base, args.filenames, staged=args.staged or args.base is None)
    except subprocess.CalledProcessError as exc:
        print(f"unable to read diff: {exc.stderr}", file=sys.stderr)
        return 2

    weaklist = _weaklist()
    errors: list[str] = []
    for path, lines in added.items():
        if not lines or not path.endswith(".py"):
            continue
        source_path = root / path
        if not source_path.exists():
            continue
        old_text = _old_text(args.base, path, staged=args.staged or args.base is None)
        errors.extend(_check_file(path, lines, weaklist, root, old_text))

    for error in errors:
        print(error, file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())

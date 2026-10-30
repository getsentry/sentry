"""Write pytest's assertion-rewritten pycs for a shard's test files.

Every xdist worker imports every test file in its shard, and they all start
together, so without this each worker rewrites and compiles the same files.
pytest-selected.py starts this in the background just before pytest, while the
workers are still starting up. Workers that import a file after it is done
load the cached pyc; pytest writes pycs atomically and validates them against
the source, so a worker that gets there first just rewrites it itself.

Usage: prewarm_assert_rewrite.py FILE_LIST
"""

from __future__ import annotations

import sys
from pathlib import Path

from _pytest.assertion.rewrite import PYC_TAIL, _read_pyc, _rewrite_test, _write_pyc


class _State:
    def trace(self, message: str) -> None:
        pass


# pyproject.toml's python_files makes pytest rewrite these too, and test modules import them.
TESTUTILS = Path("src/sentry/testutils")


def rewrite_targets(files: list[str]) -> list[Path]:
    """Test modules in `files` plus the conftests and testutils pytest rewrites
    for them, roughly in import order."""
    targets: dict[Path, None] = dict.fromkeys(sorted(TESTUTILS.rglob("*.py")))
    for name in files:
        path = Path(name)
        # Conftests along the path load before the module itself.
        for parent in reversed(path.parents):
            if (conftest := parent / "conftest.py").is_file():
                targets[conftest] = None
        if path.name.startswith("test_") and path.suffix == ".py":
            targets[path] = None
    return list(targets)


def prewarm(path: Path) -> None:
    if sys.dont_write_bytecode:
        return
    cache_dir = path.parent / "__pycache__"
    cache_dir.mkdir(exist_ok=True)
    pyc = cache_dir / (path.name[:-3] + PYC_TAIL)
    state = _State()
    if _read_pyc(path, pyc, state.trace) is not None:
        return
    # A config is only needed for the enable_assertion_pass_hook ini option,
    # which Sentry doesn't set.
    source_stat, co = _rewrite_test(path, None)  # type: ignore[arg-type]
    _write_pyc(state, co, source_stat, pyc)  # type: ignore[arg-type]


def main(file_list: str) -> int:
    files = Path(file_list).read_text().split()
    for path in rewrite_targets(files):
        try:
            prewarm(path)
        except (OSError, SyntaxError):
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1]))

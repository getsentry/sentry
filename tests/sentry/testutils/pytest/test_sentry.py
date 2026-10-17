"""
Full backend runs shard by file: .github/workflows/scripts/pytest-selected.py
plans the shards, the sentry plugin's pytest_ignore_collect and
pytest_collection_modifyitems keep each shard's files, and pytest_shard_plugin
keeps each shard's part of a split file. These tests run that stack for real
in a throwaway project and check every test lands on exactly one shard.
"""

from __future__ import annotations

import os
import subprocess
import sys
import textwrap
from collections import Counter
from pathlib import Path

import pytest

import sentry
from sentry.utils import json

SCRIPTS = Path(sentry.__file__).parents[2] / ".github" / "workflows" / "scripts"
SHARDS = 3

# Runs pytest-selected.py like `python3 pytest-selected.py ARGS` in CI, with a
# durations file for the throwaway project and every slow-ish file split.
DRIVER = textwrap.dedent(
    """
    import importlib, os, sys
    from pathlib import Path
    sys.path[0] = os.getcwd()
    sys.path.append(os.environ["SCRIPTS"])
    selected = importlib.import_module("pytest-selected")
    selected.DURATIONS_FILE = Path("durations.json")
    selected.PIECES_PER_SHARD = 1
    raise SystemExit(selected.main(sys.argv[1:]))
    """
)

FILES = {
    "conftest.py": (
        "from sentry.testutils.pytest.sentry import (  # noqa: F401\n"
        "    pytest_collection_modifyitems,\n"
        "    pytest_ignore_collect,\n"
        ")\n"
    ),
    "pytest.ini": "[pytest]\nmarkers =\n    snuba_ci\n",
    "tests/shardcheck/test_big.py": textwrap.dedent(
        """
        import pytest

        @pytest.mark.parametrize("n", range(40))
        def test_param(n):
            pass

        class TestBig:
            @pytest.mark.parametrize("n", range(20))
            def test_method(self, n):
                pass
        """
    ),
    "tests/shardcheck/test_inherit.py": textwrap.dedent(
        """
        class TestBase:
            def test_shared(self):
                pass

        class TestChild(TestBase):
            def test_own(self):
                pass
        """
    ),
    **{f"tests/shardcheck/test_{name}.py": "def test_a():\n    pass\n" for name in "abcdef"},
    "tests/shardcheck/helpers.py": "VALUE = 1\n",
    "tests/shardcheck/ignored/test_ignored.py": "def test_ignored():\n    pass\n",
    "other/test_outside.py": "def test_outside():\n    pass\n",
    # Like `-m snuba_ci`: a few marked tests in a few of many files.
    **{
        f"tests/shardcheck/marked/test_m{i}.py": textwrap.dedent(
            """
            import pytest

            @pytest.mark.snuba_ci
            @pytest.mark.parametrize("n", range(4))
            def test_marked(n):
                pass

            def test_unmarked():
                pass
            """
        )
        for i in range(3)
    },
    **{f"tests/shardcheck/marked/test_plain{i}.py": "def test_p():\n    pass\n" for i in range(12)},
}

DURATIONS = {
    "seconds_per_test": 0.1,
    "files": {"tests/shardcheck/test_big.py": 30.0, "tests/shardcheck/test_inherit.py": 2.0},
}


@pytest.fixture
def project(tmp_path: Path) -> Path:
    for path, content in FILES.items():
        (tmp_path / path).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / path).write_text(content)
    (tmp_path / "durations.json").write_text(json.dumps(DURATIONS))
    return tmp_path


def _run(
    project: Path, command: list[str], env: dict[str, str]
) -> subprocess.CompletedProcess[str]:
    # The outer run's own sharding, plugin and Django settings must not leak in.
    base = {
        k: v
        for k, v in os.environ.items()
        if not k.startswith(("PYTEST_", "DJANGO_", "SENTRY_", "TEST_GROUP", "TOTAL_TEST_GROUPS"))
        and k not in ("SELECTED_TESTS_FILE", "PYTHONPATH")
    }
    base |= {"PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1", "SCRIPTS": str(SCRIPTS)}
    proc = subprocess.run(
        command,
        cwd=project,
        env=base | env,
        capture_output=True,
        text=True,
        timeout=300,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    return proc


def _nodeids(proc: subprocess.CompletedProcess[str], collect_only: bool) -> Counter[str]:
    lines = proc.stdout.splitlines()
    if collect_only:
        return Counter(line for line in lines if "::" in line)
    return Counter(line.split(" ", 1)[1] for line in lines if line.startswith("PASSED "))


def _check_sharding(
    project: Path,
    args: list[str],
    *,
    collect_only: bool = True,
    env: dict[str, str] | None = None,
) -> list[str]:
    mode = ["--collect-only", "-q"] if collect_only else ["-rA"]
    # CI sets PY_COLORS=1, which would prefix the PASSED lines with escapes.
    common = ["-p", "no:cacheprovider", "--color=no", *args, *mode]
    env = env or {}
    unsharded = _nodeids(
        _run(project, [sys.executable, "-m", "pytest", *common], env), collect_only
    )
    assert unsharded

    sharded: Counter[str] = Counter()
    logs = []
    for group in range(SHARDS):
        proc = _run(
            project,
            [sys.executable, "-c", DRIVER, *common],
            env
            | {
                "TOTAL_TEST_GROUPS": str(SHARDS),
                "TEST_GROUP": str(group),
                "TEST_GROUP_STRATEGY": "roundrobin",
            },
        )
        shard = _nodeids(proc, collect_only)
        assert shard, f"shard {group} ran nothing"
        sharded += shard
        logs.append(proc.stderr)

    assert sharded == unsharded
    return logs


IGNORE = ["--ignore", "tests/shardcheck/ignored"]


@pytest.mark.parametrize(
    ("args", "env"),
    [
        (["tests", "-m", "snuba_ci"], {}),
        (["tests", "-k", "test_marked"], {}),
        # How Snuba's CI passes it.
        (["tests"], {"PYTEST_ADDOPTS": "-k 'not __In' -m snuba_ci"}),
    ],
)
def test_filtered_run_spreads_selected_tests_over_every_shard(
    project: Path, args: list[str], env: dict[str, str]
) -> None:
    # Planning by file would put the 3 marked files on at most 3 of the
    # shards and leave the rest with nothing selected.
    logs = _check_sharding(project, [*args, *IGNORE], collect_only=False, env=env)
    assert all("keeps its hash share" in log for log in logs)

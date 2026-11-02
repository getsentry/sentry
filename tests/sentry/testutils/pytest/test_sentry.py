from __future__ import annotations

import os
import subprocess
import sys
import textwrap
from collections import Counter
from pathlib import Path

import pytest

import sentry
from sentry.utils import json, redis

SCRIPTS = Path(sentry.__file__).parents[2] / ".github" / "workflows" / "scripts"
SHARDS = 4

# Runs pytest-selected.py the way CI does, with this project's durations
# and no file split.
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

MARKED = textwrap.dedent(
    """
    import pytest

    @pytest.mark.snuba_ci
    @pytest.mark.parametrize("n", range(10))
    def test_marked(n):
        pass

    def test_unmarked():
        pass
    """
)


def _collect(project: Path, command: list[str], env: dict[str, str]) -> Counter[str]:
    # Keep the outer run's sharding, plugins and settings out.
    base = {
        k: v
        for k, v in os.environ.items()
        if not k.startswith(("PYTEST_", "DJANGO_", "SENTRY_", "TEST_GROUP", "TOTAL_TEST_GROUPS"))
        and k not in ("SELECTED_TESTS_FILE", "PYTHONPATH", "BACKEND_TEST_SERVICE_COLOR")
    }
    base |= {
        "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
        "SCRIPTS": str(SCRIPTS),
        # How Snuba's CI filters sentry's tests.
        "PYTEST_ADDOPTS": "-k 'not __In' -m snuba_ci",
    }
    proc = subprocess.run(
        [*command, "-p", "no:cacheprovider", "tests", "--collect-only", "-q"],
        cwd=project,
        env=base | env,
        capture_output=True,
        text=True,
        timeout=300,
    )
    # Exit code 5 is a shard that collected nothing.
    assert proc.returncode == 0, proc.stdout + proc.stderr
    return Counter(line for line in proc.stdout.splitlines() if "::" in line)


def test_filtered_run_spreads_selected_tests_over_every_shard(tmp_path: Path) -> None:
    files = {
        "conftest.py": "from sentry.testutils.pytest.sentry import pytest_collection_modifyitems, pytest_ignore_collect  # noqa: F401\n",
        "pytest.ini": "[pytest]\nmarkers =\n    snuba_ci\n",
        "durations.json": json.dumps({"seconds_per_test": 0.1, "files": {}}),
        **{f"tests/test_marked{i}.py": MARKED for i in range(2)},
        **{f"tests/test_plain{i}.py": "def test_p():\n    pass\n" for i in range(12)},
    }
    for path, content in files.items():
        (tmp_path / path).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / path).write_text(content)

    unsharded = _collect(tmp_path, [sys.executable, "-m", "pytest"], {})
    sharded: Counter[str] = Counter()
    for group in range(SHARDS):
        sharded += _collect(
            tmp_path,
            [sys.executable, "-c", DRIVER],
            {
                "TOTAL_TEST_GROUPS": str(SHARDS),
                "TEST_GROUP": str(group),
                "TEST_GROUP_STRATEGY": "roundrobin",
            },
        )
    assert len(unsharded) == 20
    assert sharded == unsharded


def test_flushall_on_single_host_redis_is_rejected() -> None:
    client = redis.redis_clusters.get("default")
    with pytest.raises(AssertionError, match="flushdb"):
        client.flushall()
    with pytest.raises(AssertionError, match="flushdb"):
        client.pipeline().flushall()

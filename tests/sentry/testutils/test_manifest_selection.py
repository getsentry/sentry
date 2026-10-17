from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast
from unittest import mock

from sentry.testutils.pytest import sentry as sentry_plugin
from sentry.utils import json

_REPO_ROOT = Path(__file__).resolve().parents[3]


def test_manifest_worker_skips_selected_file_collection_filter(
    tmp_path: Path,
) -> None:
    tests_dir = tmp_path / "tests"
    tests_dir.mkdir()
    assigned_file = tests_dir / "test_assigned.py"
    assigned_file.write_text("def test_assigned():\n    pass\n", encoding="utf-8")
    selected_file = tmp_path / "selected.txt"
    selected_file.write_text("tests/test_other.py\n", encoding="utf-8")

    config = cast(Any, SimpleNamespace(rootpath=tmp_path))

    with (
        mock.patch.dict(
            os.environ,
            {
                "_PYTEST_PARALLEL_WORKER": "1",
                "PYTEST_PARALLEL_MANIFEST": str(tmp_path / "manifest.json"),
                "SELECTED_TESTS_FILE": str(selected_file),
            },
        ),
        mock.patch.object(sentry_plugin, "_COLLECT_ALLOWED_FILES", None),
    ):
        assert sentry_plugin.pytest_ignore_collect(assigned_file, config) is None
        os.environ.pop("PYTEST_PARALLEL_MANIFEST")
        assert sentry_plugin.pytest_ignore_collect(assigned_file, config) is True


def test_manifest_run_preserves_sentry_parent_subset_order(tmp_path: Path) -> None:
    suite = tmp_path / "suite"
    suite.mkdir()
    parent_selection = tmp_path / "parent-selected.txt"
    worker_selection = tmp_path / "worker-selected.txt"
    parent_order_path = tmp_path / "parent-order.json"
    run_order_path = tmp_path / "run-order.txt"
    worker_shard_parts_path = tmp_path / "worker-shard-parts.txt"
    parent_selection.write_text("test_a.py\ntest_b.py\n", encoding="utf-8")
    worker_selection.write_text("test_a.py\n", encoding="utf-8")

    (suite / "conftest.py").write_text(
        "import json\n"
        "import os\n"
        "from pathlib import Path\n"
        "import pytest\n"
        "from sentry.testutils.pytest import sentry as sentry_plugin\n"
        "\n"
        "def pytest_configure(config):\n"
        "    if os.environ.get('_PYTEST_PARALLEL_WORKER') == '1':\n"
        "        Path(os.environ['WORKER_SHARD_PARTS']).write_text(\n"
        "            os.environ.get('PYTEST_SHARD_PARTS', ''), encoding='utf-8'\n"
        "        )\n"
        "\n"
        "def pytest_ignore_collect(collection_path, config):\n"
        "    return sentry_plugin.pytest_ignore_collect(collection_path, config)\n"
        "\n"
        "@pytest.hookimpl(tryfirst=True)\n"
        "def pytest_collection_modifyitems(config, items):\n"
        "    sentry_plugin.pytest_collection_modifyitems(config, items)\n"
        "    if os.environ.get('_PYTEST_PARALLEL_WORKER') != '1':\n"
        "        Path(os.environ['PARENT_ORDER']).write_text(\n"
        "            json.dumps([item.nodeid for item in items]), encoding='utf-8'\n"
        "        )\n"
        "\n"
        "def pytest_parallel_worker_env(env, worker_id):\n"
        "    from sentry.testutils.pytest.workers import configure_worker_env\n"
        "    configure_worker_env(env, worker_id)\n"
        "    env['SELECTED_TESTS_FILE'] = env['WORKER_SELECTED_TESTS_FILE']\n"
        "    env['TEST_GROUP'] = '1'\n"
        "    env['SENTRY_SHUFFLE_TESTS_SEED'] = '999'\n",
        encoding="utf-8",
    )

    for prefix in ("a", "b"):
        test_source = "import os\nfrom pathlib import Path\n\n"
        for index in range(6):
            name = f"test_{prefix}{index}"
            test_source += (
                f"def {name}():\n"
                "    path = Path(os.environ['RUN_ORDER'])\n"
                "    with path.open('a', encoding='utf-8') as output:\n"
                f"        output.write(Path(__file__).name + '::{name}\\n')\n\n"
            )
        (suite / f"test_{prefix}.py").write_text(test_source, encoding="utf-8")

    env = os.environ.copy()
    env.pop("DJANGO_SETTINGS_MODULE", None)
    for name in (
        "_PYTEST_PARALLEL_WORKER",
        "_PYTEST_PARALLEL_WORKER_ENTRY",
        "PYTEST_PARALLEL_WORKER_ID",
        "PYTEST_PARALLEL_WORKER_COUNT",
        "PYTEST_PARALLEL_MANIFEST",
    ):
        env.pop(name, None)
    env.update(
        {
            "PYTHONPATH": os.pathsep.join(
                filter(None, [str(_REPO_ROOT / "src"), env.get("PYTHONPATH")])
            ),
            "PYTEST_ADDOPTS": "",
            "SELECTED_TESTS_FILE": str(parent_selection),
            "WORKER_SELECTED_TESTS_FILE": str(worker_selection),
            "PARENT_ORDER": str(parent_order_path),
            "RUN_ORDER": str(run_order_path),
            "WORKER_SHARD_PARTS": str(worker_shard_parts_path),
            "PYTEST_SHARD_PARTS": str(tmp_path / "parent-parts.json"),
            "TOTAL_TEST_GROUPS": "2",
            "TEST_GROUP": "0",
            "TEST_GROUP_STRATEGY": "item",
            "SENTRY_SHUFFLE_TESTS": "1",
            "SENTRY_SHUFFLE_TESTS_SEED": "1",
        }
    )
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-p",
            "pytest_parallel.plugin",
            ".",
            f"--rootdir={suite}",
            "-j",
            "1",
            "--parallel-collection=manifest",
            "--parallel-start-method=spawn",
            "-q",
        ],
        cwd=suite,
        env=env,
        check=False,
        text=True,
        capture_output=True,
        timeout=60,
    )

    assert result.returncode == 0, f"{result.stdout}\n{result.stderr}"
    assert worker_shard_parts_path.read_text(encoding="utf-8") == ""
    parent_order = json.loads(parent_order_path.read_text(encoding="utf-8"))
    run_order = run_order_path.read_text(encoding="utf-8").splitlines()
    original_order = [
        f"test_{prefix}.py::test_{prefix}{index}" for prefix in ("a", "b") for index in range(6)
    ]

    assert 1 < len(parent_order) < len(original_order)
    assert parent_order != [nodeid for nodeid in original_order if nodeid in set(parent_order)]
    assert run_order == parent_order

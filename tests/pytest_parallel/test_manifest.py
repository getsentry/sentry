from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import Mock, patch

import pytest

from pytest_parallel.coordinator import Coordinator
from pytest_parallel.manifest import (
    MANIFEST_ENV,
    Manifest,
    ManifestError,
    arrange_assigned,
    dump_manifest,
    ignores_collection,
    load_manifest,
)


class _Item:
    def __init__(self, nodeid: str) -> None:
        self.nodeid = nodeid


def _output(result: subprocess.CompletedProcess[str]) -> str:
    return f"{result.stdout}\n{result.stderr}"


def _run(
    args: list[str],
    cwd: Path,
    extra_env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    for name in (
        "_PYTEST_PARALLEL_WORKER",
        "_PYTEST_PARALLEL_WORKER_ENTRY",
        "PYTEST_PARALLEL_WORKER_ID",
        "PYTEST_PARALLEL_WORKER_COUNT",
        MANIFEST_ENV,
    ):
        env.pop(name, None)
    if extra_env:
        env.update(extra_env)
    return subprocess.run(
        [sys.executable, "-m", "pytest", *args, "--parallel-start-method=spawn", "-q"],
        cwd=cwd,
        env=env,
        check=False,
        text=True,
        capture_output=True,
        timeout=60,
    )


def _coordinator(tmp_path: Path, collection: str) -> Coordinator:
    config = Mock()
    config.hook.pytest_parallel_worker_env = Mock()
    config.known_args_namespace.file_or_dir = []
    config.invocation_params.args = ()
    config.invocation_params.plugins = ()
    config.option = SimpleNamespace(basetemp=None, log_file=None)
    config.getini = lambda name: [] if name == "addopts" else None
    config.rootpath = tmp_path
    coordinator = Coordinator(cast(Any, config), 1, collection=cast(Any, collection))
    coordinator._work_dir = tmp_path
    coordinator._num_workers = 1
    return coordinator


def test_load_manifest_rejects_corrupt_and_unreadable(tmp_path: Path) -> None:
    corrupt = tmp_path / "worker_0_manifest.json"
    corrupt.write_text("{", encoding="utf-8")
    with pytest.raises(ManifestError):
        load_manifest(corrupt)

    missing = tmp_path / "missing.json"
    with pytest.raises(ManifestError):
        load_manifest(missing)

    wrong_shape = tmp_path / "shape.json"
    wrong_shape.write_text(json.dumps({"version": True, "files": ["a.py"], "nodeids": ["a.py::test_a"]}), encoding="utf-8")
    with pytest.raises(ManifestError):
        load_manifest(wrong_shape)

    wrong_version = tmp_path / "version.json"
    wrong_version.write_text(json.dumps({"version": 2, "files": ["a.py"], "nodeids": ["a.py::test_a"]}), encoding="utf-8")
    with pytest.raises(ManifestError):
        load_manifest(wrong_version)

    non_string = tmp_path / "strings.json"
    non_string.write_text(json.dumps({"version": 1, "files": ["a.py"], "nodeids": [1]}), encoding="utf-8")
    with pytest.raises(ManifestError):
        load_manifest(non_string)

    outside = tmp_path / "outside.json"
    outside.write_text(
        json.dumps({"version": 1, "files": ["a.py"], "nodeids": ["b.py::test_b"]}),
        encoding="utf-8",
    )
    with pytest.raises(ManifestError):
        load_manifest(outside)


def test_arrange_rejects_equal_counts_with_different_identities() -> None:
    items = [_Item("a.py::test_a"), _Item("a.py::test_a")]
    manifest = Manifest(files=("a.py",), nodeids=("a.py::test_a", "a.py::test_b"))
    with pytest.raises(ManifestError):
        arrange_assigned(items, manifest)


def test_arrange_reorders_to_parent_and_drops_unselected() -> None:
    items = [
        _Item("a.py::test_a2"),
        _Item("a.py::test_unselected"),
        _Item("b.py::test_b"),
        _Item("a.py::test_a1"),
    ]
    manifest = Manifest(
        files=("a.py", "b.py"),
        nodeids=("a.py::test_a1", "b.py::test_b", "a.py::test_a2"),
    )
    assert [item.nodeid for item in arrange_assigned(items, manifest)] == list(manifest.nodeids)


def test_arrange_rejects_changed_id_and_extra_occurrence() -> None:
    changed = Manifest(files=("a.py",), nodeids=("a.py::test_a",))
    with pytest.raises(ManifestError):
        arrange_assigned([_Item("b.py::test_b")], changed)

    duplicate = Manifest(files=("a.py",), nodeids=("a.py::test_a",))
    with pytest.raises(ManifestError):
        arrange_assigned([_Item("a.py::test_a"), _Item("a.py::test_a")], duplicate)


def test_ignores_collection_skips_unassigned_package(tmp_path: Path) -> None:
    assigned = tmp_path / "pkg_a" / "test_a.py"
    assigned.parent.mkdir()
    assigned.write_text("def test_a():\n    pass\n", encoding="utf-8")
    (tmp_path / "pkg_b").mkdir()
    files = ["pkg_a/test_a.py"]
    assert ignores_collection(tmp_path / "pkg_b", tmp_path, files) is True
    assert ignores_collection(tmp_path / "pkg_a", tmp_path, files) is False
    assert ignores_collection(assigned, tmp_path, files) is False
    assert ignores_collection(tmp_path, tmp_path, files) is False
    sibling = tmp_path / "pkg_a" / "test_other.py"
    sibling.write_text("def test_other():\n    pass\n", encoding="utf-8")
    assert ignores_collection(sibling, tmp_path, files) is True


def test_dump_manifest_preserves_duplicate_nodeids_and_file_order(tmp_path: Path) -> None:
    path = tmp_path / "worker_0_manifest.json"
    dump_manifest(path, ["a.py::test_b", "b.py::test_a", "a.py::test_b"])
    assert json.loads(path.read_text(encoding="utf-8")) == {
        "version": 1,
        "files": ["a.py", "b.py"],
        "nodeids": ["a.py::test_b", "b.py::test_a", "a.py::test_b"],
    }
    loaded = load_manifest(path)
    assert loaded.files == ("a.py", "b.py")
    assert loaded.nodeids == ("a.py::test_b", "b.py::test_a", "a.py::test_b")


def test_spawn_manifest_env_overwrites_hook_and_nodeid_mode_clears_it(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(MANIFEST_ENV, "stale")
    manifest_coordinator = _coordinator(tmp_path, "manifest")

    def _hook(env: dict[str, str], worker_id: int) -> None:
        env[MANIFEST_ENV] = "from-hook"

    cast(Any, manifest_coordinator.config.hook.pytest_parallel_worker_env).side_effect = _hook
    context = Mock()
    context.Process.return_value = Mock()
    nodeids = ["a.py::test_b", "b.py::test_a", "a.py::test_b"]
    with patch("pytest_parallel.coordinator._multiprocessing_context", return_value=context):
        manifest_coordinator._spawn([(0, nodeids)])

    env = context.Process.call_args.kwargs["args"][0]
    manifest_path = Path(env[MANIFEST_ENV])
    assert manifest_path.name == "worker_0_manifest.json"
    assert manifest_path.parent == tmp_path
    assert json.loads(manifest_path.read_text(encoding="utf-8")) == {
        "version": 1,
        "files": ["a.py", "b.py"],
        "nodeids": nodeids,
    }

    nodeid_coordinator = _coordinator(tmp_path, "nodeid")
    cast(Any, nodeid_coordinator.config.hook.pytest_parallel_worker_env).side_effect = _hook
    nodeid_context = Mock()
    nodeid_context.Process.return_value = Mock()
    with patch("pytest_parallel.coordinator._multiprocessing_context", return_value=nodeid_context):
        nodeid_coordinator._spawn([(0, ["a.py::test_a"])])
    assert MANIFEST_ENV not in nodeid_context.Process.call_args.kwargs["args"][0]


def test_manifest_forwarding_appends_directory_not_nodeids(tmp_path: Path) -> None:
    config = Mock()
    config.known_args_namespace.file_or_dir = [str(tmp_path)]
    config.invocation_params.args = (str(tmp_path), "--parallel-collection=manifest", "-q")
    config.invocation_params.plugins = ()
    config.option = SimpleNamespace(basetemp=None, log_file=None)
    config.getini = lambda name: [] if name == "addopts" else None
    config.rootpath = tmp_path
    manifest_coordinator = Coordinator(cast(Any, config), 1, collection="manifest")
    manifest_coordinator._work_dir = tmp_path
    manifest_args = manifest_coordinator._forwarded_args(worker_id=0)
    assert manifest_args[-1] == str(tmp_path)
    assert manifest_args.count(str(tmp_path)) == 1
    assert "--parallel-collection=manifest" not in manifest_args
    assert not any("::" in arg for arg in manifest_args)

    nodeid_coordinator = Coordinator(cast(Any, config), 1, collection="nodeid")
    nodeid_coordinator._work_dir = tmp_path
    nodeid_args = nodeid_coordinator._forwarded_args(worker_id=0)
    assert str(tmp_path) not in nodeid_args


def test_invalid_parallel_collection_is_usage_error(tmp_path: Path) -> None:
    test_file = tmp_path / "test_ok.py"
    test_file.write_text("def test_ok():\n    assert True\n", encoding="utf-8")
    parallel = _run([str(test_file), "-j", "1", "--parallel-collection=sideways"], tmp_path)
    assert parallel.returncode == int(pytest.ExitCode.USAGE_ERROR), _output(parallel)
    serial = _run([str(test_file), "--serial", "--parallel-collection=sideways"], tmp_path)
    assert serial.returncode == int(pytest.ExitCode.USAGE_ERROR), _output(serial)


def test_parent_order_is_worker_run_order(tmp_path: Path) -> None:
    suite = tmp_path / "suite"
    suite.mkdir()
    order_path = tmp_path / "order.txt"
    argv_path = tmp_path / "argv.txt"
    manifest_env_path = tmp_path / "manifest_env.txt"
    manifest_copy = tmp_path / "manifest.json"
    (suite / "conftest.py").write_text(
        "import os\n"
        "from pathlib import Path\n"
        "\n"
        "def pytest_configure(config):\n"
        "    if os.environ.get('_PYTEST_PARALLEL_WORKER') != '1':\n"
        "        return\n"
        "    Path(os.environ['ARGV_PATH']).write_text(\n"
        "        '\\n'.join(map(str, config.invocation_params.args)), encoding='utf-8'\n"
        "    )\n"
        "    Path(os.environ['MANIFEST_ENV_PATH']).write_text(\n"
        "        os.environ.get('PYTEST_PARALLEL_MANIFEST', ''), encoding='utf-8'\n"
        "    )\n"
        "    manifest = os.environ.get('PYTEST_PARALLEL_MANIFEST')\n"
        "    if manifest:\n"
        "        Path(os.environ['MANIFEST_COPY']).write_text(\n"
        "            Path(manifest).read_text(encoding='utf-8'), encoding='utf-8'\n"
        "        )\n"
        "\n"
        "def pytest_collection_modifyitems(config, items):\n"
        "    if os.environ.get('_PYTEST_PARALLEL_WORKER') == '1':\n"
        "        return\n"
        "    by_name = {item.name: item for item in items}\n"
        "    items[:] = [by_name['test_a1'], by_name['test_b'], by_name['test_a2']]\n",
        encoding="utf-8",
    )
    (suite / "test_a.py").write_text(
        "import os\n"
        "from pathlib import Path\n"
        "\n"
        "def _mark(name):\n"
        "    path = Path(os.environ['ORDER_PATH'])\n"
        "    existing = path.read_text(encoding='utf-8') if path.exists() else ''\n"
        "    path.write_text(existing + name + '\\n', encoding='utf-8')\n"
        "\n"
        "def test_a1():\n"
        "    _mark('a1')\n"
        "\n"
        "def test_a2():\n"
        "    _mark('a2')\n",
        encoding="utf-8",
    )
    (suite / "test_b.py").write_text(
        "import os\n"
        "from pathlib import Path\n"
        "\n"
        "def test_b():\n"
        "    path = Path(os.environ['ORDER_PATH'])\n"
        "    existing = path.read_text(encoding='utf-8') if path.exists() else ''\n"
        "    path.write_text(existing + 'b\\n', encoding='utf-8')\n",
        encoding="utf-8",
    )
    result = _run(
        [str(suite), "-j", "1", "--parallel-collection=manifest"],
        suite,
        {
            "ORDER_PATH": str(order_path),
            "ARGV_PATH": str(argv_path),
            "MANIFEST_ENV_PATH": str(manifest_env_path),
            "MANIFEST_COPY": str(manifest_copy),
            MANIFEST_ENV: "stale",
        },
    )
    assert result.returncode == 0, _output(result)
    assert order_path.read_text(encoding="utf-8").splitlines() == ["a1", "b", "a2"]
    argv = argv_path.read_text(encoding="utf-8")
    assert "test_a.py" not in argv
    assert "test_b.py" not in argv
    assert "::" not in argv
    assert str(suite) in argv
    recorded_env = manifest_env_path.read_text(encoding="utf-8")
    assert recorded_env != "stale"
    assert Path(recorded_env).name == "worker_0_manifest.json"
    document = json.loads(manifest_copy.read_text(encoding="utf-8"))
    assert document["version"] == 1
    assert [Path(path).name for path in document["files"]] == ["test_a.py", "test_b.py"]
    assert [
        (Path(nodeid.split("::", 1)[0]).name, nodeid.split("::", 1)[1])
        for nodeid in document["nodeids"]
    ] == [("test_a.py", "test_a1"), ("test_b.py", "test_b"), ("test_a.py", "test_a2")]


def test_parametrized_nodeid_runs(tmp_path: Path) -> None:
    suite = tmp_path / "suite"
    suite.mkdir()
    marker = tmp_path / "marker.txt"
    (suite / "test_param.py").write_text(
        "import os\n"
        "from pathlib import Path\n"
        "import pytest\n"
        "\n"
        "@pytest.mark.parametrize('value', ['alpha'])\n"
        "def test_param(value):\n"
        "    Path(os.environ['MARKER']).write_text(value, encoding='utf-8')\n",
        encoding="utf-8",
    )
    result = _run(
        [str(suite), "-j", "1", "--parallel-collection=manifest"],
        suite,
        {"MARKER": str(marker)},
    )
    assert result.returncode == 0, _output(result)
    assert marker.read_text(encoding="utf-8") == "alpha"


def test_duplicate_nodeid_runs_twice_in_order(tmp_path: Path) -> None:
    suite = tmp_path / "suite"
    suite.mkdir()
    order_path = tmp_path / "order.txt"
    (suite / "conftest.py").write_text(
        "def pytest_collection_modifyitems(items):\n"
        "    if len(items) == 1:\n"
        "        items.append(items[0])\n",
        encoding="utf-8",
    )
    (suite / "test_twice.py").write_text(
        "import os\n"
        "from pathlib import Path\n"
        "\n"
        "def test_twice():\n"
        "    path = Path(os.environ['ORDER_PATH'])\n"
        "    existing = path.read_text(encoding='utf-8') if path.exists() else ''\n"
        "    path.write_text(existing + 'ran\\n', encoding='utf-8')\n",
        encoding="utf-8",
    )
    result = _run(
        [str(suite), "-j", "1", "--parallel-collection=manifest"],
        suite,
        {"ORDER_PATH": str(order_path)},
    )
    assert result.returncode == 0, _output(result)
    assert order_path.read_text(encoding="utf-8").splitlines() == ["ran", "ran"]


def test_unicode_nodeid_runs(tmp_path: Path) -> None:
    suite = tmp_path / "suite"
    suite.mkdir()
    marker = tmp_path / "marker.txt"
    (suite / "test_unicode.py").write_text(
        "import os\n"
        "from pathlib import Path\n"
        "\n"
        "def test_文件():\n"
        "    Path(os.environ['MARKER']).write_text('ok', encoding='utf-8')\n",
        encoding="utf-8",
    )
    result = _run(
        [str(suite), "-j", "1", "--parallel-collection=manifest"],
        suite,
        {"MARKER": str(marker)},
    )
    assert result.returncode == 0, _output(result)
    assert marker.read_text(encoding="utf-8") == "ok"


def test_unselected_item_in_assigned_file_is_not_run(tmp_path: Path) -> None:
    suite = tmp_path / "suite"
    suite.mkdir()
    kept = tmp_path / "kept.txt"
    dropped = tmp_path / "dropped.txt"
    (suite / "conftest.py").write_text(
        "import os\n"
        "\n"
        "def pytest_collection_modifyitems(items):\n"
        "    if os.environ.get('_PYTEST_PARALLEL_WORKER') == '1':\n"
        "        return\n"
        "    items[:] = [item for item in items if item.name != 'test_unselected']\n",
        encoding="utf-8",
    )
    (suite / "test_select.py").write_text(
        "import os\n"
        "from pathlib import Path\n"
        "\n"
        "def test_kept():\n"
        "    Path(os.environ['KEPT']).write_text('ran', encoding='utf-8')\n"
        "\n"
        "def test_unselected():\n"
        "    Path(os.environ['DROPPED']).write_text('ran', encoding='utf-8')\n"
        "    assert False\n",
        encoding="utf-8",
    )
    result = _run(
        [str(suite), "-j", "1", "--parallel-collection=manifest"],
        suite,
        {"KEPT": str(kept), "DROPPED": str(dropped)},
    )
    assert result.returncode == 0, _output(result)
    assert kept.read_text(encoding="utf-8") == "ran"
    assert not dropped.exists()


def test_missing_assigned_id_fails_before_tests(tmp_path: Path) -> None:
    suite = tmp_path / "suite"
    suite.mkdir()
    marker = tmp_path / "marker.txt"
    (suite / "test_missing.py").write_text(
        "import os\n"
        "from pathlib import Path\n"
        "\n"
        "marker = Path(os.environ['MARKER'])\n"
        "if os.environ.get('_PYTEST_PARALLEL_WORKER') != '1':\n"
        "    def test_only_parent():\n"
        "        marker.write_text('parent', encoding='utf-8')\n"
        "\n"
        "def test_sibling():\n"
        "    marker.write_text('sibling', encoding='utf-8')\n",
        encoding="utf-8",
    )
    result = _run(
        [str(suite), "-j", "1", "--parallel-collection=manifest"],
        suite,
        {"MARKER": str(marker)},
    )
    assert result.returncode != 0, _output(result)
    assert not marker.exists()


def test_directory_invocation_configures_before_nested_conftest(tmp_path: Path) -> None:
    """Directory collection configures plugins before importing a nested conftest.

    A direct leaf path imports that nested conftest before plugin configure.
    This run passes the directory and checks the worker command omits the leaf.
    """
    suite = tmp_path / "suite"
    package = suite / "pkg"
    package.mkdir(parents=True)
    record = tmp_path / "record.txt"
    argv_path = tmp_path / "argv.txt"
    (suite / "conftest.py").write_text(
        "import os\n"
        "import sys\n"
        "from pathlib import Path\n"
        "\n"
        "def pytest_configure(config):\n"
        "    if os.environ.get('_PYTEST_PARALLEL_WORKER') != '1':\n"
        "        return\n"
        "    Path(os.environ['RECORD']).write_text('configure\\n', encoding='utf-8')\n"
        "    Path(os.environ['ARGV_PATH']).write_text('\\n'.join(sys.argv), encoding='utf-8')\n",
        encoding="utf-8",
    )
    (package / "conftest.py").write_text(
        "import os\n"
        "from pathlib import Path\n"
        "\n"
        "if os.environ.get('_PYTEST_PARALLEL_WORKER') == '1':\n"
        "    record = Path(os.environ['RECORD'])\n"
        "    existing = record.read_text(encoding='utf-8') if record.exists() else ''\n"
        "    record.write_text(existing + 'nested\\n', encoding='utf-8')\n",
        encoding="utf-8",
    )
    (package / "test_leaf_assigned.py").write_text(
        "def test_leaf():\n    assert True\n",
        encoding="utf-8",
    )
    result = _run(
        [str(suite), "-j", "1", "--parallel-collection=manifest"],
        suite,
        {"RECORD": str(record), "ARGV_PATH": str(argv_path)},
    )
    assert result.returncode == 0, _output(result)
    assert record.read_text(encoding="utf-8").splitlines() == ["configure", "nested"]
    argv = argv_path.read_text(encoding="utf-8")
    assert "test_leaf_assigned.py" not in argv
    assert str(suite) in argv


def test_worker_does_not_import_unassigned_package(tmp_path: Path) -> None:
    suite = tmp_path / "suite"
    pkg_a = suite / "pkg_a"
    pkg_b = suite / "pkg_b"
    pkg_a.mkdir(parents=True)
    pkg_b.mkdir()
    marker = tmp_path / "imported.txt"
    (suite / "conftest.py").write_text(
        "import os\n"
        "\n"
        "def pytest_ignore_collect(collection_path):\n"
        "    if os.environ.get('_PYTEST_PARALLEL_WORKER') == '1':\n"
        "        return None\n"
        "    if collection_path.name == 'pkg_b':\n"
        "        return True\n"
        "    return None\n",
        encoding="utf-8",
    )
    (pkg_a / "__init__.py").write_text("", encoding="utf-8")
    (pkg_a / "test_a.py").write_text("def test_a():\n    assert True\n", encoding="utf-8")
    (pkg_b / "__init__.py").write_text(
        "import os\n"
        "from pathlib import Path\n"
        "Path(os.environ['MARKER']).write_text('imported', encoding='utf-8')\n"
        "raise RuntimeError('pkg_b imported')\n",
        encoding="utf-8",
    )
    (pkg_b / "test_b.py").write_text("def test_b():\n    assert False\n", encoding="utf-8")
    result = _run(
        [str(suite), "-j", "1", "--parallel-collection=manifest"],
        suite,
        {"MARKER": str(marker)},
    )
    assert result.returncode == 0, _output(result)
    assert not marker.exists()


def test_nodeid_mode_puts_absolute_nodeid_on_the_worker_command(tmp_path: Path) -> None:
    suite = tmp_path / "suite"
    suite.mkdir()
    argv_path = tmp_path / "argv.txt"
    manifest_env_path = tmp_path / "manifest_env.txt"
    (suite / "conftest.py").write_text(
        "import os\n"
        "from pathlib import Path\n"
        "\n"
        "def pytest_configure(config):\n"
        "    if os.environ.get('_PYTEST_PARALLEL_WORKER') != '1':\n"
        "        return\n"
        "    Path(os.environ['ARGV_PATH']).write_text(\n"
        "        '\\n'.join(map(str, config.invocation_params.args)), encoding='utf-8'\n"
        "    )\n"
        "    Path(os.environ['MANIFEST_ENV_PATH']).write_text(\n"
        "        os.environ.get('PYTEST_PARALLEL_MANIFEST', ''), encoding='utf-8'\n"
        "    )\n",
        encoding="utf-8",
    )
    (suite / "test_abs.py").write_text("def test_abs():\n    assert True\n", encoding="utf-8")
    result = _run(
        [str(suite), "-j", "1", "--parallel-collection=nodeid"],
        suite,
        {
            "ARGV_PATH": str(argv_path),
            "MANIFEST_ENV_PATH": str(manifest_env_path),
            MANIFEST_ENV: "stale",
        },
    )
    assert result.returncode == 0, _output(result)
    argv = argv_path.read_text(encoding="utf-8").splitlines()
    absolute = [arg for arg in argv if "::" in arg]
    assert len(absolute) == 1
    file_part, sep, rest = absolute[0].partition("::")
    assert sep == "::"
    assert Path(file_part).is_absolute()
    assert rest == "test_abs"
    assert manifest_env_path.read_text(encoding="utf-8") == ""

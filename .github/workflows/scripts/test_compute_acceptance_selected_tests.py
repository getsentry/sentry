#!/usr/bin/env python3
"""Tests for compute-acceptance-selected-tests.py."""

from __future__ import annotations

import importlib.util
import json
import sqlite3
import sys
from collections.abc import Iterator
from pathlib import Path
from unittest import mock

import pytest

_script_path = Path(__file__).parent / "compute-acceptance-selected-tests.py"
_spec = importlib.util.spec_from_file_location("compute_acceptance_selected_tests", _script_path)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["compute_acceptance_selected_tests"] = _mod
_spec.loader.exec_module(_mod)

from compute_acceptance_selected_tests import (
    FRONTEND_ENTRIES,
    SHELL_ROOTS,
    TEST_PAGES,
    FrontendGraph,
    main,
    select_tests,
    shard_plan,
)

_REPO_ROOT = Path(__file__).parents[3]

ISSUES_TEST = "tests/acceptance/test_issue_details.py"
DASHBOARDS_TEST = "tests/acceptance/test_organization_dashboards.py"
PROXY_TEST = "tests/acceptance/test_proxy.py"
UNMAPPED_TEST = "tests/acceptance/test_brand_new.py"


def _write(root: Path, files: dict[str, str]) -> None:
    for path, content in files.items():
        (root / path).parent.mkdir(parents=True, exist_ok=True)
        (root / path).write_text(content)


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    _write(
        tmp_path,
        {
            ISSUES_TEST: "from fixtures.page_objects.issue_details import IssueDetailsPage\n"
            "def test_a(): pass\ndef test_b(): pass\n",
            DASHBOARDS_TEST: "def test_a(): pass\n",
            PROXY_TEST: "def test_a(): pass\n",
            UNMAPPED_TEST: "def test_a(): pass\n",
            "fixtures/page_objects/issue_details.py": "",
            "static/app/index.tsx": "import('sentry/bootstrap/main');\n",
            "static/app/bootstrap/main.tsx": "import {App} from 'sentry/views/app/root';\n"
            "import {routes} from 'sentry/router/routes';\n",
            "static/app/views/app/root.tsx": "import {Button} from 'sentry/components/button';\n"
            "import {events} from 'sentry/utils/analytics';\n",
            "static/app/components/button.tsx": "",
            "static/app/utils/analytics.tsx": "import type {X} from 'sentry/views/dashboards/types';\n",
            "static/app/views/dashboards/types.tsx": "",
            "static/app/views/dashboards/index.tsx": "import {Chart} from 'sentry/components/chart';\n",
            "static/app/components/chart.tsx": "",
            "static/app/views/issueDetails/index.tsx": "import {Frame} from '../../components/frame';\n"
            'const docs = () => import(/* webpackChunkName: "x" */ `sentry/docs/${name}`);\n',
            "static/app/components/frame.tsx": "import {IconAdd} from '@sentry/icons/add';\n",
            "static/app/docs/python.tsx": "",
            "static/app/views/unused/index.tsx": "",
            "static/app/router/routes.tsx": "const a = () => import('sentry/views/issueDetails');\n"
            "const b = () => import('sentry/views/dashboards');\n",
            "static/packages/icons/src/iconAdd.tsx": "",
            "static/app/styles/global.css": "",
        },
    )
    return tmp_path


@pytest.fixture(autouse=True)
def test_pages() -> Iterator[None]:
    pages = {
        ISSUES_TEST: ("static/app/views/issueDetails/",),
        DASHBOARDS_TEST: ("static/app/views/dashboards/",),
        PROXY_TEST: (),
    }
    with (
        mock.patch.dict(_mod.TEST_PAGES, pages, clear=True),
        mock.patch.object(_mod, "FRONTEND_ENTRIES", ("static/app/index.tsx",)),
    ):
        yield


def _coverage_db(path: Path, file_to_contexts: dict[str, list[str]]) -> Path:
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE file (id INTEGER PRIMARY KEY, path TEXT)")
    conn.execute("CREATE TABLE context (id INTEGER PRIMARY KEY, context TEXT)")
    conn.execute("CREATE TABLE line_bits (file_id INTEGER, context_id INTEGER, numbits BLOB)")
    contexts: dict[str, int] = {}
    for file_id, (file_path, file_contexts) in enumerate(file_to_contexts.items(), 1):
        conn.execute("INSERT INTO file VALUES (?, ?)", (file_id, file_path))
        for context in file_contexts:
            if context not in contexts:
                contexts[context] = len(contexts) + 1
                conn.execute("INSERT INTO context VALUES (?, ?)", (contexts[context], context))
            conn.execute(
                "INSERT INTO line_bits VALUES (?, ?, ?)", (file_id, contexts[context], b"\x01")
            )
    conn.commit()
    conn.close()
    return path


class TestFullSuite:
    @pytest.mark.parametrize(
        "changed",
        [
            [],
            [".github/workflows/acceptance.yml"],
            [".github/workflows/scripts/compute-acceptance-selected-tests.py"],
            [".github/workflows/scripts/run-acceptance-tests.sh"],
            ["pnpm-lock.yaml"],
            ["tests/acceptance/conftest.py"],
            ["src/sentry/testutils/pytest/selenium.py"],
            ["src/sentry/conf/server.py"],
            ["src/sentry/templates/sentry/layout.html"],
            ["bin/some-new-script"],
        ],
    )
    def test_runs_everything(self, repo: Path, changed: list[str]) -> None:
        assert select_tests(changed, repo, None).full_suite

    def test_python_without_coverage(self, repo: Path) -> None:
        selection = select_tests(["src/sentry/api/foo.py"], repo, None)
        assert selection.full_suite
        assert "no acceptance coverage" in selection.full_suite_reasons[0]

    def test_unreadable_coverage(self, repo: Path) -> None:
        db = repo / "bad.coverage"
        sqlite3.connect(db).execute("CREATE TABLE dummy (id INTEGER)").connection.close()
        assert select_tests(["src/sentry/api/foo.py"], repo, db).full_suite

    def test_app_shell(self, repo: Path) -> None:
        selection = select_tests(["static/app/components/button.tsx"], repo, None)
        assert selection.full_suite
        assert "app shell" in selection.full_suite_reasons[0]

    def test_asset_the_graph_cannot_place(self, repo: Path) -> None:
        assert select_tests(["static/app/styles/global.css"], repo, None).full_suite

    def test_acceptance_helper(self, repo: Path) -> None:
        _write(repo, {"tests/acceptance/helpers.py": ""})
        assert select_tests(["tests/acceptance/helpers.py"], repo, None).full_suite


class TestSelection:
    def _select(self, repo: Path, changed: list[str], coverage_db: Path | None = None) -> set[str]:
        selection = select_tests(changed, repo, coverage_db)
        assert not selection.full_suite, selection.full_suite_reasons
        return selection.tests

    @pytest.mark.parametrize(
        "changed",
        [
            ["tests/sentry/api/test_foo.py"],
            ["static/app/views/issueDetails/index.spec.tsx"],
            ["CLAUDE.md", "static/app/views/issueDetails/README.md"],
            ["src/sentry/migrations/1234_add_thing.py", "migrations_lockfile.txt"],
            [".github/workflows/frontend.yml"],
        ],
    )
    def test_ignored_files_select_nothing(self, repo: Path, changed: list[str]) -> None:
        assert self._select(repo, changed) == set()

    def test_changed_test_selects_itself(self, repo: Path) -> None:
        assert self._select(repo, [DASHBOARDS_TEST]) == {DASHBOARDS_TEST}

    def test_deleted_test_selects_nothing(self, repo: Path) -> None:
        assert self._select(repo, ["tests/acceptance/test_gone.py"]) == set()

    def test_page_object_selects_importers(self, repo: Path) -> None:
        assert self._select(repo, ["fixtures/page_objects/issue_details.py"]) == {ISSUES_TEST}

    def test_python_uses_coverage(self, repo: Path) -> None:
        db = _coverage_db(
            repo / "acceptance.coverage",
            {
                "/home/runner/work/sentry/sentry/src/sentry/api/foo.py": [
                    f"{PROXY_TEST}::ProxyTest::test_a|run",
                    f"{ISSUES_TEST}::IssueTest::test_a|setup",
                    # Deleted since the coverage run.
                    "tests/acceptance/test_gone.py::GoneTest::test_a|run",
                ],
                "/home/runner/work/sentry/sentry/src/sentry/api/bar.py": [
                    f"{DASHBOARDS_TEST}::DashboardsTest::test_a|run",
                ],
            },
        )
        assert self._select(repo, ["src/sentry/api/foo.py"], db) == {PROXY_TEST, ISSUES_TEST}
        assert self._select(repo, ["src/sentry/api/new.py"], db) == set()

    def test_page_file_selects_its_tests_and_unmapped_tests(self, repo: Path) -> None:
        assert self._select(repo, ["static/app/components/frame.tsx"]) == {
            ISSUES_TEST,
            UNMAPPED_TEST,
        }

    def test_page_code_the_shell_imports(self, repo: Path) -> None:
        # analytics.tsx imports dashboards types, but that doesn't put them on every page.
        assert self._select(repo, ["static/app/views/dashboards/types.tsx"]) == {
            DASHBOARDS_TEST,
            UNMAPPED_TEST,
        }

    def test_router_does_not_join_pages(self, repo: Path) -> None:
        assert self._select(repo, ["static/app/components/chart.tsx"]) == {
            DASHBOARDS_TEST,
            UNMAPPED_TEST,
        }

    def test_template_literal_dynamic_import(self, repo: Path) -> None:
        assert ISSUES_TEST in self._select(repo, ["static/app/docs/python.tsx"])

    def test_workspace_package_is_one_node(self, repo: Path) -> None:
        assert ISSUES_TEST in self._select(repo, ["static/packages/icons/src/iconOther.tsx"])

    def test_code_outside_the_build(self, repo: Path) -> None:
        assert self._select(repo, ["static/app/views/unused/index.tsx"]) == set()
        assert self._select(repo, ["static/app/views/deleted.tsx"]) == set()


class TestShardPlan:
    @pytest.mark.parametrize(
        ("items", "expected"),
        [
            (0, (0, [])),
            (1, (1, [0])),
            (40, (1, [0])),
            (41, (2, [0, 1])),
            (999, (5, list(range(5)))),
        ],
    )
    def test_shards(self, items: int, expected: tuple[int, list[int]]) -> None:
        assert shard_plan(items) == expected


class TestMain:
    def _run(
        self, repo: Path, monkeypatch: pytest.MonkeyPatch, tmp_path: Path, *args: str
    ) -> dict[str, str]:
        github_output = tmp_path / "github_output"
        github_output.touch()
        monkeypatch.chdir(repo)
        monkeypatch.setenv("GITHUB_OUTPUT", str(github_output))
        argv = ["x", *args, "--output", "out/selected.txt", "--github-output"]
        with mock.patch("sys.argv", argv):
            assert main() == 0
        return dict(line.split("=", 1) for line in github_output.read_text().splitlines())

    def test_selected(self, repo: Path, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        outputs = self._run(repo, monkeypatch, tmp_path, "--changed-files", ISSUES_TEST)
        assert outputs == {
            "selected": "true",
            "test-count": "2",
            "shard-count": "1",
            "shard-indices": "[0]",
        }
        assert (repo / "out/selected.txt").read_text() == f"{ISSUES_TEST}\n"

    def test_nothing_selected(
        self, repo: Path, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        outputs = self._run(
            repo, monkeypatch, tmp_path, "--changed-files", "tests/sentry/test_foo.py"
        )
        assert outputs["shard-count"] == "0"
        assert json.loads(outputs["shard-indices"]) == []

    def test_full_suite(self, repo: Path, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        outputs = self._run(repo, monkeypatch, tmp_path, "--changed-files", "pnpm-lock.yaml")
        assert outputs == {"selected": "false"}
        assert not (repo / "out/selected.txt").exists()

    def test_missing_coverage_file(
        self, repo: Path, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        outputs = self._run(
            repo,
            monkeypatch,
            tmp_path,
            "--changed-files",
            "src/sentry/api/foo.py",
            "--coverage-db",
            "nope.coverage",
        )
        assert outputs == {"selected": "false"}


class TestConfigPaths:
    """The page map and graph roots must point at real paths in this repo."""

    @pytest.mark.parametrize("test_file", sorted(TEST_PAGES))
    def test_mapped_tests_exist(self, test_file: str) -> None:
        assert (_REPO_ROOT / test_file).is_file(), f"{test_file} was moved or deleted"

    @pytest.mark.parametrize(
        "prefix", sorted({p for pages in TEST_PAGES.values() for p in pages} | set(SHELL_ROOTS))
    )
    def test_prefixes_exist(self, prefix: str) -> None:
        assert (_REPO_ROOT / prefix).exists(), f"{prefix} was moved or deleted"

    @pytest.mark.parametrize("entry", FRONTEND_ENTRIES)
    def test_entries_exist(self, entry: str) -> None:
        assert (_REPO_ROOT / entry).is_file()

    def test_graph_resolves_the_app(self) -> None:
        graph = FrontendGraph(_REPO_ROOT)
        reachable = graph.closure(FRONTEND_ENTRIES, lambda _: True)
        assert "static/app/views/issueDetails/groupDetails.tsx" in reachable

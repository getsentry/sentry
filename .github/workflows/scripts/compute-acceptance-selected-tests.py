#!/usr/bin/env python3
"""Pick the acceptance tests that a pull request needs to run.

Acceptance tests drive the built frontend against a live Django server, so a
change can reach them through Python or through the frontend bundle. Each
changed file is classified on its own, and any file that can't be classified
makes the whole suite run:

- Files that can't affect the acceptance build or server (other test suites,
  docs, unrelated tooling) select nothing.
- Changed acceptance test files select themselves. Page objects select the
  tests that import them.
- Python under src/ selects the tests whose recorded coverage includes the
  file. The coverage comes from a scheduled full acceptance run (see
  acceptance.yml). Without it, a Python change runs the whole suite.
- Frontend files under static/ go through a static import graph. A file in
  the app shell (the layout and navigation around every page, and what they
  import outside of page directories) runs the whole suite. Any other file
  selects the tests whose pages (TEST_PAGES) import it. A non-code file
  outside the graph runs the whole suite, because we can't tell how the build
  uses it.
- Everything else, including the build, the test harness, and dependency
  files, runs the whole suite.

Pushes to master always run the whole suite, so a test that this misses
fails there.

Usage:
    python3 compute-acceptance-selected-tests.py \\
        --changed-files "static/app/views/issueDetails/foo.tsx" \\
        [--coverage-db .artifacts/acceptance.coverage] \\
        --output .artifacts/acceptance-selected-tests.txt --github-output
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import os
import re
import sqlite3
import sys
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from pathlib import Path

from count_test_items import count_tests_in_file

ACCEPTANCE_DIR = "tests/acceptance/"

# Each shard spends several minutes building the frontend and starting
# services before it runs a test, so a small selection gets few shards.
TESTS_PER_SHARD = 40
MAX_SHARDS = 5

FULL_SUITE_TRIGGERS: list[str | re.Pattern[str]] = [
    # How the suite is built and run.
    ".github/workflows/acceptance.yml",
    ".github/file-filters.yml",
    re.compile(r"^\.github/actions/"),
    # The acceptance scripts, including this one, and the scripts they use.
    re.compile(
        r"^\.github/workflows/scripts/([^/]*acceptance[^/]*|install-chrome-for-testing\.sh"
        r"|bootstrap-snuba\.py|kafka-topics-healthcheck\.sh|monitor-resources\.py"
        r"|pr-changed-files\.sh|parse-pr-files\.py|count_test_items\.py"
        r"|compute-sentry-selected-tests\.py)$"
    ),
    "Makefile",
    "setup.cfg",
    re.compile(r"^devservices/"),
    re.compile(r"^config/"),
    re.compile(r"^\.(python|node)-version$"),
    # The test harness. The backend's list below covers testutils/pytest/.
    re.compile(r"^tests/(acceptance/)?conftest\.py$"),
    re.compile(r"^tests/acceptance/.*__init__\.py$"),
    "fixtures/page_objects/base.py",
    "fixtures/page_objects/__init__.py",
    # Frontend build and dependencies.
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    re.compile(r"^rsbuild\.config\.ts$"),
    re.compile(r"^babel\.config\."),
    re.compile(r"^tsconfig[^/]*\.json$"),
    re.compile(r"^static/(app|gsApp|gsAdmin)/package\.json$"),
    # Django templates and assets that render around the app.
    re.compile(r"^src/sentry/templates/"),
    re.compile(r"^src/sentry/static/"),
]

# Files that neither the acceptance build nor the server it tests reads.
IGNORED: list[re.Pattern[str]] = [
    re.compile(r"\.mdx?$"),
    re.compile(r"^tests/(?!acceptance/|conftest\.py$)"),
    re.compile(r"^\.github/"),
    re.compile(r"^\.agents/"),
    re.compile(r"^\.cursor/"),
    re.compile(r"^api-docs/"),
    re.compile(r"^tools/"),
    re.compile(r"^devenv/"),
    re.compile(r"\.(spec|test)\.[jt]sx?$"),
    re.compile(r"\.stories\.tsx$"),
    re.compile(r"(^|/)__(mocks|stories)__/"),
    re.compile(r"(^|/)oxlint-suppressions\.json$"),
    re.compile(r"\.snap$"),
    re.compile(r"\.(snapshots|figma)\.tsx$"),
    re.compile(r"^static/oxlint/"),
    re.compile(r"(^|/)\.oxlintrc\.json$"),
    re.compile(r"^(oxlint\.[^/]+|knip\.config)\.ts$"),
    re.compile(r"^\.craft\.yml$"),
    re.compile(r"^(\.pre-commit-config\.yaml|\.oxfmtrc\.json|CHANGES)$"),
    re.compile(r"^decisionModelLinter\.config\.ts$"),
    re.compile(r"^static/packages/[^/]+/tsconfig[^/]*\.json$"),
    # pytest runs with --nomigrations, so the test database comes from models.
    re.compile(r"/migrations/\d{4}_[^/]+\.py$"),
    re.compile(r"^migrations_lockfile\.txt$"),
]

# The pages each acceptance test file visits, as path prefixes under static/.
# A frontend change selects a test when its pages import the changed file.
# Tests that don't render the React app (Django pages, emails, the API proxy)
# have no pages: only Python changes select them. A test file missing here
# runs for every frontend change that the app shell doesn't already cover.
TEST_PAGES: dict[str, tuple[str, ...]] = {
    "tests/acceptance/chartcuterie/test_chart_renderer.py": ("static/app/chartcuterie/",),
    "tests/acceptance/test_accept_organization_invite.py": (
        "static/app/views/authV2/",
        "static/app/views/auth/",
    ),
    "tests/acceptance/test_account_settings.py": ("static/app/views/settings/account/",),
    "tests/acceptance/test_api.py": ("static/app/views/settings/account/apiApplications/",),
    "tests/acceptance/test_auth.py": ("static/app/views/authV2/", "static/app/views/auth/"),
    "tests/acceptance/test_auth_react.py": ("static/app/views/authV2/", "static/app/views/auth/"),
    "tests/acceptance/test_create_organization.py": ("static/app/views/organizationCreate/",),
    "tests/acceptance/test_create_project.py": (
        "static/app/views/projectInstall/",
        "static/app/views/projects/",
        "static/app/gettingStartedDocs/",
    ),
    "tests/acceptance/test_create_team.py": ("static/app/views/settings/organizationTeams/",),
    "tests/acceptance/test_emails.py": (),
    "tests/acceptance/test_error_page_embed.py": (),
    "tests/acceptance/test_explore_logs.py": ("static/app/views/explore/",),
    "tests/acceptance/test_explore_spans.py": ("static/app/views/explore/",),
    "tests/acceptance/test_issue_details.py": (
        "static/app/views/issueDetails/",
        "static/app/components/events/",
    ),
    "tests/acceptance/test_issue_details_workflow.py": (
        "static/app/views/issueDetails/",
        "static/app/components/events/",
    ),
    "tests/acceptance/test_issue_tag_values.py": ("static/app/views/issueDetails/",),
    "tests/acceptance/test_link_team.py": (),
    "tests/acceptance/test_member_list.py": ("static/app/views/settings/organizationMembers/",),
    "tests/acceptance/test_oauth_consent.py": (
        "static/app/views/authV2/",
        "static/app/views/auth/",
    ),
    "tests/acceptance/test_onboarding.py": (
        "static/app/views/onboarding/",
        "static/app/views/projectInstall/",
        "static/app/gettingStartedDocs/",
    ),
    "tests/acceptance/test_organization_dashboards.py": ("static/app/views/dashboards/",),
    "tests/acceptance/test_organization_developer_settings.py": (
        "static/app/views/settings/organizationDeveloperSettings/",
    ),
    "tests/acceptance/test_organization_document_integration_detailed_view.py": (
        "static/app/views/settings/organizationIntegrations/",
    ),
    "tests/acceptance/test_organization_events_v2.py": (
        "static/app/views/discover/",
        "static/app/views/explore/errors/",
    ),
    "tests/acceptance/test_organization_global_selection_header.py": (
        "static/app/views/issueList/",
        "static/app/views/issueDetails/",
        "static/app/components/pageFilters/",
    ),
    "tests/acceptance/test_organization_group_index.py": ("static/app/views/issueList/",),
    "tests/acceptance/test_organization_integration_configuration_tabs.py": (
        "static/app/views/settings/organizationIntegrations/",
    ),
    "tests/acceptance/test_organization_integration_detail_view.py": (
        "static/app/views/settings/organizationIntegrations/",
    ),
    "tests/acceptance/test_organization_join_request.py": (
        "static/app/views/organizationJoinRequest/",
    ),
    "tests/acceptance/test_organization_monitors.py": (
        "static/app/views/insights/crons/",
        "static/app/views/alerts/rules/crons/",
        "static/app/views/detectors/",
    ),
    "tests/acceptance/test_organization_releases.py": ("static/app/views/explore/releases/",),
    "tests/acceptance/test_organization_security_privacy.py": (
        "static/app/views/settings/organizationSecurityAndPrivacy/",
    ),
    "tests/acceptance/test_organization_sentry_app_detailed_view.py": (
        "static/app/views/settings/organizationIntegrations/",
    ),
    "tests/acceptance/test_organization_switch.py": (
        "static/app/views/issueList/",
        "static/app/views/projectsDashboard/",
        "static/app/views/explore/releases/",
        "static/app/views/discover/",
    ),
    "tests/acceptance/test_organization_uptime.py": (
        "static/app/views/insights/uptime/",
        "static/app/views/detectors/",
    ),
    "tests/acceptance/test_performance_issues.py": (
        "static/app/views/issueDetails/",
        "static/app/components/events/",
    ),
    "tests/acceptance/test_performance_landing.py": ("static/app/views/performance/",),
    "tests/acceptance/test_performance_overview.py": ("static/app/views/performance/",),
    "tests/acceptance/test_performance_summary.py": (
        "static/app/views/performance/transactionSummary/",
    ),
    "tests/acceptance/test_performance_vital_detail.py": (
        "static/app/views/performance/vitalDetail/",
    ),
    "tests/acceptance/test_project_keys.py": ("static/app/views/settings/project/projectKeys/",),
    "tests/acceptance/test_project_ownership.py": (
        "static/app/views/settings/project/projectOwnership/",
    ),
    "tests/acceptance/test_project_tags_settings.py": ("static/app/views/settings/projectTags/",),
    "tests/acceptance/test_proxy.py": (),
    "tests/acceptance/test_quick_start.py": (
        "static/app/views/organizationCreate/",
        "static/app/views/onboarding/",
        "static/app/components/onboarding/",
        "static/app/components/onboardingWizard/",
    ),
    "tests/acceptance/test_replay_details.py": (
        "static/app/views/explore/replays/",
        "static/app/components/replays/",
    ),
    "tests/acceptance/test_replay_list.py": ("static/app/views/explore/replays/",),
    "tests/acceptance/test_shared_issue.py": ("static/app/views/sharedGroupDetails/",),
    "tests/acceptance/test_teams_list.py": ("static/app/views/settings/organizationTeams/",),
    "tests/acceptance/test_trace_view_from_explore.py": (
        "static/app/views/explore/",
        "static/app/views/performance/traceDetails/",
    ),
    "tests/acceptance/test_trace_view_waterfall.py": (
        "static/app/views/performance/traceDetails/",
    ),
}

# Bundles the acceptance build or chartcuterie loads. A frontend file that
# none of these reach isn't part of what the tests run.
FRONTEND_ENTRIES = (
    "static/app/index.tsx",
    "static/app/utils/setupStatics.tsx",
    "static/app/chartcuterie/config.tsx",
)
# What renders around every page. index.tsx and bootstrap/ load the rest of
# it with dynamic imports.
SHELL_ROOTS = (
    "static/app/index.tsx",
    "static/app/views/app/",
    "static/app/views/organizationLayout/",
    "static/app/views/navigation/",
)
SHELL_DYNAMIC_IMPORTERS = ("static/app/index.tsx", "static/app/bootstrap/")
# Page code that the shell imports, for example an analytics event registry
# that imports a page's types, still only renders on that page. The shell
# stops at these, and changes in them select tests by page.
PAGE_AREAS = re.compile(
    r"^static/(app/views/(?!app/|organizationLayout/|navigation/)|gsApp/views/)"
)
# The router lazy-loads every page, so pages don't follow its dynamic imports.
ROUTER_PREFIX = "static/app/router/"

FRONTEND_EXTENSIONS = (".tsx", ".ts", ".jsx", ".js", ".mjs")
WORKSPACE_PACKAGE_RE = re.compile(r"^@sentry/(icons|api|search-syntax)(?:/|$)")
STATIC_IMPORT_RE = re.compile(
    r"""(?:^|[^\w$.])(?:import|export)\s+(?:type\s+)?(?:[\w*${}\s,]+?\s+from\s+)?['"]([^'"\n]+)['"]""",
    re.M,
)
REQUIRE_RE = re.compile(r"""\brequire\(\s*['"]([^'"\n]+)['"]\s*\)""")
# Webpack magic comments can come before the specifier.
DYNAMIC_IMPORT_RE = re.compile(
    r"""\bimport\(\s*(?:/\*(?:[^*]|\*(?!/))*\*/\s*)*(['"`])([^'"`\n]+)\1\s*\)"""
)
# Workspace packages resolve through node_modules links, and @sentry/scraps
# through an rsbuild alias that falls back to the app's core components.
MODULE_ALIASES: list[tuple[str, tuple[str, ...]]] = [
    ("sentry", ("static/app",)),
    ("getsentry", ("static/gsApp",)),
    ("admin", ("static/gsAdmin",)),
    ("@sentry/scraps", ("static/packages/scraps/src", "static/app/components/core")),
    ("sentry-images", ("static/images",)),
    ("getsentry-images", ("static/images",)),
]
PAGE_OBJECT_RE = re.compile(r"^fixtures/page_objects/(\w+)\.py$")


def _load_backend_full_suite_triggers() -> list[str | re.Pattern[str]]:
    # Files that only run while Django starts up have no per-test coverage in
    # acceptance runs either, so they share the backend's list.
    path = Path(__file__).parent / "compute-sentry-selected-tests.py"
    spec = importlib.util.spec_from_file_location("compute_sentry_selected_tests", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.FULL_SUITE_TRIGGERS


def _matches(path: str, trigger: str | re.Pattern[str]) -> bool:
    if isinstance(trigger, re.Pattern):
        return trigger.search(path) is not None
    return path == trigger


class FrontendGraph:
    """Import graph of the frontend, built with regexes over static/."""

    def __init__(self, repo_root: Path) -> None:
        self.root = repo_root
        static = repo_root / "static"
        self.files = {
            p.relative_to(repo_root).as_posix()
            for p in static.rglob("*")
            if p.suffix in FRONTEND_EXTENSIONS and "node_modules" not in p.parts and p.is_file()
        }
        self.static_edges: dict[str, set[str]] = {}
        self.dynamic_edges: dict[str, set[str]] = {}
        for f in self.files:
            text = (repo_root / f).read_text(encoding="utf-8", errors="ignore")
            static_specs = [m.group(1) for m in STATIC_IMPORT_RE.finditer(text)]
            static_specs += [m.group(1) for m in REQUIRE_RE.finditer(text)]
            self.static_edges[f] = self._resolve_all(static_specs, f)
            dynamic: set[str] = set()
            for m in DYNAMIC_IMPORT_RE.finditer(text):
                spec = m.group(2)
                if m.group(1) == "`" and "${" in spec:
                    dynamic.update(self.resolve_template(spec, f))
                elif (resolved := self.resolve(spec, f)) is not None:
                    dynamic.add(resolved)
            self.dynamic_edges[f] = dynamic

    def _resolve_all(self, specs: Iterable[str], importer: str) -> set[str]:
        resolved = (self.resolve(s, importer) for s in specs)
        return {r for r in resolved if r is not None}

    def _candidates(self, spec: str, importer: str) -> list[str]:
        """Repo-relative paths an import specifier can refer to, without extensions."""
        if spec.startswith("."):
            return [os.path.normpath(os.path.join(os.path.dirname(importer), spec))]
        for alias, directory in MODULE_ALIASES:
            if spec == alias or spec.startswith(alias + "/"):
                rest = spec.removeprefix(alias).lstrip("/")
                return [os.path.normpath(f"{d}/{rest}") for d in directory]
        return []

    def resolve(self, spec: str, importer: str) -> str | None:
        """Map an import specifier to a repo-relative file, or a package directory."""
        if m := WORKSPACE_PACKAGE_RE.match(spec):
            # Exports point at built output, so the package is one node.
            return f"static/packages/{m.group(1)}/"
        for candidate in self._candidates(spec, importer):
            if candidate in self.files or (self.root / candidate).is_file():
                return candidate
            for ext in FRONTEND_EXTENSIONS:
                if candidate + ext in self.files:
                    return candidate + ext
            for ext in FRONTEND_EXTENSIONS:
                if f"{candidate}/index{ext}" in self.files:
                    return f"{candidate}/index{ext}"
        return None

    def resolve_template(self, spec: str, importer: str) -> set[str]:
        """Files a template literal import such as `sentry/docs/${name}` can load."""
        prefix = spec.split("${", 1)[0]
        directory = prefix if prefix.endswith("/") else os.path.dirname(prefix) + "/"
        found: set[str] = set()
        for candidate in self._candidates(directory, importer):
            found.update(f for f in self.files if f.startswith(candidate.rstrip("/") + "/"))
        return found

    def closure(
        self,
        roots: Iterable[str],
        follow_dynamic: Callable[[str], bool],
        stop: Callable[[str], bool] = lambda _: False,
    ) -> set[str]:
        seen: set[str] = set()
        stack = list(roots)
        while stack:
            node = stack.pop()
            if node in seen or stop(node):
                continue
            seen.add(node)
            stack.extend(self.static_edges.get(node, ()))
            if follow_dynamic(node):
                stack.extend(self.dynamic_edges.get(node, ()))
        return seen

    def files_under(self, prefixes: Iterable[str]) -> list[str]:
        prefixes = tuple(prefixes)
        return sorted(f for f in self.files if f.startswith(prefixes))


def _graph_node(path: str) -> str:
    if m := re.match(r"^static/packages/(icons|api|search-syntax)/", path):
        return f"static/packages/{m.group(1)}/"
    return path


@dataclass
class Selection:
    full_suite_reasons: list[str] = field(default_factory=list)
    tests: set[str] = field(default_factory=set)
    log: list[str] = field(default_factory=list)

    def run_everything(self, reason: str) -> None:
        self.full_suite_reasons.append(reason)

    @property
    def full_suite(self) -> bool:
        return bool(self.full_suite_reasons)


def _acceptance_test_files(repo_root: Path) -> list[str]:
    return sorted(
        p.relative_to(repo_root).as_posix() for p in (repo_root / ACCEPTANCE_DIR).rglob("test_*.py")
    )


def _query_coverage(coverage_db: Path, source_files: list[str]) -> dict[str, set[str]]:
    """Acceptance test files whose recorded coverage includes each source file."""
    conn = sqlite3.connect(coverage_db)
    try:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not {"file", "context", "line_bits"} <= tables:
            raise ValueError("coverage database has no per-test contexts")
        found: dict[str, set[str]] = {}
        for source in source_files:
            rows = conn.execute(
                """
                SELECT c.context, lb.numbits
                FROM line_bits lb
                JOIN file f ON lb.file_id = f.id
                JOIN context c ON lb.context_id = c.id
                WHERE (f.path = ? OR f.path LIKE ?) AND c.context LIKE ?
                """,
                (source, f"%/{source}", f"{ACCEPTANCE_DIR}%"),
            )
            found[source] = {
                context.split("::", 1)[0] for context, numbits in rows if any(bytes(numbits))
            }
    finally:
        conn.close()
    return found


def select_tests(changed: list[str], repo_root: Path, coverage_db: Path | None) -> Selection:
    selection = Selection()
    if not changed:
        selection.run_everything("the list of changed files is empty")
        return selection

    all_tests = _acceptance_test_files(repo_root)
    full_triggers = FULL_SUITE_TRIGGERS + _load_backend_full_suite_triggers()

    python_sources: list[str] = []
    frontend_files: list[str] = []
    for f in changed:
        if any(_matches(f, t) for t in FULL_SUITE_TRIGGERS):
            selection.run_everything(f"{f} changes how the suite is built or run")
        elif f in all_tests:
            selection.tests.add(f)
        elif f.startswith(ACCEPTANCE_DIR):
            if (repo_root / f).exists():
                selection.run_everything(f"{f} is an acceptance helper that tests may share")
        elif m := PAGE_OBJECT_RE.match(f):
            importers = _page_object_importers(repo_root, m.group(1), all_tests)
            selection.log.append(f"{f} -> {len(importers)} test file(s) importing it")
            selection.tests.update(importers)
        elif any(p.search(f) for p in IGNORED):
            continue
        elif any(_matches(f, t) for t in full_triggers):
            selection.run_everything(f"{f} runs at startup, so coverage can't map it")
        elif f.startswith("src/") and f.endswith(".py"):
            python_sources.append(f)
        elif f.startswith("static/"):
            frontend_files.append(f)
        else:
            selection.run_everything(f"{f} isn't known to the selector")

    if python_sources:
        _select_python(selection, python_sources, coverage_db)
    if frontend_files and not selection.full_suite:
        _select_frontend(selection, frontend_files, all_tests, FrontendGraph(repo_root))
    # Coverage can name tests that have since been deleted.
    selection.tests.intersection_update(all_tests)
    return selection


def _page_object_importers(repo_root: Path, name: str, all_tests: list[str]) -> set[str]:
    pattern = re.compile(rf"\bfixtures\.page_objects\.{re.escape(name)}\b")
    return {
        t
        for t in all_tests
        if pattern.search((repo_root / t).read_text(encoding="utf-8", errors="ignore"))
    }


def _select_python(selection: Selection, sources: list[str], coverage_db: Path | None) -> None:
    if coverage_db is None:
        selection.run_everything("Python changed and there is no acceptance coverage to map it")
        return
    try:
        covered = _query_coverage(coverage_db, sources)
    except (sqlite3.Error, ValueError) as e:
        selection.run_everything(f"the acceptance coverage database can't be read: {e}")
        return
    for source, tests in sorted(covered.items()):
        selection.log.append(f"{source} -> {len(tests)} test file(s) via coverage")
        selection.tests.update(tests)


def _outside_router(path: str) -> bool:
    return not path.startswith(ROUTER_PREFIX)


def _select_frontend(
    selection: Selection, changed: list[str], all_tests: list[str], graph: FrontendGraph
) -> None:
    reachable = graph.closure(FRONTEND_ENTRIES, lambda _: True)
    shell = graph.closure(
        graph.files_under(SHELL_ROOTS),
        lambda f: f.startswith(SHELL_DYNAMIC_IMPORTERS),
        stop=lambda f: PAGE_AREAS.match(f) is not None,
    )
    page_closures = {
        test: graph.closure(graph.files_under(TEST_PAGES[test]), _outside_router)
        for test in all_tests
        if test in TEST_PAGES
    }
    unmapped = [t for t in all_tests if t not in TEST_PAGES]

    for f in changed:
        node = _graph_node(f)
        if node in shell:
            selection.run_everything(f"{f} is part of the app shell that every page loads")
            return
        if node not in reachable:
            if node == f and (graph.root / f).exists() and not f.endswith(FRONTEND_EXTENSIONS):
                selection.run_everything(f"{f} isn't imported by the app, so we can't map it")
                return
            # Deleted files, and code nothing imports: their importers changed too.
            selection.log.append(f"{f} -> not part of the acceptance build")
            continue
        tests = {test for test, files in page_closures.items() if node in files}
        tests.update(unmapped)
        selection.log.append(f"{f} -> {len(tests)} test file(s) via imports")
        selection.tests.update(tests)


def shard_plan(test_items: int) -> tuple[int, list[int]]:
    count = min(MAX_SHARDS, math.ceil(test_items / TESTS_PER_SHARD))
    return count, list(range(count))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--changed-files", required=True, help="Space-separated changed files")
    parser.add_argument(
        "--previous-filenames",
        default="",
        help="Space-separated old names of renamed files",
    )
    parser.add_argument("--coverage-db", help="Coverage database from a full acceptance run")
    parser.add_argument("--output", required=True, help="Where to write the selected test files")
    parser.add_argument("--github-output", action="store_true", help="Write to $GITHUB_OUTPUT")
    args = parser.parse_args()

    repo_root = Path.cwd()
    changed = args.changed_files.split() + args.previous_filenames.split()
    coverage_db = Path(args.coverage_db) if args.coverage_db else None
    if coverage_db is not None and not coverage_db.is_file():
        print(f"No acceptance coverage at {coverage_db}")
        coverage_db = None

    selection = select_tests(changed, repo_root, coverage_db)
    for line in selection.log:
        print(f"  {line}")

    outputs: dict[str, str] = {}
    if selection.full_suite:
        print("Running the full acceptance suite:")
        for reason in selection.full_suite_reasons:
            print(f"  {reason}")
        outputs["selected"] = "false"
    else:
        tests = sorted(selection.tests)
        items = sum(count_tests_in_file(repo_root / t) for t in tests)
        shard_count, shard_indices = shard_plan(items)
        print(f"Selected {len(tests)} test files ({items} tests) on {shard_count} shard(s):")
        for t in tests:
            print(f"  {t}")
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text("".join(f"{t}\n" for t in tests))
        outputs.update(
            {
                "selected": "true",
                "test-count": str(items),
                "shard-count": str(shard_count),
                "shard-indices": json.dumps(shard_indices),
            }
        )

    github_output = os.environ.get("GITHUB_OUTPUT")
    if args.github_output and github_output:
        with open(github_output, "a") as f:
            f.writelines(f"{k}={v}\n" for k, v in outputs.items())
    return 0


if __name__ == "__main__":
    sys.exit(main())

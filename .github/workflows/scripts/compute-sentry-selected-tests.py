#!/usr/bin/env python3
"""Compute which sentry tests to run based on coverage data and changed files.

Uses getsentry's combined coverage DB (downloaded from GCS) to map changed
source files to affected test files. Only outputs sentry tests.

The coverage DB stores sentry paths with a ../sentry/ prefix (relative to
getsentry rootdir). This script handles the translation.

Usage:
    python3 compute-sentry-selected-tests.py \
        --coverage-db .coverage.combined \
        --changed-files "src/sentry/models/organization.py tests/sentry/test_org.py"
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
from pathlib import Path

from count_test_items import count_tests_in_file
from find_test_imports import find_test_imports
from selected_tests_common import PYTHON_FULL_SUITE_TRIGGERS, covering_contexts, matches_trigger

# -- Path conventions --
# The coverage DB stores paths relative to the getsentry rootdir:
#   sentry sources: ../sentry/src/sentry/...
#   sentry tests:   ../sentry/tests/...
DB_PREFIX = "../sentry/"
DB_TEST_PREFIX = "../sentry/tests/"

# Known sentry test directory names.
TEST_DIRS = (
    "tests/apigw/",
    "tests/sentry/",
    "tests/snuba/",
    "tests/relay_integration/",
    "tests/symbolicator/",
    "tests/social_auth/",
    "tests/sentry_plugins/",
    "tests/integration/",
)

# In selected_tests_common.py because the acceptance selector uses them too.
FULL_SUITE_TRIGGERS: list[str | re.Pattern[str]] = PYTHON_FULL_SUITE_TRIGGERS

EXCLUDED_TEST_FILES: set[str] = {
    "tests/sentry/test_wsgi.py",
}

EXTRA_FILE_TO_TEST_MAPPING: dict[str, list[str]] = {
    ".github/CODEOWNERS": ["tests/sentry/api/test_api_owners.py"],
    "static/app/data/controlsiloUrlPatterns.ts": [
        "tests/sentry/management/commands/test_generate_controlsilo_urls.py"
    ],
    # JSON/binary files not tracked by coverage DB
    "src/sentry/issues/event.schema.json": ["tests/sentry/issues/test_json_schemas.py"],
    "fixtures/test.mmdb": ["tests/sentry/utils/test_geo.py"],
    # Backup/restore golden fixtures — coverage won't see non-Python files
    "fixtures/backup/fresh-install.json": ["tests/sentry/backup/test_imports.py"],
    "fixtures/backup/user-with-minimum-privileges.json": ["tests/sentry/backup/test_rpc.py"],
    "fixtures/backup/single-integration.json": ["tests/sentry/backup/test_validate.py"],
    "fixtures/backup/single-option.json": ["tests/sentry/backup/test_validate.py"],
}

# Like EXTRA_FILE_TO_TEST_MAPPING but keys are directory prefixes: any changed file
# whose path starts with the prefix will trigger the listed tests.
EXTRA_DIR_TO_TEST_MAPPING: dict[str, list[str]] = {
    # 74 parametrized JSON fixtures loaded via os.listdir(); coverage won't see them
    "fixtures/search-syntax/": ["tests/sentry/api/test_event_search.py"],
}

EXCLUDED_TEST_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^tests/(acceptance|apidocs|js|tools)/"),
]

# Tests that should always be run even if not explicitly selected.
ALWAYS_RUN_TESTS: set[str] = {
    "tests/sentry/taskworker/test_config.py",
    "tests/sentry/management/commands/test_generate_controlsilo_urls.py",
    # apigw must stay in sync with sentry (url -> silo mapping, model queries),
    # so any backend change can affect these. Coverage can't attribute the
    # routing test to source files: both the django url conf and the apigw
    # routing table are built at import time, before any per-test coverage
    # context is active.
    "tests/apigw/test_db.py",
    "tests/apigw/test_routing.py",
    # Both of these tests check global codebase invariants via runtime discovery —
    # the same reason the apigw tests above are always run. Coverage can't attribute
    # them to individual source files because the discovery happens at startup,
    # before per-test coverage contexts are active:
    #   test_base.py: walks all endpoint subclasses to check for silo decorators
    #   test_validate.py: walks the Django ORM registry (get_exportable_sentry_models)
    #     to assign comparators — __relocation_scope__ changes on any model are invisible
    "tests/sentry/silo/test_base.py",
    "tests/sentry/backup/test_validate.py",
    # Freezes option registrations, which happen at import time anywhere in src/.
    "tests/sentry/options/test_legacy_options.py",
    # Counts request.user patterns by parsing every file in src/ with ast, so it
    # reads source without executing it and coverage never links it to a change.
    "tests/sentry/auth/test_principal.py",
    # Finds SentryAPIException subclasses via __subclasses__() at collection time and
    # parses each __init__ with inspect.getsource + ast, so an exception edited in any
    # module never runs under this test's coverage context.
    "tests/sentry/apidocs/test_error_codes.py",
}

# Seer public-API matrix discovers published mutations at collection time, so
# endpoint module edits (including publish_status flips) need an explicit include.
PUBLIC_API_MATRIX_TEST = "tests/sentry/seer/endpoints/test_organization_agent_token.py"
PUBLIC_API_MATRIX_PATH_TRIGGERS: list[re.Pattern[str]] = [
    # Endpoint modules live under */endpoints/ across product areas.
    re.compile(r"^src/sentry/.*/endpoints/.*\.py$"),
]


def _is_test(path: str) -> bool:
    return any(path.startswith(d) for d in TEST_DIRS)


def _changed_files_match_public_api_matrix_paths(changed_files: list[str]) -> list[str]:
    return [
        f
        for f in changed_files
        if any(matches_trigger(f, t) for t in PUBLIC_API_MATRIX_PATH_TRIGGERS)
    ]


def _query_coverage(coverage_db_path: str, db_file_paths: list[str]) -> set[str]:
    """Query coverage DB for test contexts covering the given source files."""
    covered = covering_contexts(coverage_db_path, db_file_paths)
    test_contexts: set[str] = set()
    for file_path in db_file_paths:
        contexts = covered.get(file_path)
        if contexts is None:
            print(f"  No coverage data for: {file_path}")
        elif contexts:
            print(f"  {file_path} -> {len(contexts)} test context(s)")
            test_contexts.update(contexts)

    # Extract sentry test file paths from contexts.
    # DB context format: '../sentry/tests/sentry/foo.py::Class::test|run'
    test_files: set[str] = set()
    for context in test_contexts:
        db_path = context.split("::", 1)[0]
        if db_path.startswith(DB_TEST_PREFIX):
            # ../sentry/tests/sentry/foo.py -> tests/sentry/foo.py
            test_files.add(db_path[len(DB_PREFIX) :])

    return test_files


def _query_test_counts(coverage_db_path: str, test_files: list[str]) -> dict[str, int]:
    """Count distinct test ids per test file, including generated and parametrized tests."""
    wanted = {DB_PREFIX + f: f for f in test_files}
    tests: dict[str, set[str]] = {f: set() for f in test_files}
    conn = sqlite3.connect(coverage_db_path)
    try:
        for (context,) in conn.execute("SELECT context FROM context WHERE context LIKE '%::%'"):
            f = wanted.get(context.split("::", 1)[0])
            if f is not None:
                # Contexts are '<nodeid>|run', '<nodeid>|setup' and '<nodeid>|teardown'.
                tests[f].add(context.rsplit("|", 1)[0])
    finally:
        conn.close()
    return {f: len(ids) for f, ids in tests.items() if ids}


def main() -> int:
    parser = argparse.ArgumentParser(description="Compute selected sentry tests from coverage data")
    parser.add_argument("--coverage-db", required=True, help="Path to coverage SQLite database")
    parser.add_argument(
        "--changed-files",
        required=True,
        help="Space-separated changed files relative to sentry repo root",
    )
    parser.add_argument(
        "--previous-filenames",
        default="",
        help="Space-separated previous filenames for renamed files (queried against coverage DB)",
    )
    parser.add_argument("--output", help="Output file path for selected test files (one per line)")
    parser.add_argument("--github-output", action="store_true", help="Write to GITHUB_OUTPUT")
    args = parser.parse_args()

    coverage_db = Path(args.coverage_db)
    if not coverage_db.exists():
        print(f"Error: Coverage database not found: {coverage_db}", file=sys.stderr)
        return 1

    changed = [f.strip() for f in args.changed_files.split() if f.strip()]
    previous_filenames = [f.strip() for f in args.previous_filenames.split() if f.strip()]

    selective_applied = False

    if not changed:
        print("No changed files provided, running full test suite")
        affected_test_files: set[str] = set()
    else:
        all_paths = changed + previous_filenames
        triggered_by = [
            f for f in all_paths if any(matches_trigger(f, t) for t in FULL_SUITE_TRIGGERS)
        ]
        if triggered_by:
            print(f"Full test suite triggered by: {', '.join(triggered_by)}")
            affected_test_files = set()
        else:
            selective_applied = True

            # Map repo-relative paths to DB format (add ../sentry/ prefix).
            # Include previous filenames for renames so the coverage DB
            # (which still stores the old path) can find the right tests.
            db_paths = [DB_PREFIX + f for f in changed]
            for old_name in previous_filenames:
                db_paths.append(DB_PREFIX + old_name)

            print(f"Computing selected tests for {len(changed)} changed files...")
            try:
                affected_test_files = _query_coverage(str(coverage_db), db_paths)
            except sqlite3.Error as e:
                print(f"Error querying coverage database: {e}", file=sys.stderr)
                return 1

            # Union with static import search so files invisible to coverage are still caught.
            changed_source_files = [f for f in changed if not _is_test(f) and f.endswith(".py")]
            if changed_source_files:
                static_tests = find_test_imports(changed_source_files, Path.cwd())
                static_tests = {
                    f
                    for f in static_tests
                    if _is_test(f) and not any(p.search(f) for p in EXCLUDED_TEST_PATTERNS)
                }
                affected_test_files.update(static_tests)

            affected_test_files -= EXCLUDED_TEST_FILES

            # Extra mapped files
            for f in changed:
                affected_test_files.update(EXTRA_FILE_TO_TEST_MAPPING.get(f, []))
                for prefix, tests in EXTRA_DIR_TO_TEST_MAPPING.items():
                    if f.startswith(prefix):
                        affected_test_files.update(tests)

            # Directly changed test files
            changed_tests = {
                f
                for f in changed
                if f.startswith("tests/")
                and f.endswith(".py")
                and not any(p.search(f) for p in EXCLUDED_TEST_PATTERNS)
            }
            existing_changed = {f for f in changed_tests if Path(f).exists()}
            if existing_changed:
                print(f"Including {len(existing_changed)} directly changed test files")
                affected_test_files.update(existing_changed)

            # Always run these tests
            affected_test_files.update(ALWAYS_RUN_TESTS)

            endpoint_sources = _changed_files_match_public_api_matrix_paths(changed)
            if endpoint_sources:
                print(
                    "Including public API matrix test due to endpoint path(s): "
                    + ", ".join(endpoint_sources)
                )
                affected_test_files.add(PUBLIC_API_MATRIX_TEST)

    # Filter to sentry tests only (drop any getsentry tests from coverage)
    affected_test_files = {f for f in affected_test_files if _is_test(f)}

    # Filter out deleted test files
    existing_files = {f for f in affected_test_files if Path(f).exists()}
    deleted_files = affected_test_files - existing_files
    if deleted_files:
        print(
            f"Excluding {len(deleted_files)} deleted test file(s): "
            + ", ".join(sorted(deleted_files))
        )
        affected_test_files = existing_files

    output_tests = sorted(affected_test_files)
    if selective_applied or output_tests:
        print(f"Selected {len(output_tests)} test files")

    if args.output and (output_tests or selective_applied):
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w") as f:
            for test_file in output_tests:
                f.write(f"{test_file}\n")
        print(f"Wrote selected tests to {output_path}")

    test_item_count = None
    if output_tests or selective_applied:
        coverage_counts: dict[str, int] = {}
        if output_tests:
            try:
                coverage_counts = _query_test_counts(str(coverage_db), output_tests)
            except sqlite3.Error as e:
                print(
                    f"Warning: could not count tests from coverage database: {e}", file=sys.stderr
                )
        item_counts: dict[str, int] = {}
        for test_file in output_tests:
            ast_count = count_tests_in_file(Path(test_file))
            coverage_count = coverage_counts.get(test_file, 0)
            if coverage_count > ast_count:
                print(f"  {test_file}: {coverage_count} tests in coverage DB, {ast_count} via AST")
            item_counts[test_file] = max(ast_count, coverage_count)
        test_item_count = sum(item_counts.values())
        print(f"Estimated {test_item_count} test items")

        if args.output:
            # pytest-selected.py balances shards with these.
            Path(args.output).with_suffix(".counts.json").write_text(json.dumps(item_counts))

    if args.github_output:
        github_output = os.environ.get("GITHUB_OUTPUT")
        if github_output:
            has_selected = bool(output_tests) or selective_applied
            with open(github_output, "a") as f:
                f.write(f"test-count={len(output_tests)}\n")
                if test_item_count is not None:
                    f.write(f"test-item-count={test_item_count}\n")
                f.write(f"has-selected-tests={'true' if has_selected else 'false'}\n")
            if has_selected:
                print(f"Wrote to GITHUB_OUTPUT: test-count={len(output_tests)}")

    for test_file in output_tests:
        print(f"  {test_file}")

    return 0


if __name__ == "__main__":
    sys.exit(main())

from __future__ import annotations

import ast
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import int, Any

# Allowlist of files (relative to repo root) that may still use legacy method
# create_or_update. Instead, use Django's update_or_create.
# Reduce over time as code is refactored. DO NOT add new files here.
ALLOWLIST_FILES: set[str] = {
    "src/sentry/buffer/base.py",
    "src/sentry/db/models/manager/base.py",
    "src/sentry/notifications/services/impl.py",
    "src/sentry/nodestore/django/backend.py",
    "src/sentry/issues/ignored.py",
    "src/sentry/issues/endpoints/organization_group_search_view_visit.py",
    "src/sentry/api/helpers/group_index/update.py",
    "src/sentry/api/endpoints/organization_pinned_searches.py",
    "src/sentry/api/endpoints/project_template_detail.py",
    "src/sentry/releases/endpoints/release_deploys.py",
    "src/sentry/api/endpoints/organization_unsubscribe.py",
    "src/sentry/api/endpoints/organization_recent_searches.py",
    "src/sentry/api/endpoints/prompts_activity.py",
    "src/sentry/dashboards/endpoints/organization_dashboard_details.py",
    "src/sentry/onboarding_tasks/backends/organization_onboarding_task.py",
    "src/sentry/explore/endpoints/explore_saved_query_detail.py",
    "src/sentry/models/featureadoption.py",
    "src/sentry/models/groupmeta.py",
    "src/sentry/models/release.py",
    "src/sentry/models/releases/set_commits.py",
    "src/sentry/models/options/organization_option.py",
    "src/sentry/models/options/project_template_option.py",
    "src/sentry/audit_log/services/log/impl.py",
    "src/sentry/utils/mockdata/core.py",
    "src/sentry/core/endpoints/organization_details.py",
    "src/sentry/flags/endpoints/secrets.py",
    "src/sentry/tasks/assemble.py",
    "src/sentry/tasks/commits.py",
    "src/sentry/services/nodestore/django/backend.py",
}


@dataclass
class Usage:
    file_path: str
    line: int
    col: int
    qualified_context: str


class CreateOrUpdateVisitor(ast.NodeVisitor):
    def __init__(self, module_qualname: str) -> None:
        self.module_qualname = module_qualname
        self.context_stack: list[str] = []
        self.usages: list[Usage] = []

    def visit_ClassDef(self, node: ast.ClassDef) -> Any:
        self.context_stack.append(node.name)
        self.generic_visit(node)
        self.context_stack.pop()

    def visit_FunctionDef(self, node: ast.FunctionDef) -> Any:
        self.context_stack.append(node.name)
        self.generic_visit(node)
        self.context_stack.pop()

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> Any:
        self.context_stack.append(node.name)
        self.generic_visit(node)
        self.context_stack.pop()

    def visit_Call(self, node: ast.Call) -> Any:
        func = node.func
        is_create_or_update = False
        if isinstance(func, ast.Name):
            is_create_or_update = func.id == "create_or_update"
        elif isinstance(func, ast.Attribute):
            is_create_or_update = func.attr == "create_or_update"

        if is_create_or_update:
            context = ".".join(self.context_stack) if self.context_stack else "<module>"
            qualified = (
                f"{self.module_qualname}.{context}"
                if context != "<module>"
                else self.module_qualname
            )
            # file_path is filled in by the scanner
            self.usages.append(
                Usage(
                    file_path="",
                    line=node.lineno,
                    col=getattr(node, "col_offset", 0),
                    qualified_context=qualified,
                )
            )

        self.generic_visit(node)


def _iter_python_files(root: Path) -> Iterable[Path]:
    yield from root.rglob("*.py")


def _module_qualname_from_path(repo_root: Path, file_path: Path) -> str:
    rel = file_path.relative_to(repo_root)
    # strip .py and convert / to .
    parts = list(rel.parts)
    # remove trailing .py
    parts[-1] = parts[-1][:-3]
    return ".".join(parts)


def _scan_create_or_update(repo_root: Path, src_root: Path) -> list[Usage]:
    results: list[Usage] = []
    for file_path in _iter_python_files(src_root):
        text = file_path.read_text(encoding="utf-8")
        try:
            tree = ast.parse(text)
        except SyntaxError:
            # Ignore unparsable files (should not happen under src/)
            continue

        module_qualname = _module_qualname_from_path(repo_root, file_path)
        visitor = CreateOrUpdateVisitor(module_qualname)
        visitor.visit(tree)
        rel_path = str(file_path.relative_to(repo_root))
        for u in visitor.usages:
            # fill file path for each usage
            u.file_path = rel_path
        results.extend(visitor.usages)
    return results


def test_no_new_create_or_update_usage() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    src_root = repo_root / "src"

    usages = _scan_create_or_update(repo_root=repo_root, src_root=src_root)

    violations: list[str] = []
    for u in usages:
        file_allowed = u.file_path in ALLOWLIST_FILES
        if not file_allowed:
            violations.append(
                f"{u.file_path}:{u.line}:{u.col}: create_or_update used in {u.qualified_context}. "
                f"Use Django's update_or_create instead."
            )

    if violations:
        header = (
            "Found disallowed uses of create_or_update. New code must use Django's update_or_create.\n"
            "See Django docs: https://docs.djangoproject.com/en/5.2/ref/models/querysets/#update-or-create\n"
            "If this is legacy code, add the specific function or file to the allowlist in "
            "tests/sentry/test_no_create_or_update_usage.py and plan its refactor.\n\n"
        )
        detail = "\n".join(sorted(violations))
        raise AssertionError(header + detail)

from __future__ import annotations

import ast
from collections.abc import Generator
from typing import Any

S001_fmt = (
    "S001 Avoid using the {} mock call as it is "
    "confusing and prone to causing invalid test "
    "behavior."
)
S001_methods = frozenset(("not_called", "called_once", "called_once_with"))

S002_msg = "S002 print functions or statements are not allowed."

S003_msg = "S003 Use ``from sentry.utils import json`` instead."
S003_modules = frozenset(("json", "simplejson"))

S004_msg = "S004 Use `pytest.raises` instead for better debuggability."
S004_methods = frozenset(("assertRaises", "assertRaisesRegex"))

S005_msg = "S005 Do not import models from sentry.models but the actual module"

S006_msg = "S006 Do not use force_bytes / force_str -- test the types directly"

S007_msg = "S007 Do not import sentry.testutils into production code."

S008_msg = "S008 Use datetime.fromisoformat rather than guessing at date formats"

S009_msg = "S009 Use `raise` with no arguments to reraise exceptions"

S010_msg = "S010 Except handler does nothing and should be removed"

S011_msg = "S011 Use override_options(...) instead to ensure proper cleanup"

S012_msg = "S012 Use ``from sentry.api.permissions import SentryIsAuthenticated`` instead"


class SentryVisitor(ast.NodeVisitor):
    def __init__(self, filename: str) -> None:
        self.errors: list[tuple[int, int, str]] = []
        self.filename = filename

        self._except_vars: list[str | None] = []

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module and not node.level:
            if node.module.split(".")[0] in S003_modules:
                self.errors.append((node.lineno, node.col_offset, S003_msg))
            elif node.module == "sentry.models":
                self.errors.append((node.lineno, node.col_offset, S005_msg))
            elif (
                ("tests/" in self.filename or "testutils/" in self.filename)
                and node.module == "django.utils.encoding"
                and any(x.name in {"force_bytes", "force_str"} for x in node.names)
            ):
                self.errors.append((node.lineno, node.col_offset, S006_msg))
            elif (
                "tests/" in self.filename or "testutils/" in self.filename
            ) and node.module == "dateutil.parser":
                self.errors.append((node.lineno, node.col_offset, S008_msg))
            elif (
                "tests/" not in self.filename
                and "fixtures/" not in self.filename
                and "sentry/testutils/" not in self.filename
                and "sentry.testutils" in node.module
            ):
                self.errors.append((node.lineno, node.col_offset, S007_msg))
            elif node.module == "rest_framework.permissions" and any(
                x.name == "IsAuthenticated" for x in node.names
            ):
                self.errors.append((node.lineno, node.col_offset, S012_msg))

        self.generic_visit(node)

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            if alias.name.split(".")[0] in S003_modules:
                self.errors.append((node.lineno, node.col_offset, S003_msg))
            elif (
                "tests/" not in self.filename
                and "fixtures/" not in self.filename
                and "sentry/testutils/" not in self.filename
                and "sentry.testutils" in alias.name
            ):
                self.errors.append((node.lineno, node.col_offset, S007_msg))

        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if node.attr in S001_methods:
            self.errors.append((node.lineno, node.col_offset, S001_fmt.format(node.attr)))
        elif node.attr in S004_methods:
            self.errors.append((node.lineno, node.col_offset, S004_msg))

        self.generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        if node.id == "print":
            self.errors.append((node.lineno, node.col_offset, S002_msg))

        self.generic_visit(node)

    def visit_ExceptHandler(self, node: ast.ExceptHandler) -> None:
        self._except_vars.append(node.name)
        try:
            self.generic_visit(node)
        finally:
            self._except_vars.pop()

    def visit_Raise(self, node: ast.Raise) -> None:
        if (
            self._except_vars
            and isinstance(node.exc, ast.Name)
            and node.exc.id == self._except_vars[-1]
        ):
            self.errors.append((node.lineno, node.col_offset, S009_msg))
        self.generic_visit(node)

    def visit_Try(self, node: ast.Try) -> None:
        if (
            node.handlers
            and len(node.handlers[-1].body) == 1
            and isinstance(node.handlers[-1].body[0], ast.Raise)
            and node.handlers[-1].body[0].exc is None
        ):
            self.errors.append((node.handlers[-1].lineno, node.handlers[-1].col_offset, S010_msg))

        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        if (
            # override_settings(...)
            (isinstance(node.func, ast.Name) and node.func.id == "override_settings")
            or
            # self.settings(...)
            (
                isinstance(node.func, ast.Attribute)
                and isinstance(node.func.value, ast.Name)
                and node.func.value.id == "self"
                and node.func.attr == "settings"
            )
        ):
            for keyword in node.keywords:
                if keyword.arg == "SENTRY_OPTIONS":
                    self.errors.append((keyword.lineno, keyword.col_offset, S011_msg))

        self.generic_visit(node)


class SentryCheck:
    def __init__(self, tree: ast.AST, filename: str) -> None:
        self.tree = tree
        self.filename = filename

    def run(self) -> Generator[tuple[int, int, str, type[Any]]]:
        visitor = SentryVisitor(self.filename)
        visitor.visit(self.tree)

        for e in visitor.errors:
            yield (*e, type(self))

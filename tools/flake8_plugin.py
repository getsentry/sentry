from __future__ import annotations

import ast
from typing import Any, Generator

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

S008_msg = "S008 Use stdlib datetime.timezone.utc instead of pytz.utc / pytz.UTC"


class SentryVisitor(ast.NodeVisitor):
    def __init__(self, filename: str) -> None:
        self.errors: list[tuple[int, int, str]] = []
        self.filename = filename

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module and not node.level:
            if node.module.split(".")[0] in S003_modules:
                self.errors.append((node.lineno, node.col_offset, S003_msg))
            elif node.module == "sentry.models":
                self.errors.append((node.lineno, node.col_offset, S005_msg))
            elif (
                "tests/" in self.filename
                and node.module == "django.utils.encoding"
                and any(x.name in {"force_bytes", "force_str"} for x in node.names)
            ):
                self.errors.append((node.lineno, node.col_offset, S006_msg))
            elif (
                "tests/" not in self.filename
                and "fixtures/" not in self.filename
                and "sentry/testutils/" not in self.filename
                and "sentry.testutils" in node.module
            ):
                self.errors.append((node.lineno, node.col_offset, S007_msg))

            if node.module == "pytz" and any(x.name.lower() == "utc" for x in node.names):
                self.errors.append((node.lineno, node.col_offset, S008_msg))

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
        elif (
            isinstance(node.value, ast.Name)
            and node.value.id == "pytz"
            and node.attr.lower() == "utc"
        ):
            self.errors.append((node.lineno, node.col_offset, S008_msg))

        self.generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        if node.id == "print":
            self.errors.append((node.lineno, node.col_offset, S002_msg))

        self.generic_visit(node)


class SentryCheck:
    def __init__(self, tree: ast.AST, filename: str) -> None:
        self.tree = tree
        self.filename = filename

    def run(self) -> Generator[tuple[int, int, str, type[Any]], None, None]:
        visitor = SentryVisitor(self.filename)
        visitor.visit(self.tree)

        for e in visitor.errors:
            yield (*e, type(self))

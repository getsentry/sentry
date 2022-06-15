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
S003_modules = {"json", "simplejson"}


class SentryVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.errors: list[tuple[int, int, str]] = []

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module and not node.level and node.module.split(".")[0] in S003_modules:
            self.errors.append((node.lineno, node.col_offset, S003_msg))

        self.generic_visit(node)

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            if alias.name.split(".")[0] in S003_modules:
                self.errors.append((node.lineno, node.col_offset, S003_msg))

        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if node.attr in S001_methods:
            self.errors.append((node.lineno, node.col_offset, S001_fmt.format(node.attr)))

        self.generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        if node.id == "print":
            self.errors.append((node.lineno, node.col_offset, S002_msg))

        self.generic_visit(node)


class SentryCheck:
    name = "sentry-flake8"
    version = "0"

    def __init__(self, tree: ast.AST) -> None:
        self.tree = tree

    def run(self) -> Generator[tuple[int, int, str, type[Any]], None, None]:
        visitor = SentryVisitor()
        visitor.visit(self.tree)

        for e in visitor.errors:
            yield (*e, type(self))

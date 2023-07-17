from __future__ import annotations

import ast
from typing import Any, Generator, List

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

S006_methods = frozenset(
    (
        "django.db.transaction.atomic",
        "django.db.transaction.get_connection",
        "sentry.utils.db.atomic_transaction",
    )
)
S006_msg = "S006 Always specify a using= argument to transactions and connections"


class SentryVisitor(ast.NodeVisitor):
    def __init__(self, filename: str) -> None:
        self.errors: list[tuple[int, int, str]] = []
        self.filename = filename
        self.names_stack: List[dict[str, str]] = [{}]

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module and not node.level:
            if node.module.split(".")[0] in S003_modules:
                self.errors.append((node.lineno, node.col_offset, S003_msg))
            # for now only enforce this in getsentry
            elif (
                "getsentry/" in self.filename
                and node.module == "sentry.models"
                and any(x.name.isupper() or x.name.istitle() for x in node.names)
            ):
                self.errors.append((node.lineno, node.col_offset, S005_msg))

            for name in node.names:
                self.names_stack[-1][name.asname or name.name] = f"{node.module}.{name.name}"

        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> Any:
        self.names_stack.append(dict(**self.names_stack[-1]))
        self.generic_visit(node)
        self.names_stack.pop()

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            if alias.name.split(".")[0] in S003_modules:
                self.errors.append((node.lineno, node.col_offset, S003_msg))

        for name in node.names:
            self.names_stack[-1][name.asname or name.name] = name.name

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

    def visit_Call(self, node: ast.Call) -> None:
        name_list: List[str] = []
        func = node.func
        while isinstance(func, ast.Attribute):
            name_list.append(func.attr)
            func = func.value
        if not isinstance(func, ast.Name):
            return
        name_list.append(func.id)
        name_list.reverse()

        name = ""
        for part in name_list:
            name = part if not name else f"{name}.{part}"
            name = self.names_stack[-1].get(name, name)

        if name in S006_methods:
            if len(node.args) == 0 and not any(k.arg == "using" for k in node.keywords):
                self.errors.append((node.lineno, node.col_offset, S006_msg))

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

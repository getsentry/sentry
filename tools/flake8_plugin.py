import ast
from collections import namedtuple
from functools import partial

import pycodestyle

__version__ = "2.0.0"


# We don't want Python 3 code to have Python 2 compatability futures.
# Refer to Lib/__future__.py in CPython source.
DISALLOWED_FUTURES = (
    "absolute_import",
    "division",
    "print_function",
    "unicode_literals",
)


class SentryVisitor(ast.NodeVisitor):
    NODE_WINDOW_SIZE = 4

    def __init__(self, filename, lines):
        self.errors = []
        self.filename = filename
        self.lines = lines
        self.node_stack = []
        self.node_window = []

    def visit(self, node):
        self.node_stack.append(node)
        self.node_window.append(node)
        self.node_window = self.node_window[-self.NODE_WINDOW_SIZE :]
        super().visit(node)
        self.node_stack.pop()

    def visit_ImportFrom(self, node):
        if node.module == "__future__":
            for nameproxy in node.names:
                if nameproxy.name in DISALLOWED_FUTURES:
                    self.errors.append(S005(node.lineno, node.col_offset))
                    break

        if node.module in S003.modules:
            for nameproxy in node.names:
                if nameproxy.name in S003.names:
                    self.errors.append(S003(node.lineno, node.col_offset))
                    break

    def visit_Import(self, node):
        for alias in node.names:
            if alias.name.split(".", 1)[0] in S003.modules:
                self.errors.append(S003(node.lineno, node.col_offset))

    def visit_Call(self, node):
        if isinstance(node.func, ast.Attribute):
            for bug in (S004,):
                if node.func.attr in bug.methods:
                    call_path = ".".join(self.compose_call_path(node.func.value))
                    if call_path in bug.invalid_paths:
                        self.errors.append(bug(node.lineno, node.col_offset))
                    break
        self.generic_visit(node)

    def visit_Attribute(self, node):
        if node.attr in S001.methods:
            self.errors.append(S001(node.lineno, node.col_offset, vars=(node.attr,)))

    def visit_Name(self, node):
        if node.id == "print":
            self.check_print(node)

    def visit_Print(self, node):
        self.check_print(node)

    def check_print(self, node):
        if not self.filename.startswith("tests/"):
            self.errors.append(S002(lineno=node.lineno, col=node.col_offset))

    def compose_call_path(self, node):
        if isinstance(node, ast.Attribute):
            yield from self.compose_call_path(node.value)
            yield node.attr
        elif isinstance(node, ast.Name):
            yield node.id


class SentryCheck:
    name = "sentry-flake8"
    version = __version__

    def __init__(self, tree=None, filename=None, lines=None, visitor=SentryVisitor):
        self.tree = tree
        self.filename = filename
        self.lines = lines
        self.visitor = visitor

    def run(self):
        if not self.tree or not self.lines:
            self.load_file()

        visitor = self.visitor(filename=self.filename, lines=self.lines)
        visitor.visit(self.tree)

        for e in visitor.errors:
            try:
                if pycodestyle.noqa(self.lines[e.lineno - 1]):
                    continue
            except IndexError:
                pass

            yield self.adapt_error(e)

    def load_file(self):
        """
        Loads the file in a way that auto-detects source encoding and deals
        with broken terminal encodings for stdin.
        Stolen from flake8_import_order because it's good.
        """

        if self.filename in ("stdin", "-", None):
            self.filename = "stdin"
            self.lines = pycodestyle.stdin_get_value().splitlines(True)
        else:
            self.lines = pycodestyle.readlines(self.filename)

        if not self.tree:
            self.tree = ast.parse("".join(self.lines))

    @classmethod
    def adapt_error(cls, e):
        """Adapts the extended error namedtuple to be compatible with Flake8."""
        return e._replace(message=e.message.format(*e.vars))[:4]


error = namedtuple("error", "lineno col message type vars")
Error = partial(partial, error, message="", type=SentryCheck, vars=())

S001 = Error(
    message="S001: Avoid using the {} mock call as it is "
    "confusing and prone to causing invalid test "
    "behavior."
)
S001.methods = {
    "assert_calls",
    "assert_not_called",
    "assert_called",
    "assert_called_once",
    "not_called",
    "called_once",
    "called_once_with",
}

S002 = Error(message="S002: print functions or statements are not allowed.")

S003 = Error(message="S003: Use ``from sentry.utils import json`` instead.")
S003.modules = {"json", "simplejson"}
S003.names = {
    "load",
    "loads",
    "dump",
    "dumps",
    "JSONEncoder",
    "JSONDecodeError",
    "_default_encoder",
}

S004 = Error(
    message="S004: ``cgi.escape`` and ``html.escape`` should not be used. Use "
    "sentry.utils.html.escape instead."
)
S004.methods = {"escape"}
S004.invalid_paths = {"cgi", "html"}

S005 = Error(
    message=f"S005: The following __future__ are not allowed: {', '.join(DISALLOWED_FUTURES)}"
)

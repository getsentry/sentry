import ast
from collections import namedtuple
from functools import partial


class SentryVisitor(ast.NodeVisitor):
    def __init__(self):
        self.errors = []

    def visit_ImportFrom(self, node):
        if node.module in S003.modules:
            for nameproxy in node.names:
                if nameproxy.name in S003.names:
                    self.errors.append(S003(node.lineno, node.col_offset))
                    break

    def visit_Import(self, node):
        for alias in node.names:
            if alias.name.split(".", 1)[0] in S003.modules:
                self.errors.append(S003(node.lineno, node.col_offset))

    def visit_Attribute(self, node):
        if node.attr in S001.methods:
            self.errors.append(S001(node.lineno, node.col_offset, vars=(node.attr,)))

    def visit_Name(self, node):
        if node.id == "print":
            self.errors.append(S002(lineno=node.lineno, col=node.col_offset))


class SentryCheck:
    name = "sentry-flake8"
    version = "0"

    def __init__(self, tree: ast.AST) -> None:
        self.tree = tree

    def run(self):
        visitor = SentryVisitor()
        visitor.visit(self.tree)

        for e in visitor.errors:
            yield self.adapt_error(e)

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

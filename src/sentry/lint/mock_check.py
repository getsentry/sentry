from __future__ import absolute_import

import ast


class MockAttrVisitor(ast.NodeVisitor):
    non_existent_methods = frozenset([
        'assert_calls',
        'assert_not_called',
        'assert_called',
        'assert_called_once',
        'not_called',
        'called_once',
        'called_once_with',
    ])

    def __init__(self):
        self.errors = []

    def visit_Attribute(self, node):
        self.generic_visit(node)
        if node.attr in self.non_existent_methods:
            self.errors.append((node.lineno, node.attr))


class MockCheck(object):
    code = 'C900'
    _error_tmpl = "C900 Mock function call is banned: %s"

    def __init__(self, tree, filename=None):
        self.tree = tree

    def run(self):
        visitor = MockAttrVisitor()
        visitor.visit(self.tree)
        for lineno, attr in visitor.errors:
            text = self._error_tmpl % (attr,)
            yield lineno, 0, text, type(self)

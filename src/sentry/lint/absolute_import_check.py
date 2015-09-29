from __future__ import absolute_import

import ast


class ImportVisitor(ast.NodeVisitor):
    def __init__(self):
        self.has_import = False

    def visit_ImportFrom(self, node):
        if self.has_import:
            return
        if node.module != '__future__':
            return
        for nameproxy in node.names:
            if nameproxy.name != 'absolute_import':
                continue
            self.has_import = True
            break


class AbsoluteImportCheck(object):
    name = 'absolute-import-checker'
    code = 'C901'
    msg = "C901 Missing `from __future__ import absolute_import`"

    def __init__(self, tree, filename=None):
        self.tree = tree

    def run(self):
        visitor = ImportVisitor()
        visitor.visit(self.tree)
        if not visitor.has_import:
            yield 0, 0, self.msg, type(self)

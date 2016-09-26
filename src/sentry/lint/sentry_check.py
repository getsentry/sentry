# coding: utf-8
# The MIT License (MIT)

# Copyright (c) 2016 Sentry
# Copyright (c) 2016 Łukasz Langa

# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

from __future__ import absolute_import

import ast
import pycodestyle

from collections import namedtuple
from functools import partial


class SentryVisitor(ast.NodeVisitor):
    NODE_WINDOW_SIZE = 4

    def __init__(self, filename, lines):
        self.errors = []
        self.filename = filename
        self.lines = lines

        self.has_absolute_import = False
        self.node_stack = []
        self.node_window = []

    def finish(self):
        if not self.has_absolute_import:
            self.errors.append(
                B003(1, 1),
            )

    def visit(self, node):
        self.node_stack.append(node)
        self.node_window.append(node)
        self.node_window = self.node_window[-self.NODE_WINDOW_SIZE:]
        super(SentryVisitor, self).visit(node)
        self.node_stack.pop()

    def visit_ExceptHandler(self, node):
        if node.type is None:
            self.errors.append(
                B001(node.lineno, node.col_offset)
            )
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        if node.module in B307.names:
            self.errors.append(
                B307(node.lineno, node.col_offset)
            )

        if node.module == '__future__':
            for nameproxy in node.names:
                if nameproxy.name == 'absolute_import':
                    self.has_absolute_import = True
                    break

    def visit_Import(self, node):
        for alias in node.names:
            if alias.name.split('.', 1)[0] in B307.names:
                self.errors.append(
                    B307(node.lineno, node.col_offset)
                )

    def visit_Call(self, node):
        if isinstance(node.func, ast.Attribute):
            for bug in (B301, B302, B305):
                if node.func.attr in bug.methods:
                    call_path = '.'.join(self.compose_call_path(node.func.value))
                    if call_path not in bug.valid_paths:
                        self.errors.append(
                            bug(node.lineno, node.col_offset)
                        )
                    break
            for bug in (B312,):
                if node.func.attr in bug.methods:
                    call_path = '.'.join(self.compose_call_path(node.func.value))
                    if call_path in bug.invalid_paths:
                        self.errors.append(
                            bug(node.lineno, node.col_offset)
                        )
                    break
        self.generic_visit(node)

    def visit_Attribute(self, node):
        call_path = list(self.compose_call_path(node))
        if '.'.join(call_path) == 'sys.maxint':
            self.errors.append(
                B304(node.lineno, node.col_offset)
            )
        elif len(call_path) == 2 and call_path[1] == 'message':
            name = call_path[0]
            for elem in reversed(self.node_stack[:-1]):
                if isinstance(elem, ast.ExceptHandler) and elem.name == name:
                    self.errors.append(
                        B306(node.lineno, node.col_offset)
                    )
                    break

        if node.attr in B101.methods:
            self.errors.append(
                B101(
                    message="B101: Avoid using the {} mock call as it is "
                            "confusing and prone to causing invalid test "
                            "behavior.".format(node.attr),
                    lineno=node.lineno,
                    col=node.col_offset,
                ),
            )

    def visit_Assign(self, node):
        # TODO(dcramer): pretty sure these aren't working correctly on Python2
        if isinstance(self.node_stack[-2], ast.ClassDef):
            # note: by hasattr belowe we're ignoring starred arguments, slices
            # and tuples for simplicity.
            assign_targets = {t.id for t in node.targets if hasattr(t, 'id')}
            if '__metaclass__' in assign_targets:
                self.errors.append(
                    B303(node.lineno, node.col_offset)
                )
            if '__unicode__' in assign_targets:
                self.errors.append(
                    B313(node.lineno, node.col_offset)
                )
        self.generic_visit(node)

    def visit_Name(self, node):
        for bug in (B308, B309, B310, B311):
            if node.id in bug.names:
                self.errors.append(
                    bug(
                        lineno=node.lineno,
                        col=node.col_offset,
                    ),
                )

    def compose_call_path(self, node):
        if isinstance(node, ast.Attribute):
            for item in self.compose_call_path(node.value):
                yield item
            yield node.attr
        elif isinstance(node, ast.Name):
            yield node.id


class SentryCheck(object):
    name = 'sentry-checker'

    def __init__(self, tree, filename=None, lines=None):
        self.tree = tree
        self.filename = filename
        self.lines = lines
        self.visitor = SentryVisitor

    def run(self):
        if not self.tree or not self.lines:
            self.load_file()

        visitor = self.visitor(
            filename=self.filename,
            lines=self.lines,
        )
        visitor.visit(self.tree)
        visitor.finish()

        for e in visitor.errors:
            try:
                if pycodestyle.noqa(self.lines[e.lineno - 1]):
                    continue
            except IndexError:
                pass

            yield e

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

    # def run(self):
    #     visitor = Py2to3Visitor()
    #     visitor.visit(self.tree)
    #     for code, lineno, name in visitor.errors:
    #         yield lineno, 0, self.codes[code], type(self)


error = namedtuple('error', 'lineno col message type')

B001 = partial(
    error,
    message="B001: Do not use bare `except:`, it also catches unexpected "
            "events like memory errors, interrupts, system exit, and so on.  "
            "Prefer `except Exception:`.  If you're sure what you're doing, "
            "be explicit and write `except BaseException:`.",
    type=SentryCheck,
)

B002 = partial(
    error,
    message="B002: Python does not support the unary prefix increment. Writing "
            "++n is equivalent to +(+(n)), which equals n. You meant n += 1.",
    type=SentryCheck,
)

B003 = partial(
    error,
    message="B003: Missing `from __future__ import absolute_import`",
    type=SentryCheck,
)

B101 = partial(
    error,
    type=SentryCheck)
B101.methods = {'assert_calls', 'assert_not_called', 'assert_called',
                'assert_called_once', 'not_called', 'called_once',
                'called_once_with'}

# Those could be false positives but it's more dangerous to let them slip
# through if they're not.
B301 = partial(
    error,
    message="B301: Python 3 does not include .iter* methods on dictionaries. "
            "Use `six.iter*` or `future.utils.iter*` instead.",
    type=SentryCheck,
)
B301.methods = {'iterkeys', 'itervalues', 'iteritems', 'iterlists'}
B301.valid_paths = {'six', 'future.utils', 'builtins'}

B302 = partial(
    error,
    message="B302: Python 3 does not include .view* methods on dictionaries. "
            "Remove the ``view`` prefix from the method name. Use `six.view*` "
            "or `future.utils.view*` instead.",
    type=SentryCheck,
)
B302.methods = {'viewkeys', 'viewvalues', 'viewitems', 'viewlists'}
B302.valid_paths = {'six', 'future.utils', 'builtins'}

B303 = partial(
    error,
    message="B303: __metaclass__ does not exist in Python 3. Use "
            "use `@six.add_metaclass()` instead.",
    type=SentryCheck,
)

B304 = partial(
    error,
    message="B304: sys.maxint does not exist in Python 3. Use `sys.maxsize`.",
    type=SentryCheck,
)

B305 = partial(
    error,
    message="B305: .next() does not exist in Python 3. Use ``six.next()`` "
            "instead.",
    type=SentryCheck,
)
B305.methods = {'next'}
B305.valid_paths = {'six', 'future.utils', 'builtins'}

B306 = partial(
    error,
    message="B306: ``BaseException.message`` has been deprecated as of Python "
            "2.6 and is removed in Python 3. Use ``str(e)`` to access the "
            "user-readable message. Use ``e.args`` to access arguments passed "
            "to the exception.",
    type=SentryCheck,
)

B307 = partial(
    error,
    message="B307: Python 3 has combined urllib, urllib2, and urlparse into "
            "a single library. For Python 2 compatibility, utilize the "
            "six.moves.urllib module.",
    type=SentryCheck)
B307.names = {'urllib', 'urlib2', 'urlparse'}

B308 = partial(
    error,
    message="B308: The usage of ``str`` differs between Python 2 and 3. Use "
            "``six.binary_type`` instead.",
    type=SentryCheck,
)
B308.names = {'str'}

B309 = partial(
    error,
    message="B309: ``unicode`` does not exist in Python 3. Use "
            "``six.text_type`` instead.",
    type=SentryCheck,
)
B309.names = {'unicode'}

B310 = partial(
    error,
    message="B310: ``basestring`` does not exist in Python 3. Use "
            "``six.string_types`` instead.",
    type=SentryCheck,
)
B310.names = {'basestring'}

B311 = partial(
    error,
    message="B311: ``long`` should not be used. Use int instead, and allow "
            "Python to deal with handling large integers.",
    type=SentryCheck,
)
B311.names = {'long'}

B312 = partial(
    error,
    message="B312: ``cgi.escape`` and ``html.escape`` should not be used. Use "
            "sentry.utils.html.escape instead.",
    type=SentryCheck,
)
B312.methods = {'escape'}
B312.invalid_paths = {'cgi', 'html'}

B313 = partial(
    error,
    message="B313: ``__unicode__`` should not be defined on classes. Define "
            "just ``__str__`` returning a unicode text string, and use the "
            "sentry.utils.compat.implements_to_string class decorator.",
    type=SentryCheck,
)

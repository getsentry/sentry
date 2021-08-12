import gc
import os
import sys
from dataclasses import replace
from pathlib import Path

import libcst as cst
from libcst import Arg, Attribute, Call, CSTTransformer, For, Name, SimpleString

gc.disable()


def call_arg0_without_list_wrap(node: Call):
    arg0 = node.args[0].value

    if getattr(arg0, "func", None) is None:
        return node

    if arg0.func.value != "list":
        return node

    if len(arg0.args) != 1:
        return node

    wrapped = arg0.args[0].value

    if wrapped.func.value not in ("map", "filter", "list", "sorted"):
        return node

    # nodes are frozen dataclasses.
    updated_node = replace(node, args=[replace(node.args[0], value=wrapped)])
    return updated_node


def for_in_without_list_wrap(node: For):
    container = node.iter  # fyi, in is powered by __contains__

    if len(container.args) != 1:
        return node

    wrapped = container.args[0].value

    if getattr(wrapped, "func", None) is None:
        return node

    if wrapped.func.value not in ("zip",):
        return node

    updated_node = replace(node, iter=wrapped)
    return updated_node


LIST_WRAPPED_ARG_NOT_NECESSARY_FOR = {
    "set",
    "frozenset",
    "sum",
    "list",
    "tuple",
    "sorted",
    "all",
    "any",
}


class GoodTransformer(CSTTransformer):
    def leave_Call(self, _, node):
        if isinstance(node.func, Name):
            if not (node.func.value in LIST_WRAPPED_ARG_NOT_NECESSARY_FOR and len(node.args) == 1):
                return node

            return call_arg0_without_list_wrap(node)

        elif isinstance(node.func, Attribute):
            # str.join(list(map|filter|list)) -> str.join(map|filter|list)
            if not (
                isinstance(node.func.value, SimpleString)
                and node.func.attr.value == "join"
                and len(node.args) == 1
            ):
                return node

            return call_arg0_without_list_wrap(node)

        return node

    def leave_For(self, _, node):
        # TODO: for x in list(map|filter|list)
        if isinstance(node.iter, Call):
            if not node.iter.func.value == "list":
                return node

            return for_in_without_list_wrap(node)

        return node


for fp in sys.argv[1:]:
    print(fp)
    m = cst.parse_module(Path(fp).read_text())
    Path(fp).write_text(m.visit(GoodTransformer()).code)

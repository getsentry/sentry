import gc
import os
import sys
from dataclasses import replace
from pathlib import Path

import libcst as cst
from libcst import Arg, Attribute, Call, CSTTransformer, Name, SimpleString

gc.disable()


def without_nested_list(node):
    nested = node.args[0].value

    if getattr(nested, "func", None) is None:
        return node

    if nested.func.value != "list":
        return node

    if len(nested.args) != 1:
        return node

    nested_nested = nested.args[0].value

    if nested_nested.func.value not in ("map", "filter", "list", "sorted"):
        return node

    # nodes are frozen dataclasses.
    updated_node = replace(node, args=[replace(node.args[0], value=nested_nested)])
    return updated_node


class GoodTransformer(CSTTransformer):
    def leave_Call(self, _, node):
        if isinstance(node.func, Name):
            if not (
                node.func.value in ("set", "frozenset", "sum", "list", "tuple", "sorted")
                and len(node.args) == 1
            ):
                return node

            return without_nested_list(node)

        elif isinstance(node.func, Attribute):
            # str.join(list(map|filter|list)) -> str.join(map|filter|list)
            if not (
                isinstance(node.func.value, SimpleString)
                and node.func.attr.value == "join"
                and len(node.args) == 1
            ):
                return node

            return without_nested_list(node)

        # TODO: for x in list(map|filter|list)

        # TODO  for x, y in list(zip)

        return node


for fp in sys.argv[1:]:
    print(fp)
    m = cst.parse_module(Path(fp).read_text())
    Path(fp).write_text(m.visit(GoodTransformer()).code)

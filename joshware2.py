import gc
import os
import sys
from pathlib import Path

import libcst as cst
from libcst import Arg, Call, CSTTransformer, Name

gc.disable()

JOSHWARE_COMPAT_INLINE = os.environ.get("JOSHWARE_COMPAT_INLINE", "map,filter,zip")
looking_for_you = JOSHWARE_COMPAT_INLINE.split(",")


class GoodTransformer(CSTTransformer):
    def leave_Call(self, _, node):
        if isinstance(node.func, Name):
            if node.func.value in looking_for_you:
                return Call(func=Name("list"), args=[Arg(value=node)])
        return node


for fp in sys.argv[1:]:
    print(fp)
    m = cst.parse_module(Path(fp).read_text())
    Path(fp).write_text(m.visit(GoodTransformer()).code)

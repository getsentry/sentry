import gc
import sys
from pathlib import Path

import libcst as cst
from libcst import (
    Call,
    CSTTransformer,
    FormattedString,
    FormattedStringExpression,
    Name,
    SimpleWhitespace,
)

gc.disable()


class GoodTransformer(CSTTransformer):
    def leave_Call(self, _, node):
        if isinstance(node.func, Name):
            # Right now we do create nested f-strings, however occurences are few and
            # easily detectable by black failing to reformat.
            # Would cost considerable performance to look at everything in the value.

            if node.func.value == "str":
                # Fun fact, str can take additional args like
                # str(b'foo', "utf-8") -> "foo"
                # If you didn't give the encoding then the byte literals show up:
                # str(b'foo') -> "b'foo'"
                # Occurences are very few, so just handle the str(obj) case.
                # str() is handled by pyupgrade.
                if len(node.args) != 1:
                    return node

                value = node.args[0].value
                if isinstance(value, Call) and len(value.args) > 1:
                    # Too complex, would rather leave as is.
                    return node

                # We could do some special constant folding like
                # str(1) -> "1", but I don't really expect that to be passed
                # to str() much.

                # Use cst.parse_expression to get the expected structure.
                return FormattedString(
                    parts=[
                        FormattedStringExpression(
                            expression=value,
                            conversion=None,
                            format_spec=None,
                            whitespace_before_expression=SimpleWhitespace(
                                value="",
                            ),
                            whitespace_after_expression=SimpleWhitespace(
                                value="",
                            ),
                            equal=None,
                        ),
                    ],
                    # We assume black has double quoted things.
                    # Like, foo["bar"].
                    # Then a second run of black will change into f"".
                    start="f'",
                    end="'",
                    lpar=[],
                    rpar=[],
                )
        return node


for fp in sys.argv[1:]:
    print(fp)
    m = cst.parse_module(Path(fp).read_text())
    Path(fp).write_text(m.visit(GoodTransformer()).code)
    del m

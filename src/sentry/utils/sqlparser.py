from __future__ import absolute_import

from sqlparse import engine
from sqlparse import filters
from sqlparse import tokens as T


class ValueFilter(filters.TokenFilter):
    include = (T.String, T.Number)
    exclude = (T.String.Symbol,)

    def process(self, stack, stream):
        for ttype, value in stream:
            parent = ttype
            while parent:
                if parent in self.exclude:
                    break
                if parent in self.include:
                    value = "?"
                    break
                if ttype.parent == parent:
                    parent = None
                else:
                    parent = ttype.parent
            yield ttype, value


def parse(query):
    stack = engine.FilterStack()
    stack.preprocess.append(ValueFilter())
    stack.postprocess.append(filters.SerializerUnicode())
    return "".join(stack.run(query))

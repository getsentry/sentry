from abc import ABC, abstractmethod
from collections.abc import Iterable
from typing import Any

from sentry.utils.performance_issues.types import Span


class SpansOp(ABC):
    @abstractmethod
    def __call__(self, spans: Iterable[Span]) -> bool:
        pass


class SpanOp(ABC):
    # TODO
    # @abstractmethod
    # def eval(self, ctx Context, span: Span) -> bool:
    #     pass

    @abstractmethod
    def __call__(self, span: Span) -> bool:
        pass

    def dumps(self, indent: int = 0) -> str:
        return " " * indent + str(self)


# def build_filter(spans_filter: str) -> SpansOp:
#     pass


# HTTP client request in SQL transaction:
#
# span.op="db" span.description:BEGIN*
# ...
# span.op="http.client" span.duration>SETTINGS.duration_threshold
# ...
# (span.op="db" span.description:COMMIT* OR
#  span.op="db" span.description:ROLLBACK*)
def http_within_sql_transaction() -> SpansOp:
    return OpPrecedes(
        # span.op="db" span.description:BEGIN*
        OpAnd(OpEqLiteral("op", "db"), OpPrefixLiteral("description", "BEGIN")),
        # ...
        # span.op="http.client" span.duration>SETTINGS.duration_threshold
        OpAnd(OpEqLiteral("op", "http.client"), OpDurationGtLiteral(0.250)),
        # ...
        # (span.op="db" span.description:COMMIT* OR
        #  span.op="db" span.description:ROLLBACK*)
        OpAnd(
            OpEqLiteral("op", "db"),
            OpOr(
                OpPrefixLiteral("description", "COMMIT"),
                OpPrefixLiteral("description", "ROLLBACK"),
            ),
        ),
    )


# TODO: Same implementation as above
def http_within_sql_transaction_native() -> SpansOp:
    class HttpWithinSqlTransactionNative(SpansOp):
        def __call__(self, spans: Iterable[Span]) -> bool:
            begin_found = False
            http_found = False
            for span in spans:
                if not begin_found:
                    if span.get("op") == "db" and span.get("description").startswith("BEGIN"):
                        begin_found = True
                    continue

                if not http_found:
                    if span.get("op") == "http.client" and (
                        (span["timestamp"] - span["start_timestamp"]) > 0.250
                    ):
                        http_found = True
                    continue

                if span.get("op") == "db" and (
                    span.get("description").startswith("COMMIT")
                    or span.get("description").startswith("ROLLBACK")
                ):
                    return True

            return False

    return HttpWithinSqlTransactionNative()


class OpTrue(SpanOp):
    def __call__(self, span: Span) -> bool:
        return True

    def __str__(self):
        return "True"


class OpAnd(SpanOp):
    def __init__(self, left: SpanOp, right: SpanOp):
        self.left = left
        self.right = right

    def __call__(self, span: Span) -> bool:
        return self.left(span) and self.right(span)

    def __str__(self):
        return f"({self.left} AND {self.right})"


class OpOr(SpanOp):
    def __init__(self, left: SpanOp, right: SpanOp):
        self.left = left
        self.right = right

    def __call__(self, span: Span) -> bool:
        return self.left(span) or self.right(span)

    def __str__(self):
        return f"({self.left} OR {self.right})"


class OpEqLiteral(SpanOp):
    def __init__(self, key: str, value: Any):
        self.key = key
        self.value = value

    def __call__(self, span: Span) -> bool:
        return span.get(self.key) == self.value

    def __str__(self):
        return f"{self.key}={repr(self.value)}"


class OpPrefixLiteral(SpanOp):
    def __init__(self, key: str, prefix: str):
        self.key = key
        self.prefix = prefix

    def __call__(self, span: Span) -> bool:
        return span.get(self.key).startswith(self.prefix)

    def __str__(self):
        return f"{self.key}={repr(self.prefix)}*"


class OpGtLiteral(SpanOp):
    def __init__(self, key: str, value: Any):
        self.key = key
        self.value = value

    def __call__(self, span: Span) -> bool:
        return self.key in span and span[self.key] > self.value

    def __str__(self):
        return f"{self.key}>{repr(self.value)})"


class OpDurationGtLiteral(SpanOp):
    def __init__(self, value: float):
        self.value = value

    def __call__(self, span: Span) -> bool:
        return (span["timestamp"] - span["start_timestamp"]) > self.value

    def __str__(self):
        return f"duration>{repr(self.value)}"


class OpPrecedes(SpansOp):
    def __init__(self, *ops: SpanOp):
        self.ops = ops

    def __call__(self, spans: Iterable[Span]) -> bool:
        i = 0
        for span in spans:
            if self.ops[i](span):
                if i == len(self.ops) - 1:
                    return True
                else:
                    i += 1
                    next
        return False

    def __str__(self):
        ops = ", ".join([str(op) for op in self.ops])
        return f"Precedes({ops})"

    def dumps(self, indent: int = 0) -> str:
        prefix = " " * indent
        output = prefix + "(\n"

        indent += 2
        prefix = " " * indent
        first = True
        for op in self.ops:
            if first:
                first = False
            else:
                output += prefix + "...\n"
            output += op.dumps(indent=indent) + "\n"

        indent -= 2
        prefix = " " * indent
        output += prefix + ")"

        return output

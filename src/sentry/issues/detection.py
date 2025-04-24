from abc import ABC, abstractmethod
from collections.abc import Iterable
from typing import Any

from sentry.utils.performance_issues.types import Span


class SpansOp(ABC):
    @abstractmethod
    def __call__(self, spans: Iterable[Span]) -> bool:
        pass


class SpanOp(ABC):
    @abstractmethod
    def __call__(self, span: Span) -> bool:
        pass


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
        OpAnd(OpEqLiteral("op", "db"), OpEqLiteral("description", "BEGIN")),
        # ...
        # span.op="http.client" span.duration>SETTINGS.duration_threshold
        OpAnd(
            OpEqLiteral("op", "http.client"),
            # TODO: spans have a start_timestamp and timestamp, not a duration
            OpTrue(),
            # OpGtLiteral("duration", 100),
        ),
        # ...
        # (span.op="db" span.description:COMMIT* OR
        #  span.op="db" span.description:ROLLBACK*)
        OpAnd(
            OpEqLiteral("op", "db"),
            OpOr(OpEqLiteral("description", "COMMIT"), OpEqLiteral("description", "ROLLBACK")),
        ),
    )


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
        return f"And({self.left}, {self.right})"


class OpOr(SpanOp):
    def __init__(self, left: SpanOp, right: SpanOp):
        self.left = left
        self.right = right

    def __call__(self, span: Span) -> bool:
        return self.left(span) or self.right(span)

    def __str__(self):
        return f"Or({self.left}, {self.right})"


class OpEqLiteral(SpanOp):
    def __init__(self, key: str, value: Any):
        self.key = key
        self.value = value

    def __call__(self, span: Span) -> bool:
        return span.get(self.key) == self.value

    def __str__(self):
        return f"EqLiteral({self.key}, {repr(self.value)})"


class OpGtLiteral(SpanOp):
    def __init__(self, key: str, value: Any):
        self.key = key
        self.value = value

    def __call__(self, span: Span) -> bool:
        return self.key in span and span[self.key] > self.value

    def __str__(self):
        return f"GtLiteral({self.key}, {repr(self.value)})"


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

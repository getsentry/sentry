from typing import List


class PerformanceSpanProblem:
    __slots__ = ("span_id", "allowed_op", "spans_involved", "fingerprint")
    """
    A class representing a detected performance issue caused by a performance span
    """

    def __init__(self, span_id: str, allowed_op: str, spans_involved: List[str], fingerprint=""):
        self.span_id = span_id
        self.allowed_op = allowed_op
        self.spans_involved = spans_involved
        self.fingerprint = fingerprint

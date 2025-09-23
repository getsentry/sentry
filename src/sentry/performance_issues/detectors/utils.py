import re

from sentry.performance_issues.base import get_span_duration

from ..types import Span

FILTERED_KEYWORDS = [
    "[Filtered]",
    "[ip]",
    "[REDACTED]",
    "[id]",
    "[Filtered Email]",
    "[filtered]",
    "[Filtered email]",
    "[Email]",
]


def get_total_span_duration(spans: list[Span]) -> float:
    "Given a list of spans, find the sum of the span durations in milliseconds"
    sum = 0.0
    for span in spans:
        sum += get_span_duration(span).total_seconds() * 1000
    return sum


def get_max_span_duration(spans: list[Span]) -> float:
    "Given a list of spans, return the duration of the longest span in milliseconds"
    return max([get_span_duration(span).total_seconds() * 1000 for span in spans])


def escape_transaction(transaction: str) -> str:
    transaction = re.sub(r'"', r"\"", transaction)
    transaction = re.sub(r"\*", r"\*", transaction)
    return transaction


def is_filtered_url(url: str) -> bool:
    return any(keyword in url for keyword in FILTERED_KEYWORDS)

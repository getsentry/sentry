import re
from typing import Any

from sentry.performance_issues.base import get_span_duration

from ..types import Span


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


def has_filtered_url(event: dict[str, Any], span: Span) -> bool:
    event_spans = event.get("spans", [])
    span_index = str(event_spans.index(span) if span in event_spans else -1)
    meta = event.get("_meta", {}).get("spans", {})
    if span_index in meta and meta[span_index].get("data", {}).get("url", {}):
        return True
    return False

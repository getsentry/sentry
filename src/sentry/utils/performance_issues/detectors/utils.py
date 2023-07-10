from typing import List

from sentry.utils.performance_issues.base import get_span_duration

from ..types import Span


def get_total_span_duration(spans: List[Span]) -> float:
    "Given a list of spans, find the sum of the span durations in milliseconds"
    sum = 0.0
    for span in spans:
        sum += get_span_duration(span).total_seconds() * 1000
    return sum


def get_max_span_duration(spans: List[Span]) -> float:
    "Given a list of spans, return the duration of the longest span in milliseconds"
    return max([get_span_duration(span).total_seconds() * 1000 for span in spans])

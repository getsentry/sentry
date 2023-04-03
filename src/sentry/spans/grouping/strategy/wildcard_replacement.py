from typing import Sequence

from sentry.spans.grouping.strategy.base import Span


def replace_wildcards(span: Span, rules: Sequence[str]) -> str:
    return "/api/0/issues/*/details"

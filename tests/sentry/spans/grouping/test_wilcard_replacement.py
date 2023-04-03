from typing import Sequence

import pytest

from sentry.spans.grouping.strategy.base import Span
from sentry.spans.grouping.strategy.wildcard_replacement import replace_wildcards
from sentry.testutils.performance_issues.span_builder import SpanBuilder


@pytest.mark.parametrize(
    "span,rules,result",
    [
        (
            SpanBuilder()
            .with_op("http.client")
            .with_description("GET /api/0/issues/sentry/details"),
            ["/api/0/issues/*/**"],
            "/api/0/issues/*/details",
        ),
    ],
)
def test_wildcard_replacement(span: Span, rules: Sequence[str], result) -> None:
    assert replace_wildcards(span, rules) == result

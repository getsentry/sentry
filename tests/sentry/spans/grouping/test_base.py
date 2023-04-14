import unittest

import pytest

from sentry.spans.grouping.strategy.base import span_op
from sentry.testutils.performance_issues.span_builder import SpanBuilder
from sentry.testutils.silo import region_silo_test


@region_silo_test
@pytest.mark.django_db
class SpanOpDecoratorTestCase(unittest.TestCase):
    def test_returns_none_if_op_is_not_eligible(self):
        span = SpanBuilder().with_op("http.server").with_description("run").build()

        wrapped = span_op("http.client")(description_strategy)
        assert wrapped(span) is None

        wrapped = span_op("http.server")(description_strategy)
        assert wrapped(span) == "run"


def description_strategy(span):
    return span["description"]

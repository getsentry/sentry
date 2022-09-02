"""
Metrics Service Layer Tests for Release Health
"""
import time

import pytest
from django.utils.datastructures import MultiValueDict

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.snuba.metrics.datasource import get_series
from sentry.snuba.metrics.query_builder import QueryDefinition
from sentry.testutils import BaseMetricsTestCase, TestCase

pytestmark = pytest.mark.sentry_metrics


class ReleaseHealthMetricsLayerTestCase(TestCase, BaseMetricsTestCase):
    def test_valid_filter_include_meta(self):
        self.create_release(version="foo", project=self.project)
        self.store_session(
            self.build_session(
                project_id=self.project.id, started=(time.time() // 60), release="foo"
            )
        )

        query_params = MultiValueDict(
            {
                "query": [
                    "release:staging"
                ],  # weird release but we need a string existing in mock indexer
                "groupBy": ["environment", "release"],
                "field": [
                    "sum(sentry.sessions.session)",
                ],
            }
        )
        query = QueryDefinition([self.project], query_params)
        data = get_series(
            [self.project],
            query.to_metrics_query(),
            include_meta=True,
            use_case_id=UseCaseKey.RELEASE_HEALTH,
        )
        assert data["meta"] == sorted(
            [
                {"name": "environment", "type": "string"},
                {"name": "release", "type": "string"},
                {"name": "sum(sentry.sessions.session)", "type": "Float64"},
                {"name": "bucketed_time", "type": "DateTime('Universal')"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_validate_include_meta_only_non_composite_derived_metrics_and_in_select(self):
        query_params = MultiValueDict(
            {
                "field": [
                    "session.errored",
                    "session.healthy",
                ],
                "includeSeries": "0",
            }
        )
        query = QueryDefinition([self.project], query_params)
        assert (
            get_series(
                [self.project],
                query.to_metrics_query(),
                include_meta=True,
                use_case_id=UseCaseKey.RELEASE_HEALTH,
            )["meta"]
            == []
        )

"""
Metrics Service Layer Tests for Release Health
"""
import time

import pytest
from django.utils.datastructures import MultiValueDict
from snuba_sdk import Granularity, Limit, Offset

from sentry.api.utils import InvalidParams
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.snuba.metrics import MetricField, MetricsQuery
from sentry.snuba.metrics.datasource import get_series
from sentry.snuba.metrics.naming_layer import SessionMRI
from sentry.snuba.metrics.query_builder import QueryDefinition, get_date_range
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

    def test_validate_include_meta_computes_meta_for_composite_derived_metrics(self):
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
        assert get_series(
            [self.project],
            query.to_metrics_query(),
            include_meta=True,
            use_case_id=UseCaseKey.RELEASE_HEALTH,
        )["meta"] == sorted(
            [
                {"name": "session.errored", "type": "Float64"},
                {"name": "session.healthy", "type": "Float64"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_alias_on_composite_entity_derived_metric(self):
        user_ts = time.time()
        org_id = self.organization.id

        for tag_value, count_value in (
            ("errored_preaggr", 10),
            ("crashed", 2),
            ("abnormal", 4),
            ("init", 15),
        ):
            self.store_metric(
                org_id=org_id,
                project_id=self.project.id,
                type="counter",
                name=str(SessionMRI.SESSION.value),
                tags={"session.status": tag_value},
                timestamp=(user_ts // 60 - 4) * 60,
                value=count_value,
                use_case_id=UseCaseKey.RELEASE_HEALTH,
            )
        for value in range(3):
            self.store_metric(
                org_id=org_id,
                project_id=self.project.id,
                type="set",
                name=str(SessionMRI.ERROR.value),
                tags={"release": "foo"},
                timestamp=user_ts,
                value=value,
                use_case_id=UseCaseKey.RELEASE_HEALTH,
            )
        start, end, rollup = get_date_range(
            {
                "statsPeriod": "6m",
                "interval": "1m",
            }
        )
        metrics_query = MetricsQuery(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            select=[
                MetricField(
                    op=None,
                    metric_mri=str(SessionMRI.ERRORED.value),
                    alias="errored_sessions_alias",
                ),
            ],
            start=start,
            end=end,
            granularity=Granularity(granularity=rollup),
            limit=Limit(limit=51),
            offset=Offset(offset=0),
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.RELEASE_HEALTH,
        )
        group = data["groups"][0]
        assert group["totals"]["errored_sessions_alias"] == 7
        assert group["series"]["errored_sessions_alias"] == [0, 4, 0, 0, 0, 3]
        assert data["meta"] == sorted(
            [
                {"name": "errored_sessions_alias", "type": "Float64"},
                {"name": "bucketed_time", "type": "DateTime('Universal')"},
            ],
            key=lambda elem: elem["name"],
        )

    def test_aliasing_behavior_on_derived_op_and_derived_alias(self):
        user_ts = time.time()
        for tag_value, d_value in (
            ("exited", [4, 5, 6, 1, 2, 3]),
            ("crashed", [7, 8, 9]),
        ):
            for v in d_value:
                self.store_metric(
                    org_id=self.organization.id,
                    project_id=self.project.id,
                    type="distribution",
                    name=str(SessionMRI.RAW_DURATION.value),
                    tags={"session.status": tag_value},
                    timestamp=user_ts,
                    value=v,
                    use_case_id=UseCaseKey.RELEASE_HEALTH,
                )

        start, end, rollup = get_date_range(
            {
                "statsPeriod": "1h",
                "interval": "1h",
            }
        )

        metrics_query = MetricsQuery(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            select=[
                MetricField(
                    op="histogram",
                    metric_mri=SessionMRI.RAW_DURATION.value,
                    params={
                        "histogram_from": 2,
                        "histogram_buckets": 2,
                    },
                    alias="histogram_non_filtered_duration",
                ),
            ],
            start=start,
            end=end,
            granularity=Granularity(granularity=rollup),
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            include_series=False,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.RELEASE_HEALTH,
        )

        hist = [(2.0, 5.5, 4), (5.5, 9.0, 4)]
        assert data["groups"] == [
            {
                "by": {},
                "totals": {"histogram_non_filtered_duration": hist},
            }
        ]

        metrics_query = MetricsQuery(
            org_id=self.organization.id,
            project_ids=[self.project.id],
            select=[
                MetricField(
                    op="histogram",
                    metric_mri=SessionMRI.DURATION.value,
                    params={
                        "histogram_from": 2,
                        "histogram_buckets": 2,
                    },
                    alias="histogram_duration",
                ),
            ],
            start=start,
            end=end,
            granularity=Granularity(granularity=rollup),
            limit=Limit(limit=51),
            offset=Offset(offset=0),
            include_series=False,
        )
        data = get_series(
            [self.project],
            metrics_query=metrics_query,
            include_meta=True,
            use_case_id=UseCaseKey.RELEASE_HEALTH,
        )

        hist = [(2.0, 4.0, 2), (4.0, 6.0, 3)]
        assert data["groups"] == [
            {
                "by": {},
                "totals": {"histogram_duration": hist},
            }
        ]

    def test_query_private_metrics_raise_exception(self):
        self.store_metric(
            org_id=self.organization.id,
            project_id=self.project.id,
            type="counter",
            name=str(SessionMRI.SESSION.value),
            tags={"session.status": "errored_preaggr"},
            timestamp=time.time(),
            value=2,
            use_case_id=UseCaseKey.RELEASE_HEALTH,
        )
        start, end, rollup = get_date_range(
            {
                "statsPeriod": "1h",
                "interval": "1h",
            }
        )
        with pytest.raises(
            InvalidParams,
            match="Unable to find a mri reverse mapping for 'e:sessions/error.preaggr@none'.",
        ):
            MetricsQuery(
                org_id=self.organization.id,
                project_ids=[self.project.id],
                select=[
                    MetricField(
                        op=None,
                        metric_mri=str(SessionMRI.ERRORED_PREAGGREGATED.value),
                        alias="errored_preaggregated_sessions_alias",
                    ),
                ],
                start=start,
                end=end,
                granularity=Granularity(granularity=rollup),
                limit=Limit(limit=51),
                offset=Offset(offset=0),
            )

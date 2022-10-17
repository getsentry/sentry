"""
Metrics Service Layer Tests for Release Health
"""
import time

import pytest
from django.utils import timezone
from django.utils.datastructures import MultiValueDict
from freezegun import freeze_time
from snuba_sdk import Limit, Offset

from sentry.api.utils import InvalidParams
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.snuba.metrics import MetricField
from sentry.snuba.metrics.datasource import get_series
from sentry.snuba.metrics.naming_layer import SessionMRI
from sentry.snuba.metrics.query_builder import QueryDefinition
from sentry.testutils import BaseMetricsLayerTestCase, TestCase

pytestmark = pytest.mark.sentry_metrics


@freeze_time("2022-09-29 10:00:00")
class ReleaseHealthMetricsLayerTestCase(BaseMetricsLayerTestCase, TestCase):
    @property
    def now(self):
        return timezone.now()

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
        for tag_value, count_value in (
            ("errored_preaggr", 10),
            ("crashed", 2),
            ("abnormal", 4),
            ("init", 15),
        ):
            self.store_release_health_metric(
                name=SessionMRI.SESSION.value,
                tags={"session.status": tag_value},
                value=count_value,
                minutes_before_now=4,
            )
        for value in range(3):
            self.store_release_health_metric(
                name=SessionMRI.ERROR.value,
                tags={"release": "foo"},
                value=value,
            )

        metrics_query = self.build_metrics_query(
            before_now="6m",
            granularity="1m",
            select=[
                MetricField(
                    op=None,
                    metric_mri=str(SessionMRI.ERRORED.value),
                    alias="errored_sessions_alias",
                ),
            ],
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
        for tag_value, d_value in (
            ("exited", [4, 5, 6, 1, 2, 3]),
            ("crashed", [7, 8, 9]),
        ):
            for v in d_value:
                self.store_release_health_metric(
                    name=SessionMRI.RAW_DURATION.value,
                    tags={"session.status": tag_value},
                    value=v,
                )

        metrics_query = self.build_metrics_query(
            before_now="1h",
            granularity="1h",
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

        metrics_query = self.build_metrics_query(
            before_now="1h",
            granularity="1h",
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
        self.store_release_health_metric(
            name=SessionMRI.SESSION.value,
            tags={"session.status": "errored_preaggr"},
            value=2,
        )

        with pytest.raises(
            InvalidParams,
            match="Unable to find a mri reverse mapping for 'e:sessions/error.preaggr@none'.",
        ):
            self.build_metrics_query(
                before_now="1h",
                granularity="1h",
                select=[
                    MetricField(
                        op=None,
                        metric_mri=str(SessionMRI.ERRORED_PREAGGREGATED.value),
                        alias="errored_preaggregated_sessions_alias",
                    ),
                ],
                limit=Limit(limit=51),
                offset=Offset(offset=0),
            )

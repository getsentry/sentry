from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from typing import Literal

import pytest
from snuba_sdk import (
    Column,
    Condition,
    Metric,
    MetricsQuery,
    MetricsScope,
    Op,
    Request,
    Rollup,
    Timeseries,
)

from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer import SessionMRI
from sentry.snuba.metrics_layer.query import run_query
from sentry.testutils.cases import BaseMetricsTestCase, TestCase

pytestmark = pytest.mark.sentry_metrics


class MQLTest(TestCase, BaseMetricsTestCase):
    def ts(self, dt: datetime) -> int:
        return int(dt.timestamp())

    def setUp(self) -> None:
        super().setUp()

        self.metrics: Mapping[str, Literal["counter", "set", "distribution"]] = {
            SessionMRI.RAW_DURATION.value: "distribution",
            SessionMRI.RAW_USER.value: "set",
            SessionMRI.RAW_SESSION.value: "counter",
        }
        self.now = datetime.now(tz=timezone.utc).replace(microsecond=0)
        self.hour_ago = self.now - timedelta(hours=1)
        self.org_id = self.project.organization_id
        for mri, metric_type in self.metrics.items():
            assert metric_type in {"counter", "distribution", "set"}
            for i in range(10):
                self.store_metric(
                    self.org_id,
                    self.project.id,
                    mri,
                    {
                        "release": "release_even" if i % 2 == 0 else "release_odd",
                    },
                    self.ts(self.hour_ago + timedelta(minutes=1 * i)),
                    i,
                )

    def test_metrics_groupby(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    None,
                    SessionMRI.RAW_DURATION.value,
                ),
                aggregate="max",
                groupby=[Column("release")],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.SESSIONS.value,
            ),
        )

        request = Request(
            dataset="metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert request.dataset == "metrics"
        assert len(result["data"]) == 10
        for data_point in result["data"]:
            assert data_point["release"] == "release_even" or data_point["release"] == "release_odd"

    def test_metrics_filters(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    None,
                    SessionMRI.RAW_USER.value,
                ),
                aggregate="count",
                filters=[
                    Condition(Column("release"), Op.EQ, "release_even"),
                ],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.SESSIONS.value,
            ),
        )

        request = Request(
            dataset="metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert request.dataset == "metrics"
        assert len(result["data"]) == 5

    def test_metrics_complex(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    None,
                    SessionMRI.RAW_SESSION.value,
                ),
                aggregate="count",
                groupby=[Column("release")],
                filters=[
                    Condition(Column("release"), Op.EQ, "release_even"),
                ],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.SESSIONS.value,
            ),
        )

        request = Request(
            dataset="metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert request.dataset == "metrics"
        assert len(result["data"]) == 5
        assert any(data_point["release"] == "release_even" for data_point in result["data"])

    def test_metrics_correctly_reverse_resolved(self) -> None:
        query = MetricsQuery(
            query=Timeseries(
                metric=Metric(
                    None,
                    SessionMRI.RAW_SESSION.value,
                ),
                aggregate="count",
                groupby=[Column("release"), Column("project_id")],
                filters=[
                    Condition(Column("release"), Op.EQ, "release_even"),
                    Condition(Column("project_id"), Op.EQ, self.project.id),
                ],
            ),
            start=self.hour_ago,
            end=self.now,
            rollup=Rollup(interval=60, granularity=60),
            scope=MetricsScope(
                org_ids=[self.org_id],
                project_ids=[self.project.id],
                use_case_id=UseCaseID.SESSIONS.value,
            ),
        )

        request = Request(
            dataset="metrics",
            app_id="tests",
            query=query,
            tenant_ids={"referrer": "metrics.testing.test", "organization_id": self.org_id},
        )
        result = run_query(request)
        assert request.dataset == "metrics"
        assert len(result["data"]) == 5
        assert any(data_point["release"] == "release_even" for data_point in result["data"])
        assert any(data_point["project_id"] == self.project.id for data_point in result["data"])

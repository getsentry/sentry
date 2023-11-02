from datetime import datetime, timedelta

import pytest
from django.utils import timezone as django_timezone

from sentry.sentry_metrics.querying.api import run_metrics_query
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer import SessionMRI, TransactionMRI
from sentry.testutils.cases import BaseMetricsTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time

pytestmark = pytest.mark.sentry_metrics

MOCK_DATETIME = (django_timezone.now() - timedelta(days=1)).replace(
    hour=10, minute=0, second=0, microsecond=0
)


@freeze_time(MOCK_DATETIME)
class MetricsAPITestCase(TestCase, BaseMetricsTestCase):
    def setUp(self):
        super().setUp()

        for value, transaction, platform, time in (
            (1, "/hello", "android", self.now()),
            (3, "/hello", "ios", self.now()),
            (5, "/world", "windows", self.now() + timedelta(minutes=30)),
            (3, "/hello", "ios", self.now() + timedelta(hours=1)),
            (2, "/hello", "android", self.now() + timedelta(hours=1)),
            (3, "/world", "windows", self.now() + timedelta(hours=1, minutes=30)),
        ):
            self.store_metric(
                self.project.organization.id,
                self.project.id,
                "distribution",
                TransactionMRI.DURATION.value,
                {"transaction": transaction, "platform": platform},
                self.ts(time),
                value,
                UseCaseID.TRANSACTIONS,
            )

    def now(self):
        return MOCK_DATETIME

    def ts(self, dt: datetime) -> int:
        return int(dt.timestamp())

    def test_query_with_one_aggregation(self) -> None:
        # Query with just one aggregation.
        field = f"sum({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query=None,
            group_bys=None,
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {}
        assert groups[0]["series"] == {field: [None, 9.0, 8.0]}
        assert groups[0]["totals"] == {field: 17.0}

    def test_query_with_group_by(self) -> None:
        # Query with one aggregation and two group by.
        field = f"sum({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query=None,
            group_bys=["transaction", "platform"],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 3
        assert groups[0]["by"] == {"platform": "android", "transaction": "/hello"}
        assert groups[0]["series"] == {field: [None, 1.0, 2.0]}
        assert groups[0]["totals"] == {field: 3.0}
        assert groups[1]["by"] == {"platform": "ios", "transaction": "/hello"}
        assert groups[1]["series"] == {field: [None, 3.0, 3.0]}
        assert groups[1]["totals"] == {field: 6.0}
        assert groups[2]["by"] == {"platform": "windows", "transaction": "/world"}
        assert groups[2]["series"] == {field: [None, 5.0, 3.0]}
        assert groups[2]["totals"] == {field: 8.0}

    def test_query_with_filters(self) -> None:
        # Query with one aggregation, one group by and two filters.
        field = f"sum({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query="platform:ios transaction:/hello",
            group_bys=["platform"],
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {"platform": "ios"}
        assert groups[0]["series"] == {field: [None, 3.0, 3.0]}
        assert groups[0]["totals"] == {field: 6.0}

    def test_query_with_multiple_aggregations(self) -> None:
        # Query with two aggregations.
        field_1 = f"min({TransactionMRI.DURATION.value})"
        field_2 = f"max({TransactionMRI.DURATION.value})"
        results = run_metrics_query(
            fields=[field_1, field_2],
            query=None,
            group_bys=None,
            start=self.now() - timedelta(minutes=30),
            end=self.now() + timedelta(hours=1, minutes=30),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {}
        assert groups[0]["series"] == {field_2: [None, 5.0, 3.0], field_1: [None, 1.0, 2.0]}
        assert groups[0]["totals"] == {field_2: 5.0, field_1: 1.0}

    @pytest.mark.skip(reason="sessions are not supported in the new metrics layer")
    def test_with_sessions(self) -> None:
        self.store_session(
            self.build_session(
                project_id=self.project.id,
                started=(self.now() + timedelta(minutes=30)).timestamp(),
                status="exited",
                release="foobar@2.0",
                errors=2,
            )
        )

        field = f"sum({SessionMRI.RAW_DURATION.value})"
        results = run_metrics_query(
            fields=[field],
            query=None,
            group_bys=None,
            start=self.now(),
            end=self.now() + timedelta(hours=1),
            interval=3600,
            organization=self.project.organization,
            projects=[self.project],
            referrer="metrics.data.api",
        )
        groups = results["groups"]
        assert len(groups) == 1
        assert groups[0]["by"] == {}
        assert groups[0]["series"] == {field: [60.0]}

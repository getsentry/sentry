from datetime import datetime, timedelta

import pytest
from django.utils import timezone as django_timezone
from freezegun import freeze_time

from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer import TransactionMRI
from sentry.snuba.metrics_layer.api import run_metrics_query
from sentry.testutils.cases import BaseMetricsTestCase, TestCase

pytestmark = pytest.mark.sentry_metrics

MOCK_DATETIME = (django_timezone.now() - timedelta(days=1)).replace(
    hour=10, minute=0, second=0, microsecond=0
)


@freeze_time(MOCK_DATETIME)
class MetricsAPITestCase(TestCase, BaseMetricsTestCase):
    def now(self):
        return MOCK_DATETIME

    def ts(self, dt: datetime) -> int:
        return int(dt.timestamp())

    def test_basic(self) -> None:
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

        results = run_metrics_query(
            field=f"sum({TransactionMRI.DURATION.value}) max({TransactionMRI.DURATION.value})",
            query="",
            group_by="transaction",
            start=(self.now() - timedelta(minutes=30)).isoformat(),
            end=(self.now() + timedelta(hours=1, minutes=30)).isoformat(),
            interval="1h",
            use_case_id=UseCaseID.TRANSACTIONS,
            organization=self.project.organization,
            projects=[self.project],
        )
        assert results == []

from datetime import datetime, timedelta, timezone

import pytest

from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer import TransactionMRI
from sentry.snuba.metrics_layer.api import run_metrics_query
from sentry.testutils.cases import BaseMetricsTestCase, TestCase

# from django.utils import timezone

pytestmark = pytest.mark.sentry_metrics


class SnQLTest(TestCase, BaseMetricsTestCase):
    def ts(self, dt: datetime) -> int:
        return int(dt.timestamp())

    def setUp(self):
        super().setUp()

        self.now = datetime.now(tz=timezone.utc)
        self.hour_ago = self.now - timedelta(hours=1)

    def test_basic(self) -> None:
        self.store_metric(
            self.project.organization.id,
            self.project.id,
            "distribution",
            TransactionMRI.DURATION.value,
            {
                "transaction": "/hello",
            },
            self.ts(self.hour_ago + timedelta(minutes=1)),
            1,
            UseCaseID.TRANSACTIONS,
        )

        results = run_metrics_query(
            field=f"sum({TransactionMRI.DURATION.value})",
            query="",
            group_by="transaction",
            start=self.hour_ago.isoformat(),
            end=(self.hour_ago + timedelta(hours=1)).isoformat(),
            interval="1h",
            use_case_id=UseCaseID.TRANSACTIONS,
            organization=self.project.organization,
            projects=[self.project],
        )
        assert results == []

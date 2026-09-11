from datetime import timedelta

import pytest
from django.urls import reverse

from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now

pytestmark = [
    pytest.mark.sentry_metrics,
    pytest.mark.skip(
        reason="Generic metrics sets, gauges, and distributions are no longer queryable"
    ),
]


class OrganizationMeasurementsMetaEmptyEndpoint(MetricsEnhancedPerformanceTestCase):
    endpoint = "sentry-api-0-organization-measurements-meta"
    METRIC_STRINGS = [
        "d:transactions/measurements.something_custom@millisecond",
    ]

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.DEFAULT_METRIC_TIMESTAMP = self.day_ago
        self.url = reverse(
            self.endpoint, kwargs={"organization_id_or_slug": self.project.organization.slug}
        )
        self.features: dict[str, bool] = {}

    def test_returns_no_measurements(self) -> None:
        self.store_transaction_metric(
            1,
            metric="measurements.something_custom",
            internal_metric="d:transactions/measurements.something_custom@millisecond",
            entity="metrics_distributions",
            timestamp=self.day_ago + timedelta(hours=1, minutes=0),
        )
        response = self.do_request(
            {
                "project": self.project.id,
                "statsPeriod": "14d",
            }
        )
        assert response.status_code == 200, response.content
        assert response.data == {}

from __future__ import annotations

import pytest

from sentry.testutils.cases import MetricsAPIBaseTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test

pytestmark = [pytest.mark.sentry_metrics]


@region_silo_test
@freeze_time(MetricsAPIBaseTestCase.MOCK_DATETIME)
class OrganizationMetricsQueryTest(MetricsAPIBaseTestCase):
    endpoint = "sentry-api-0-organization-metrics-query"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @property
    def now(self):
        return MetricsAPIBaseTestCase.MOCK_DATETIME

    def test_query_simple(self):
        self.get_success_response(
            self.project.organization.slug,
            status_code=200,
            queries="",
            formulas="",
            qs_params={
                "statsPeriod": "24h",
                "interval": "1h",
                "project": [self.project.id],
                "environment": [],
            },
        )

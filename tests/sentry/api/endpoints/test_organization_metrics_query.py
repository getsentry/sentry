from __future__ import annotations

import pytest

from sentry.snuba.metrics import TransactionMRI
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

        for transaction, value, hours in (("/hello", 10, 0), ("/world", 5, 1), ("/foo", 3, 2)):
            self.store_performance_metric(
                name=TransactionMRI.DURATION.value,
                tags={"transaction": transaction},
                value=value,
                hours_before_now=hours,
            )

    @property
    def now(self):
        return MetricsAPIBaseTestCase.MOCK_DATETIME

    def test_query_with_totals_and_series(self):
        response = self.get_success_response(
            self.project.organization.slug,
            status_code=200,
            queries=[{"name": "query_1", "mql": f"sum({TransactionMRI.DURATION.value})"}],
            formulas=[{"mql": "$query_1"}],
            qs_params={
                "statsPeriod": "3h",
                "interval": "1h",
                "project": [self.project.id],
                "environment": [],
            },
        )
        assert len(response.data["intervals"]) == 3
        assert response.data["data"] == [[{"by": {}, "series": [3.0, 5.0, 10.0], "totals": 18.0}]]
        assert response.data["meta"] == [
            [
                {"name": "aggregate_value", "type": "Float64"},
                {
                    "group_bys": [],
                    "limit": 20,
                    "order": None,
                    "scaling_factor": None,
                    "unit": None,
                    "unit_family": None,
                },
            ]
        ]

    def test_query_with_totals(self):
        response = self.get_success_response(
            self.project.organization.slug,
            status_code=200,
            queries=[{"name": "query_1", "mql": f"sum({TransactionMRI.DURATION.value})"}],
            formulas=[{"mql": "$query_1"}],
            qs_params={
                "statsPeriod": "3h",
                "interval": "1h",
                "project": [self.project.id],
                "environment": [],
                "includeSeries": "false",
            },
        )
        assert "intervals" not in response.data
        assert response.data["data"] == [[{"by": {}, "totals": 18.0}]]
        assert response.data["meta"] == [
            [
                {"name": "aggregate_value", "type": "Float64"},
                {
                    "group_bys": [],
                    "limit": 20,
                    "order": None,
                    "scaling_factor": None,
                    "unit": None,
                    "unit_family": None,
                },
            ]
        ]

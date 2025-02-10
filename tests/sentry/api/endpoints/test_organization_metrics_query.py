from __future__ import annotations

import pytest

from sentry.snuba.metrics import TransactionMRI
from sentry.testutils.cases import MetricsAPIBaseTestCase
from sentry.testutils.helpers.datetime import freeze_time

pytestmark = [pytest.mark.sentry_metrics]


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
        assert response.data["data"] == [
            [{"by": {}, "series": [3000000.0, 5000000.0, 10000000.0], "totals": 18000000.0}]
        ]
        assert response.data["meta"] == [
            [
                {"name": "aggregate_value", "type": "Float64"},
                {
                    "group_bys": [],
                    "limit": 3334,
                    "has_more": False,
                    "order": "DESC",
                    "scaling_factor": 1000000.0,
                    "unit": "nanosecond",
                    "unit_family": "duration",
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
        assert response.data["data"] == [[{"by": {}, "totals": 18000000.0}]]
        assert response.data["meta"] == [
            [
                {"name": "aggregate_value", "type": "Float64"},
                {
                    "group_bys": [],
                    "limit": 3334,
                    "has_more": False,
                    "order": "DESC",
                    "scaling_factor": 1000000.0,
                    "unit": "nanosecond",
                    "unit_family": "duration",
                },
            ]
        ]
        assert response.data["intervals"] == []

    @pytest.mark.skip("When a formula is used, the query times out")
    def test_recursion_error_query(self):
        conds = " OR ".join([f'transaction:"{e}"' for e in range(500)])
        error_mql = f"avg(d:transactions/duration@millisecond) by (transaction){{({conds})}}"
        self.get_success_response(
            self.project.organization.slug,
            status_code=200,
            queries=[{"name": "query_1", "mql": error_mql}],
            formulas=[{"mql": "$query_1"}],
            qs_params={
                "statsPeriod": "3h",
                "interval": "1h",
                "project": [self.project.id],
                "environment": [],
                "includeSeries": "false",
            },
        )

    def test_formula_with_only_number(self):
        response = self.get_response(
            self.project.organization.slug,
            queries=[{"name": "query_1", "mql": "avg(d:transactions/duration@millisecond)"}],
            formulas=[{"mql": "100"}],
            qs_params={
                "statsPeriod": "3h",
                "interval": "1h",
                "project": [self.project.id],
                "environment": [],
                "includeSeries": "false",
            },
        )
        assert response.status_code == 400

    def test_formula_with_number_equation_and_span_metric(self):
        response = self.get_response(
            self.project.organization.slug,
            queries=[{"name": "a", "mql": "avg(d:spans/webvital.inp@millisecond)"}],
            formulas=[{"mql": "$a"}, {"mql": "1 * 200"}],
            qs_params={
                "statsPeriod": "3h",
                "interval": "1h",
                "project": [self.project.id],
                "environment": [],
                "includeSeries": "false",
            },
        )
        assert response.status_code == 400

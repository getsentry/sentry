from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import APITestCase
from tests.sentry.incidents.endpoints.serializers.test_alert_rule import BaseAlertRuleSerializerTest


class OrganizationOnDemandRuleStatsEndpointTest(BaseAlertRuleSerializerTest, APITestCase):
    endpoint = "sentry-api-0-organization-ondemand-rules-stats"

    def setUp(self) -> None:
        super().setUp()

        self.features = {"organizations:on-demand-metrics-extraction": True}

        # no metric alert
        self.alert1 = self.create_alert_rule()

        # on-demand metric alert due to query but using transactions dataset
        self.alert2 = self.create_alert_rule(
            aggregate="count()",
            query="transaction.duration:>=10",
            dataset=Dataset.Transactions,
        )

        # on-demand metric alert due to query
        self.alert3 = self.create_alert_rule(
            aggregate="count()",
            query="transaction.duration:>=1000",
            dataset=Dataset.PerformanceMetrics,
        )

        # on-demand metric alert due to the apdex aggregation - it's the only metric which is on demand also without a query.
        self.alert4 = self.create_alert_rule(
            aggregate="apdex(300)",
            query="",
            dataset=Dataset.PerformanceMetrics,
        )

        self.login_as(user=self.user)

    def do_success_request(self, extra_features: dict[str, bool] | None = None) -> dict[str, int]:
        _features = {**self.features, **(extra_features or {})}
        with self.feature(_features):
            response = self.get_success_response(self.organization.slug, project_id=self.project.id)
            return response.data

    def test_missing_project_id(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
        )
        assert response.data["detail"] == "Invalid project_id"

    def test_endpoint_return_correct_counts(self) -> None:
        response_data = self.do_success_request()
        assert response_data == {
            "totalOnDemandAlertSpecs": 2,  # alert3 and alert4
            "maxAllowed": 50,
        }

        # When the prefill feature is enabled, the logic includes metrics from the transactions dataset
        response_data = self.do_success_request({"organizations:on-demand-metrics-prefill": True})
        assert response_data == {
            "totalOnDemandAlertSpecs": 3,  # alert2, alert3 and alert4
            "maxAllowed": 50,
        }

    def test_on_demand_alerts_exceeding_limit(self) -> None:
        for _ in range(50):
            self.create_alert_rule(
                aggregate="count()",
                query="transaction.duration:>=1400",
                dataset=Dataset.PerformanceMetrics,
            )

        response_data = self.do_success_request()
        assert response_data == {
            # 2 from the set_up + 50 from the loop = 52
            "totalOnDemandAlertSpecs": 52,
            "maxAllowed": 50,
        }

        response_data = self.do_success_request({"organizations:on-demand-metrics-prefill": True})
        assert response_data == {
            # 3 from the set_up + 50 from the loop = 53
            "totalOnDemandAlertSpecs": 53,
            "maxAllowed": 50,
        }

    def test_idor_project_from_different_org(self) -> None:
        """Regression test: Cannot access projects from other organizations (IDOR)."""
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)

        with self.feature(self.features):
            self.get_error_response(
                self.organization.slug, project_id=other_project.id, status_code=403
            )

    def test_negative_project_id_rejected(self) -> None:
        """Regression test: project_id=-1 (ALL_ACCESS_PROJECT_ID) should be rejected."""
        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug, project_id=-1, status_code=400
            )
            assert response.data["detail"] == "Invalid project_id"

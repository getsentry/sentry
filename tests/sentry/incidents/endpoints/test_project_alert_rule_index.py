from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import APITestCase
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.migration_helpers.alert_rule import migrate_alert_rule

pytestmark = [requires_snuba]


class AlertRuleListEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-alert-rules"

    def test_empty(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])

    def test_simple(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        alert_rule = self.create_alert_rule()
        _, _, _, detector, _, _, _, _ = migrate_alert_rule(alert_rule)

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, self.project.slug)

        assert len(resp.data) == 1
        assert resp.data[0]["name"] == detector.name

    def test_no_perf_alerts(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        alert_rule = self.create_alert_rule()
        migrate_alert_rule(alert_rule)
        perf_alert_rule = self.create_alert_rule(query="p95", dataset=Dataset.Transactions)
        migrate_alert_rule(perf_alert_rule)
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, self.project.slug)
            assert len(resp.data) == 1
            assert resp.data[0]["name"] == alert_rule.name

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_success_response(self.organization.slug, self.project.slug)
            assert len(resp.data) == 2
            names = {item["name"] for item in resp.data}
            assert names == {alert_rule.name, perf_alert_rule.name}

    def test_no_feature(self) -> None:
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.project.slug)
        assert resp.status_code == 404

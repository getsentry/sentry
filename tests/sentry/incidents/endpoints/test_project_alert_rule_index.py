from copy import deepcopy

from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.auditlogentry import AuditLogEntry
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class AlertRuleListEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-alert-rules"

    def test_empty(self):
        self.create_team(organization=self.organization, members=[self.user])

    def test_simple(self):
        self.create_team(organization=self.organization, members=[self.user])
        alert_rule = self.create_alert_rule()

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, self.project.slug)

        assert resp.data == serialize([alert_rule])

    def test_no_perf_alerts(self):
        self.create_team(organization=self.organization, members=[self.user])
        alert_rule = self.create_alert_rule()
        perf_alert_rule = self.create_alert_rule(query="p95", dataset=Dataset.Transactions)
        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_success_response(self.organization.slug, self.project.slug)
            assert resp.data == serialize([alert_rule])

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            resp = self.get_success_response(self.organization.slug, self.project.slug)
            assert resp.data == serialize([perf_alert_rule, alert_rule])

    def test_no_feature(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug, self.project.slug)
        assert resp.status_code == 404


@freeze_time()
class AlertRuleCreateEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-alert-rules"
    method = "post"

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.user = self.create_user()
        self.valid_alert_rule = {
            "aggregate": "count()",
            "query": "",
            "timeWindow": "300",
            "resolveThreshold": 100,
            "thresholdType": 0,
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 200,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id}
                    ],
                },
                {
                    "label": "warning",
                    "alertThreshold": 150,
                    "actions": [
                        {"type": "email", "targetType": "team", "targetIdentifier": self.team.id},
                        {"type": "email", "targetType": "user", "targetIdentifier": self.user.id},
                    ],
                },
            ],
            "projects": [self.project.slug],
            "owner": self.user.id,
            "name": "JustAValidTestRule",
        }
        self.create_member(
            user=self.user, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(self.user)

    def test_simple(self):
        with (
            outbox_runner(),
            self.feature(["organizations:incidents", "organizations:performance-view"]),
        ):
            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                status_code=201,
                **self.valid_alert_rule,
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_log_entry = AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("ALERT_RULE_ADD"), target_object=alert_rule.id
            )
        assert len(audit_log_entry) == 1
        assert (
            resp.renderer_context["request"].META["REMOTE_ADDR"]
            == list(audit_log_entry)[0].ip_address
        )

    def test_status_filter(self):
        with (
            outbox_runner(),
            self.feature(
                [
                    "organizations:incidents",
                    "organizations:performance-view",
                ]
            ),
        ):
            data = deepcopy(self.valid_alert_rule)
            data["query"] = "is:unresolved"
            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                status_code=201,
                **data,
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)
        assert alert_rule.snuba_query.query == "is:unresolved"

    def test_project_not_in_request(self):
        """Test that if you don't provide the project data in the request, we grab it from the URL"""
        data = deepcopy(self.valid_alert_rule)
        del data["projects"]
        with (
            outbox_runner(),
            self.feature(["organizations:incidents", "organizations:performance-view"]),
        ):
            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                status_code=201,
                **data,
            )
        assert "id" in resp.data
        alert_rule = AlertRule.objects.get(id=resp.data["id"])
        assert resp.data == serialize(alert_rule, self.user)

        with assume_test_silo_mode(SiloMode.CONTROL):
            audit_log_entry = AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("ALERT_RULE_ADD"), target_object=alert_rule.id
            )
        assert len(audit_log_entry) == 1
        assert (
            resp.renderer_context["request"].META["REMOTE_ADDR"]
            == list(audit_log_entry)[0].ip_address
        )

from uuid import uuid4

from django.urls import reverse

from sentry.integrations.slack.utils.rule_status import RedisRuleStatus
from sentry.testutils.cases import APITestCase
from sentry.workflow_engine.migration_helpers.alert_rule import (
    migrate_alert_rule,
    migrate_metric_action,
    migrate_metric_data_conditions,
    migrate_resolve_threshold_data_condition,
)


class ProjectAlertRuleTaskDetailsTest(APITestCase):
    def setUp(self):
        self.login_as(user=self.user)
        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo", fire_project_created=True)
        self.create_project(teams=[team], name="bar", fire_project_created=True)
        self.rule = self.create_alert_rule(
            name="My Alert Rule", user=self.user, projects=[project1]
        )
        self.uuid = uuid4().hex
        self.url = reverse(
            "sentry-api-0-project-alert-rule-task-details",
            kwargs={
                "organization_id_or_slug": project1.organization.slug,
                "project_id_or_slug": project1.slug,
                "task_uuid": self.uuid,
            },
        )

    def set_value(self, status, rule_id=None):
        client = RedisRuleStatus(self.uuid)
        client.set_value(status, rule_id)

    def test_status_pending(self):
        self.login_as(user=self.user)
        self.set_value("pending")
        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["status"] == "pending"
        assert response.data["alertRule"] is None

    def test_status_failed(self):
        self.login_as(user=self.user)
        self.set_value("failed", self.rule.id)
        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["status"] == "failed"
        assert response.data["alertRule"] is None

    def test_status_success(self):
        self.set_value("success", self.rule.id)
        self.login_as(user=self.user)
        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["status"] == "success"

        rule_data = response.data["alertRule"]
        assert rule_data["id"] == str(self.rule.id)
        assert rule_data["name"] == self.rule.name

    def test_workflow_engine_serializer(self):
        self.set_value("success", self.rule.id)
        self.login_as(user=self.user)

        self.critical_trigger = self.create_alert_rule_trigger(
            alert_rule=self.rule, label="critical"
        )
        self.critical_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.critical_trigger
        )
        _, _, _, self.detector, _, _, _, _ = migrate_alert_rule(self.rule)
        self.critical_detector_trigger, _, _ = migrate_metric_data_conditions(self.critical_trigger)

        self.critical_action, _, _ = migrate_metric_action(self.critical_trigger_action)
        self.resolve_trigger_data_condition = migrate_resolve_threshold_data_condition(self.rule)

        with self.feature("organizations:workflow-engine-rule-serializers"):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["status"] == "success"

        rule_data = response.data["alertRule"]
        assert rule_data["id"] == str(self.rule.id)
        assert rule_data["name"] == self.rule.name

    def test_wrong_no_alert_rule(self):
        rule_id = self.rule.id
        self.set_value("success", rule_id)
        self.rule.delete()
        self.login_as(user=self.user)
        response = self.client.get(self.url, format="json")
        assert response.status_code == 404

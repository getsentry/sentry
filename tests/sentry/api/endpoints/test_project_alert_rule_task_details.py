from uuid import uuid4

from django.urls import reverse

from sentry.integrations.slack.utils.rule_status import RedisRuleStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.migration_helpers.alert_rule import (
    migrate_alert_rule,
    migrate_metric_action,
    migrate_metric_data_conditions,
    migrate_resolve_threshold_data_condition,
)


class ProjectAlertRuleTaskDetailsTest(APITestCase):
    def setUp(self) -> None:
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

    def set_value(self, status: str, rule_id: int | None = None) -> None:
        client = RedisRuleStatus(self.uuid)
        client.set_value(status, rule_id)

    def test_status_pending(self) -> None:
        self.login_as(user=self.user)
        self.set_value("pending")
        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["status"] == "pending"
        assert response.data["alertRule"] is None

    def test_status_failed(self) -> None:
        self.login_as(user=self.user)
        self.set_value("failed", self.rule.id)
        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["status"] == "failed"
        assert response.data["alertRule"] is None

    def test_status_success(self) -> None:
        self.set_value("success", self.rule.id)
        self.login_as(user=self.user)
        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["status"] == "success"

        rule_data = response.data["alertRule"]
        assert rule_data["id"] == str(self.rule.id)
        assert rule_data["name"] == self.rule.name

    def test_workflow_engine_serializer(self) -> None:
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

    def test_wrong_no_alert_rule(self) -> None:
        rule_id = self.rule.id
        self.set_value("success", rule_id)
        self.rule.delete()
        self.login_as(user=self.user)
        response = self.client.get(self.url, format="json")
        assert response.status_code == 404


@freeze_time("2024-12-11 03:21:34")
class ProjectAlertRuleTaskDetailsDeltaTest(APITestCase):
    def setUp(self) -> None:
        self.login_as(user=self.user)
        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo", fire_project_created=True)
        self.rule = self.create_alert_rule(
            name="My Alert Rule", user=self.user, projects=[project1]
        )
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

        self.uuid = uuid4().hex
        self.url = reverse(
            "sentry-api-0-project-alert-rule-task-details",
            kwargs={
                "organization_id_or_slug": project1.organization.slug,
                "project_id_or_slug": project1.slug,
                "task_uuid": self.uuid,
            },
        )
        client = RedisRuleStatus(self.uuid)
        client.set_value("success", self.rule.id)

    def test_workflow_engine_serializer_matches_old_serializer(self) -> None:
        """New serializer output on the task details endpoint must match old serializer output."""
        # Old serializer
        response_old = self.client.get(self.url, format="json")
        assert response_old.status_code == 200
        old_data = response_old.data["alertRule"]

        # New serializer
        with self.feature("organizations:workflow-engine-rule-serializers"):
            response_new = self.client.get(self.url, format="json")
        assert response_new.status_code == 200
        new_data = response_new.data["alertRule"]

        skip_fields = {"triggers"}

        # Known differences between old and new serializers that are acceptable
        known_differences = {
            # createdBy: Lost during migration when AlertRuleActivity CREATED type wasn't
            # tracked. Detector.created_by_id is None if user wasn't provided during migration.
            # Cannot use AlertRuleActivity as it's being phased out.
            "createdBy",
            # resolveThreshold: Old serializer checked AlertRule.resolve_threshold for None,
            # but workflow engine always creates a resolve condition during migration.
            # Cannot distinguish between explicit None vs migrated value without AlertRule.
            "resolveThreshold",
        }

        mismatches: list[str] = []
        for field in set(list(old_data.keys()) + list(new_data.keys())):
            if field in skip_fields or field in known_differences:
                continue
            if field not in new_data:
                mismatches.append(f"Missing from new: {field}")
            elif field not in old_data:
                mismatches.append(f"Extra in new: {field}")
            elif old_data[field] != new_data[field]:
                mismatches.append(f"{field}: old={old_data[field]!r}, new={new_data[field]!r}")

        assert not mismatches, "Task details old vs new serializer differences:\n" + "\n".join(
            mismatches
        )

from unittest.mock import patch

from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.alert_rule import (
    CombinedRuleSerializer,
    DetailedAlertRuleSerializer,
)
from sentry.incidents.logic import (
    AlertTarget,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
)
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleProjects,
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
)
from sentry.models.rule import Rule
from sentry.snuba.models import SnubaQueryEventType
from sentry.testutils.cases import APITestCase, TestCase
from sentry.types.actor import Actor
from sentry.users.services.user.service import user_service

NOT_SET = object()


class BaseAlertRuleSerializerTest:
    def assert_alert_rule_serialized(
        self, alert_rule, result, skip_dates=False, resolve_threshold=NOT_SET
    ):
        alert_rule_projects = sorted(
            slug
            for slug in AlertRule.objects.filter(id=alert_rule.id).values_list(
                "projects__slug", flat=True
            )
            if slug is not None
        )
        assert result["id"] == str(alert_rule.id)
        assert result["organizationId"] == str(alert_rule.organization_id)
        assert result["name"] == alert_rule.name
        assert result["queryType"] == alert_rule.snuba_query.type
        assert result["dataset"] == alert_rule.snuba_query.dataset
        assert result["query"] == alert_rule.snuba_query.query
        assert result["aggregate"] == alert_rule.snuba_query.aggregate
        assert result["thresholdType"] == alert_rule.threshold_type
        assert result["resolveThreshold"] == (
            alert_rule.resolve_threshold if resolve_threshold is NOT_SET else resolve_threshold
        )
        assert result["timeWindow"] == alert_rule.snuba_query.time_window / 60
        assert result["resolution"] == alert_rule.snuba_query.resolution / 60
        assert result["thresholdPeriod"] == alert_rule.threshold_period
        assert result["projects"] == alert_rule_projects
        if alert_rule.created_by_id:
            created_by = user_service.get_user(user_id=alert_rule.created_by_id)
            assert created_by is not None
            assert result["createdBy"] == {
                "id": alert_rule.created_by_id,
                "name": created_by.get_display_name(),
                "email": created_by.email,
            }
        else:
            assert result["createdBy"] is None
        if not skip_dates:
            assert result["dateModified"] == alert_rule.date_modified
            assert result["dateCreated"] == alert_rule.date_added
        if alert_rule.snuba_query.environment:
            assert result["environment"] == alert_rule.snuba_query.environment.name
        else:
            assert result["environment"] is None

        if alert_rule.user_id or alert_rule.team_id:
            owner = Actor.from_id(user_id=alert_rule.user_id, team_id=alert_rule.team_id)
            assert owner
            assert result["owner"] == owner.identifier
        else:
            assert result["owner"] is None

        if alert_rule.comparison_delta:
            assert result["comparisonDelta"] == alert_rule.comparison_delta / 60
        else:
            assert result["comparisonDelta"] is None

    def create_issue_alert_rule(self, data):
        """data format
        {
            "project": project
            "environment": environment
            "name": "My rule name",
            "owner": actor id,
            "conditions": [],
            "actions": [],
            "actionMatch": "all"
        }
        """
        rule = Rule()
        rule.project = data["project"]
        if "environment" in data:
            environment = data["environment"]
            rule.environment_id = int(environment) if environment else environment
        if data.get("name"):
            rule.label = data["name"]
        if data.get("actionMatch"):
            rule.data["action_match"] = data["actionMatch"]
        if data.get("actions") is not None:
            rule.data["actions"] = data["actions"]
        if data.get("conditions") is not None:
            rule.data["conditions"] = data["conditions"]
        if data.get("frequency"):
            rule.data["frequency"] = data["frequency"]
        if data.get("date_added"):
            rule.date_added = data["date_added"]
        if data.get("owner"):
            actor = Actor.from_identifier(data["owner"])
            if actor.is_user:
                rule.owner_user_id = actor.id
            if actor.is_team:
                rule.owner_team_id = actor.id

        rule.save()
        return rule


class AlertRuleSerializerTest(BaseAlertRuleSerializerTest, TestCase):
    def test_simple(self):
        alert_rule = self.create_alert_rule()
        result = serialize(alert_rule)
        self.assert_alert_rule_serialized(alert_rule, result)

    def test_threshold_type_resolve_threshold(self):
        alert_rule = self.create_alert_rule(
            threshold_type=AlertRuleThresholdType.BELOW, resolve_threshold=500
        )
        result = serialize(alert_rule)
        self.assert_alert_rule_serialized(alert_rule, result)

    def test_triggers(self):
        alert_rule = self.create_alert_rule()
        other_alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(alert_rule, "test", 1000)
        result = serialize([alert_rule, other_alert_rule])
        assert result[0]["triggers"] == [serialize(trigger)]
        assert result[1]["triggers"] == []

    def test_projects(self):
        regular_alert_rule = self.create_alert_rule()
        alert_rule_no_projects = self.create_alert_rule()

        AlertRuleProjects.objects.filter(alert_rule_id=alert_rule_no_projects.id).delete()

        assert regular_alert_rule.projects
        assert not alert_rule_no_projects.projects.exists()
        result = serialize([regular_alert_rule, alert_rule_no_projects])

        assert result[0]["projects"] == [
            project.slug for project in regular_alert_rule.projects.all()
        ]
        # NOTE: we are now _only_ referencing alert_rule.projects fk (AlertRuleProjects)
        assert result[1]["projects"] == [
            project.slug for project in alert_rule_no_projects.projects.all()
        ]

    def test_environment(self):
        alert_rule = self.create_alert_rule(environment=self.environment)
        result = serialize(alert_rule)
        self.assert_alert_rule_serialized(alert_rule, result)

    def test_created_by(self):
        user = self.create_user("foo@example.com")
        alert_rule = self.create_alert_rule(environment=self.environment, user=user)
        result = serialize(alert_rule)
        self.assert_alert_rule_serialized(alert_rule, result)
        assert alert_rule.created_by_id == user.id

    def test_owner(self):
        user = self.create_user("foo@example.com")
        alert_rule = self.create_alert_rule(
            environment=self.environment,
            user=user,
            owner=Actor.from_id(team_id=self.team.id, user_id=None),
        )
        result = serialize(alert_rule)
        self.assert_alert_rule_serialized(alert_rule, result)
        assert alert_rule.team_id == self.team.id
        assert alert_rule.user_id is None

    def test_comparison_delta_above(self):
        alert_rule = self.create_alert_rule(
            comparison_delta=60,
            resolve_threshold=110,
            detection_type=AlertRuleDetectionType.PERCENT,
        )
        result = serialize(alert_rule)
        self.assert_alert_rule_serialized(alert_rule, result, resolve_threshold=10)

    def test_comparison_delta_below(self):
        alert_rule = self.create_alert_rule(
            comparison_delta=60,
            resolve_threshold=90,
            threshold_type=AlertRuleThresholdType.BELOW,
            detection_type=AlertRuleDetectionType.PERCENT,
        )
        result = serialize(alert_rule)
        self.assert_alert_rule_serialized(alert_rule, result, resolve_threshold=10)


class DetailedAlertRuleSerializerTest(BaseAlertRuleSerializerTest, TestCase):
    def test_simple(self):
        projects = [self.project, self.create_project()]
        alert_rule = self.create_alert_rule(projects=projects)
        result = serialize(alert_rule, serializer=DetailedAlertRuleSerializer())
        self.assert_alert_rule_serialized(alert_rule, result)
        assert sorted(result["projects"]) == sorted(p.slug for p in projects)
        assert result["eventTypes"] == [SnubaQueryEventType.EventType.ERROR.name.lower()]

    def test_triggers(self):
        alert_rule = self.create_alert_rule()
        other_alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(alert_rule, "test", 1000)
        result = serialize([alert_rule, other_alert_rule], serializer=DetailedAlertRuleSerializer())
        assert result[0]["triggers"] == [serialize(trigger)]
        assert result[1]["triggers"] == []

    @patch(
        "sentry.incidents.logic.get_target_identifier_display_for_integration",
        return_value=AlertTarget(123, "test"),
    )
    def test_trigger_actions(self, mock_get):
        alert_rule = self.create_alert_rule()
        other_alert_rule = self.create_alert_rule()
        trigger = create_alert_rule_trigger(alert_rule, "test", 1000)
        trigger_action = create_alert_rule_trigger_action(
            trigger,
            AlertRuleTriggerAction.Type.PAGERDUTY,
            AlertRuleTriggerAction.TargetType.SPECIFIC,
            target_identifier="123",
            integration_id=self.integration.id,
            priority="error",
        )
        result = serialize([alert_rule, other_alert_rule], serializer=DetailedAlertRuleSerializer())
        assert result[0]["triggers"] == [serialize(trigger)]
        assert result[0]["triggers"][0]["actions"] == [serialize(trigger_action)]
        assert result[1]["triggers"] == []


class CombinedRuleSerializerTest(BaseAlertRuleSerializerTest, APITestCase, TestCase):
    def test_combined_serializer(self):
        projects = [self.project, self.create_project()]
        alert_rule = self.create_alert_rule(projects=projects)
        issue_rule = self.create_issue_alert_rule(
            data={
                "project": self.project,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
            }
        )
        other_alert_rule = self.create_alert_rule()
        uptime_monitor = self.create_project_uptime_subscription()

        result = serialize(
            [alert_rule, issue_rule, other_alert_rule, uptime_monitor],
            serializer=CombinedRuleSerializer(),
        )

        self.assert_alert_rule_serialized(alert_rule, result[0])
        assert result[1]["id"] == str(issue_rule.id)
        assert result[1]["status"] == "active"
        assert not result[1]["snooze"]
        self.assert_alert_rule_serialized(other_alert_rule, result[2])
        serialized_uptime_monitor = serialize(uptime_monitor)
        serialized_uptime_monitor["type"] = "uptime"
        assert result[3] == serialized_uptime_monitor

    def test_alert_snoozed(self):
        projects = [self.project, self.create_project()]
        alert_rule = self.create_alert_rule(projects=projects)
        issue_rule = self.create_issue_alert_rule(
            data={
                "project": self.project,
                "name": "Issue Rule Test",
                "conditions": [],
                "actions": [],
                "actionMatch": "all",
            }
        )
        self.snooze_rule(owner_id=self.user.id, alert_rule=alert_rule)
        other_alert_rule = self.create_alert_rule()

        result = serialize(
            [alert_rule, issue_rule, other_alert_rule], serializer=CombinedRuleSerializer()
        )

        self.assert_alert_rule_serialized(alert_rule, result[0])
        assert result[0]["snooze"]
        assert result[1]["id"] == str(issue_rule.id)
        assert result[1]["status"] == "active"
        assert not result[1]["snooze"]
        self.assert_alert_rule_serialized(other_alert_rule, result[2])

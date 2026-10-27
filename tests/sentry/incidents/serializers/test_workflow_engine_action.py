from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.utils import get_fake_id_from_object_id
from sentry.incidents.endpoints.serializers.workflow_engine_action import (
    WorkflowEngineActionSerializer,
)
from sentry.models.organizationmember import OrganizationMember
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.group_type_notification_registry.handlers.metric_alert_registry_handler import (
    MetricAlertRegistryHandler,
)
from sentry.workflow_engine.models import Action
from tests.sentry.incidents.serializers.test_workflow_engine_base import (
    MetricSerializerTestCase,
    TestWorkflowEngineSerializer,
)


class TestGetTargets(MetricSerializerTestCase):
    def setUp(self) -> None:
        super().setUp()
        detector, workflow, _ = self.create_metric_detector()
        _, self.critical_action_group = self.create_metric_trigger(detector, workflow)
        self.critical_action = self.create_email_action(self.critical_action_group)

    def test_batch_user_targets(self) -> None:
        targets = MetricAlertRegistryHandler.get_targets([self.critical_action])
        target = targets[self.critical_action.id]
        assert isinstance(target, OrganizationMember)
        assert target.user_id == self.user.id

    def test_batch_team_targets(self) -> None:
        team = self.create_team(organization=self.organization)
        action = self.create_email_action(
            self.critical_action_group,
            target_type=ActionTarget.TEAM,
            target_identifier=str(team.id),
        )
        assert MetricAlertRegistryHandler.get_targets([action])[action.id] == team

    def test_batch_team_target_from_another_organization(self) -> None:
        other_team = self.create_team(organization=self.create_organization())
        action = self.create_email_action(
            self.critical_action_group,
            target_type=ActionTarget.TEAM,
            target_identifier=str(other_team.id),
        )
        assert MetricAlertRegistryHandler.get_targets([action])[action.id] is None
        serialized = serialize(action, self.user, WorkflowEngineActionSerializer())
        assert serialized["desc"] == "Send an email to [removed]"
        assert other_team.slug not in serialized["desc"]

    def test_batch_specific_targets(self) -> None:
        action = self.create_action(
            type=Action.Type.SLACK,
            config={
                "target_identifier": "123",
                "target_display": "myChannel",
                "target_type": ActionTarget.SPECIFIC,
            },
        )
        self.create_data_condition_group_action(
            action=action, condition_group=self.critical_action_group
        )
        assert MetricAlertRegistryHandler.get_targets([action])[action.id] == "123"

    def test_batch_mixed_targets(self) -> None:
        team = self.create_team(organization=self.organization)
        team_action = self.create_email_action(
            self.critical_action_group,
            target_type=ActionTarget.TEAM,
            target_identifier=str(team.id),
        )
        specific_action = self.create_action(
            type=Action.Type.SLACK,
            config={
                "target_identifier": "chan-id",
                "target_display": "myChannel",
                "target_type": ActionTarget.SPECIFIC,
            },
        )
        self.create_data_condition_group_action(
            action=specific_action, condition_group=self.critical_action_group
        )
        targets = MetricAlertRegistryHandler.get_targets(
            [self.critical_action, team_action, specific_action]
        )
        user_target = targets[self.critical_action.id]
        assert isinstance(user_target, OrganizationMember)
        assert user_target.user_id == self.user.id
        assert targets[team_action.id] == team
        assert targets[specific_action.id] == "chan-id"

    def test_batch_missing_user(self) -> None:
        other_user = self.create_user()
        action = self.create_email_action(
            self.critical_action_group, target_identifier=str(other_user.id)
        )
        assert MetricAlertRegistryHandler.get_targets([action])[action.id] is None

    def test_batch_empty_list(self) -> None:
        assert MetricAlertRegistryHandler.get_targets([]) == {}


class TestActionSerializer(TestWorkflowEngineSerializer):
    def test_simple(self) -> None:
        serialized = serialize(
            self.critical_action,
            self.user,
            WorkflowEngineActionSerializer(),
            alert_rule_trigger_id=self.legacy_critical_trigger_id,
        )
        assert serialized == self.expected_critical_action[0]

    def test_warning_trigger(self) -> None:
        team = self.create_team(organization=self.organization)
        self.add_warning_trigger()
        self.warning_action.update(
            config={
                "target_type": ActionTarget.TEAM,
                "target_identifier": str(team.id),
                "target_display": None,
            }
        )
        serialized = serialize(
            self.warning_action,
            self.user,
            WorkflowEngineActionSerializer(),
            alert_rule_trigger_id=self.legacy_warning_trigger_id,
        )
        expected = {
            **self.expected_warning_action[0],
            "targetType": "team",
            "targetIdentifier": str(team.id),
            "desc": f"Send an email to members of #{team.slug}",
        }
        assert serialized == expected

    def test_sentry_app_action(self) -> None:
        sentry_app = self.create_sentry_app(
            organization=self.organization,
            published=True,
            verify_install=False,
            name="Super Awesome App",
            schema={"elements": [self.create_alert_rule_action_schema()]},
        )
        self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization, user=self.user
        )
        settings = [{"name": "title", "label": None, "value": "An alert"}]
        action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": str(sentry_app.id),
                "target_type": ActionTarget.SENTRY_APP,
                "target_display": sentry_app.name,
            },
            data={"settings": settings},
        )
        self.create_data_condition_group_action(
            action=action, condition_group=self.critical_action_group
        )
        serialized = serialize(
            action,
            self.user,
            WorkflowEngineActionSerializer(),
            alert_rule_trigger_id=self.legacy_critical_trigger_id,
        )
        expected = {
            **self.expected_critical_action[0],
            "id": str(get_fake_id_from_object_id(action.id)),
            "type": "sentry_app",
            "targetType": "sentry_app",
            "targetIdentifier": sentry_app.id,
            "sentryAppId": sentry_app.id,
            "settings": settings,
            "dateCreated": action.date_added,
            "desc": f"Send a notification via {sentry_app.name}",
        }
        assert serialized == expected

    def test_slack_action(self) -> None:
        integration = self.create_slack_integration(
            self.organization, external_id="TXXXXXXX1", user=self.user
        )
        action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=integration.id,
            config={
                "target_identifier": "123",
                "target_display": "myChannel",
                "target_type": ActionTarget.SPECIFIC,
            },
        )
        self.create_data_condition_group_action(
            action=action, condition_group=self.critical_action_group
        )
        serialized = serialize(
            action,
            self.user,
            WorkflowEngineActionSerializer(),
            alert_rule_trigger_id=self.legacy_critical_trigger_id,
        )
        expected = {
            **self.expected_critical_action[0],
            "id": str(get_fake_id_from_object_id(action.id)),
            "type": "slack",
            "targetType": "specific",
            "targetIdentifier": "myChannel",
            "inputChannelId": "123",
            "integrationId": integration.id,
            "dateCreated": action.date_added,
            "desc": "Send a Slack notification to myChannel",
        }
        assert serialized == expected

    def test_provider_description(self) -> None:
        cases = [
            (Action.Type.DISCORD, {}, "Send a Discord notification to test"),
            (
                Action.Type.PAGERDUTY,
                {"priority": "critical"},
                "Send a critical level PagerDuty notification to test",
            ),
            (Action.Type.PAGERDUTY, {}, "Send a PagerDuty notification to test"),
            (
                Action.Type.OPSGENIE,
                {"priority": "P1"},
                "Send a P1 level Opsgenie notification to test",
            ),
        ]
        for action_type, data, expected_description in cases:
            with self.subTest(action_type=action_type.value, data=data):
                action = self.create_action(
                    type=action_type,
                    data=data,
                    config={
                        "target_type": ActionTarget.SPECIFIC,
                        "target_identifier": "123",
                        "target_display": "test",
                    },
                )
                self.create_data_condition_group_action(
                    action=action, condition_group=self.critical_action_group
                )
                serialized = serialize(action, self.user, WorkflowEngineActionSerializer())
                assert serialized["type"] == action_type
                assert serialized["priority"] == data.get("priority")
                assert serialized["desc"] == expected_description

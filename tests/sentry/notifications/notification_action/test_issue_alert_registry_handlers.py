import uuid
from unittest import mock

import pytest

from sentry.constants import ObjectStatus
from sentry.models.rule import Rule, RuleSource
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.issue_alert_registry import (
    AzureDevopsIssueAlertHandler,
    DiscordIssueAlertHandler,
    EmailIssueAlertHandler,
    GithubIssueAlertHandler,
    JiraIssueAlertHandler,
    JiraServerIssueAlertHandler,
    MSTeamsIssueAlertHandler,
    OpsgenieIssueAlertHandler,
    PagerDutyIssueAlertHandler,
    PluginIssueAlertHandler,
    SentryAppIssueAlertHandler,
    SlackIssueAlertHandler,
    WebhookIssueAlertHandler,
)
from sentry.notifications.notification_action.types import (
    BaseIssueAlertHandler,
    TicketingIssueAlertHandler,
)
from sentry.notifications.types import ActionTargetType, FallthroughChoiceType
from sentry.testutils.helpers.data_blobs import (
    AZURE_DEVOPS_ACTION_DATA_BLOBS,
    EMAIL_ACTION_DATA_BLOBS,
    GITHUB_ACTION_DATA_BLOBS,
    JIRA_ACTION_DATA_BLOBS,
    JIRA_SERVER_ACTION_DATA_BLOBS,
    WEBHOOK_ACTION_DATA_BLOBS,
)
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from sentry.workflow_engine.typings.notification_action import (
    ACTION_FIELD_MAPPINGS,
    EXCLUDED_ACTION_DATA_KEYS,
    ActionFieldMapping,
    ActionFieldMappingKeys,
    EmailActionHelper,
    SentryAppIdentifier,
    TicketingActionDataBlobHelper,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


def pop_keys_from_data_blob(data_blob: dict, action_type: str) -> dict:
    """
    Remove standard action fields from each dictionary in the data blob.

    Args:
        data_blob: List of dictionaries containing action data

    Returns:
        List of dictionaries with standard action fields removed
    """
    KEYS_TO_REMOVE = {
        *EXCLUDED_ACTION_DATA_KEYS,
        ACTION_FIELD_MAPPINGS[action_type].get(ActionFieldMappingKeys.INTEGRATION_ID_KEY.value),
        ACTION_FIELD_MAPPINGS[action_type].get(ActionFieldMappingKeys.TARGET_IDENTIFIER_KEY.value),
        ACTION_FIELD_MAPPINGS[action_type].get(ActionFieldMappingKeys.TARGET_DISPLAY_KEY.value),
    }

    return {k: v for k, v in data_blob.items() if k not in KEYS_TO_REMOVE}


class TestBaseIssueAlertHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.detector = self.create_detector(project=self.project)
        self.workflow = self.create_workflow(environment=self.environment)
        self.rule = self.create_project_rule(project=self.project)
        self.alert_rule_workflow = self.create_alert_rule_workflow(
            workflow=self.workflow, rule_id=self.rule.id
        )
        self.action = self.create_action(
            type=Action.Type.DISCORD,
            integration_id="1234567890",
            config={"target_identifier": "channel456", "target_type": ActionTarget.SPECIFIC},
            data={"tags": "environment,user,my_tag"},
        )
        self.group, self.event, self.group_event = self.create_group_event()
        self.event_data = WorkflowEventData(
            event=self.group_event, workflow_env=self.environment, group=self.group
        )

        self.action.workflow_id = self.workflow.id

        class TestHandler(BaseIssueAlertHandler):
            @classmethod
            def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping):
                return {"tags": "environment,user,my_tag"}

            @classmethod
            def get_target_display(cls, action: Action, mapping: ActionFieldMapping):
                return {}

        self.handler = TestHandler()

    def test_create_rule_instance_from_action_missing_properties_raises_value_error(self) -> None:
        class TestHandler(BaseIssueAlertHandler):
            @classmethod
            def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping):
                return {"tags": "environment,user,my_tag"}

        handler = TestHandler()
        with pytest.raises(ValueError):
            handler.create_rule_instance_from_action(self.action, self.detector, self.event_data)

    def test_create_rule_instance_from_action_missing_workflow_id_raises_value_error(self) -> None:
        job = WorkflowEventData(
            event=self.group_event, workflow_env=self.environment, group=self.group
        )
        action = self.create_action(
            type=Action.Type.DISCORD,
            integration_id="1234567890",
            config={"target_identifier": "channel456", "target_type": ActionTarget.SPECIFIC},
            data={"tags": "environment,user,my_tag"},
        )

        with pytest.raises(ValueError):
            self.handler.create_rule_instance_from_action(action, self.detector, job)

    def test_create_rule_instance_from_action_missing_rule_raises_value_error(self) -> None:
        job = WorkflowEventData(
            event=self.group_event, workflow_env=self.environment, group=self.group
        )
        alert_rule = self.create_alert_rule(projects=[self.project], organization=self.organization)
        self.create_alert_rule_workflow(workflow=self.workflow, alert_rule_id=alert_rule.id)
        action = self.create_action(
            type=Action.Type.DISCORD,
            integration_id="1234567890",
            config={"target_identifier": "channel456", "target_type": ActionTarget.SPECIFIC},
            data={"tags": "environment,user,my_tag"},
        )

        with pytest.raises(ValueError):
            self.handler.create_rule_instance_from_action(action, self.detector, job)

    def test_create_rule_instance_from_action(self) -> None:
        """Test that create_rule_instance_from_action creates a Rule with correct attributes"""
        rule = self.handler.create_rule_instance_from_action(
            self.action, self.detector, self.event_data
        )

        assert isinstance(rule, Rule)
        assert rule.id == self.action.id
        assert rule.project == self.detector.project
        assert rule.environment_id is not None
        assert self.workflow.environment is not None
        assert rule.environment_id == self.workflow.environment.id
        assert rule.label == rule.label
        assert rule.data == {
            "actions": [
                {
                    "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                    "server": "1234567890",
                    "channel_id": "channel456",
                    "tags": "environment,user,my_tag",
                    "legacy_rule_id": self.rule.id,
                }
            ],
        }
        assert rule.status == ObjectStatus.ACTIVE
        assert rule.source == RuleSource.ISSUE

    @with_feature("organizations:workflow-engine-ui-links")
    def test_create_rule_instance_from_action_with_workflow_engine_ui_feature_flag(self) -> None:
        """Test that create_rule_instance_from_action creates a Rule with correct attributes"""
        rule = self.handler.create_rule_instance_from_action(
            self.action, self.detector, self.event_data
        )

        assert isinstance(rule, Rule)
        assert rule.id == self.action.id
        assert rule.project == self.detector.project
        assert rule.environment_id is not None
        assert self.workflow.environment is not None
        assert rule.environment_id == self.workflow.environment.id
        assert rule.label == self.detector.name
        assert rule.data == {
            "actions": [
                {
                    "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                    "server": "1234567890",
                    "channel_id": "channel456",
                    "tags": "environment,user,my_tag",
                    "workflow_id": self.workflow.id,
                }
            ]
        }
        assert rule.status == ObjectStatus.ACTIVE
        assert rule.source == RuleSource.ISSUE

    def test_create_rule_instance_from_action_no_environment(self) -> None:
        """Test that create_rule_instance_from_action creates a Rule with correct attributes"""
        self.create_workflow()
        job = WorkflowEventData(event=self.group_event, workflow_env=None, group=self.group)
        rule = self.handler.create_rule_instance_from_action(self.action, self.detector, job)

        assert isinstance(rule, Rule)
        assert rule.id == self.action.id
        assert rule.project == self.detector.project
        assert rule.environment_id is None
        assert rule.label == rule.label
        assert rule.data == {
            "actions": [
                {
                    "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                    "server": "1234567890",
                    "channel_id": "channel456",
                    "tags": "environment,user,my_tag",
                    "legacy_rule_id": self.rule.id,
                }
            ],
        }
        assert rule.status == ObjectStatus.ACTIVE
        assert rule.source == RuleSource.ISSUE

    @with_feature("organizations:workflow-engine-ui-links")
    def test_create_rule_instance_from_action_no_environment_with_workflow_engine_ui_feature_flag(
        self,
    ):
        """Test that create_rule_instance_from_action creates a Rule with correct attributes"""
        self.create_workflow()
        job = WorkflowEventData(event=self.group_event, workflow_env=None, group=self.group)
        rule = self.handler.create_rule_instance_from_action(self.action, self.detector, job)

        assert isinstance(rule, Rule)
        assert rule.id == self.action.id
        assert rule.project == self.detector.project
        assert rule.environment_id is None
        assert rule.label == self.detector.name
        assert rule.data == {
            "actions": [
                {
                    "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                    "server": "1234567890",
                    "channel_id": "channel456",
                    "tags": "environment,user,my_tag",
                    "workflow_id": self.workflow.id,
                }
            ]
        }
        assert rule.status == ObjectStatus.ACTIVE
        assert rule.source == RuleSource.ISSUE

    @mock.patch("sentry.notifications.notification_action.types.invoke_future_with_error_handling")
    @mock.patch("sentry.notifications.notification_action.types.activate_downstream_actions")
    @mock.patch("uuid.uuid4")
    def test_invoke_legacy_registry(
        self, mock_uuid, mock_activate_downstream_actions, mock_invoke_future_with_error_handling
    ):
        # Test that invoke_legacy_registry correctly processes the action
        mock_uuid.return_value = uuid.UUID("12345678-1234-5678-1234-567812345678")

        # Mock callback and futures
        mock_callback = mock.Mock()
        mock_futures = [mock.Mock()]
        mock_activate_downstream_actions.return_value = {"some_key": (mock_callback, mock_futures)}

        invocation = ActionInvocation(
            event_data=self.event_data,
            action=self.action,
            detector=self.detector,
        )

        self.handler.invoke_legacy_registry(invocation)

        # Verify activate_downstream_actions called with correct args
        mock_activate_downstream_actions.assert_called_once_with(
            mock.ANY, self.event_data.event, "12345678-1234-5678-1234-567812345678"  # Rule instance
        )

        # Verify callback execution
        mock_invoke_future_with_error_handling.assert_called_once_with(
            self.event_data, mock_callback, mock_futures
        )


class TestDiscordIssueAlertHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.handler = DiscordIssueAlertHandler()
        self.detector = self.create_detector(project=self.project)
        self.action = self.create_action(
            type=Action.Type.DISCORD,
            integration_id="1234567890",
            config={"target_identifier": "channel456", "target_type": ActionTarget.SPECIFIC},
            data={"tags": "environment,user,my_tag"},
        )

    def test_build_rule_action_blob(self) -> None:
        """Test that build_rule_action_blob creates correct Discord action data"""
        blob = self.handler.build_rule_action_blob(self.action, self.organization.id)

        assert blob == {
            "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
            "server": "1234567890",
            "channel_id": "channel456",
            "tags": "environment,user,my_tag",
        }

    def test_build_rule_action_blob_no_tags(self) -> None:
        """Test that build_rule_action_blob handles missing tags"""
        self.action.data = {}
        blob = self.handler.build_rule_action_blob(self.action, self.organization.id)

        assert blob == {
            "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
            "server": "1234567890",
            "channel_id": "channel456",
            "tags": "",
        }


class TestMSTeamsIssueAlertHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.handler = MSTeamsIssueAlertHandler()
        self.detector = self.create_detector(project=self.project)
        self.action = self.create_action(
            type=Action.Type.MSTEAMS,
            integration_id="1234567890",
            config={
                "target_identifier": "channel789",
                "target_display": "General Channel",
                "target_type": ActionTarget.SPECIFIC,
            },
        )

    def test_build_rule_action_blob(self) -> None:
        """Test that build_rule_action_blob creates correct MSTeams action data"""
        blob = self.handler.build_rule_action_blob(self.action, self.organization.id)

        assert blob == {
            "id": "sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction",
            "team": "1234567890",
            "channel_id": "channel789",
            "channel": "General Channel",
        }


class TestSlackIssueAlertHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.handler = SlackIssueAlertHandler()
        self.detector = self.create_detector(project=self.project)
        self.action = self.create_action(
            type=Action.Type.SLACK,
            integration_id="1234567890",
            data={"tags": "environment,user", "notes": "Important alert"},
            config={
                "target_identifier": "channel789",
                "target_display": "#general",
                "target_type": ActionTarget.SPECIFIC,
            },
        )

    def test_build_rule_action_blob(self) -> None:
        """Test that build_rule_action_blob creates correct Slack action data"""
        blob = self.handler.build_rule_action_blob(self.action, self.organization.id)

        assert blob == {
            "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
            "workspace": "1234567890",
            "channel_id": "channel789",
            "channel": "#general",
            "tags": "environment,user",
            "notes": "Important alert",
        }

    def test_build_rule_action_blob_no_data(self) -> None:
        """Test that build_rule_action_blob handles missing data"""
        self.action.data = {}
        blob = self.handler.build_rule_action_blob(self.action, self.organization.id)

        assert blob == {
            "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
            "workspace": "1234567890",
            "channel_id": "channel789",
            "channel": "#general",
            "tags": "",
            "notes": "",
        }


class TestPagerDutyIssueAlertHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.handler = PagerDutyIssueAlertHandler()
        self.detector = self.create_detector(project=self.project)
        self.action = self.create_action(
            type=Action.Type.PAGERDUTY,
            integration_id="1234567890",
            config={"target_identifier": "service789", "target_type": ActionTarget.SPECIFIC},
            data={"priority": "default"},
        )

    def test_build_rule_action_blob(self) -> None:
        """Test that build_rule_action_blob creates correct PagerDuty action data"""
        blob = self.handler.build_rule_action_blob(self.action, self.organization.id)

        assert blob == {
            "id": "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
            "account": "1234567890",
            "service": "service789",
            "severity": "default",
        }

    def test_build_rule_action_blob_no_priority(self) -> None:
        """Test that build_rule_action_blob handles missing priority"""
        self.action.data = {}
        blob = self.handler.build_rule_action_blob(self.action, self.organization.id)

        assert blob == {
            "id": "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
            "account": "1234567890",
            "service": "service789",
            "severity": "",
        }


class TestOpsgenieIssueAlertHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.handler = OpsgenieIssueAlertHandler()
        self.detector = self.create_detector(project=self.project)
        self.action = self.create_action(
            type=Action.Type.OPSGENIE,
            integration_id="1234567890",
            config={"target_identifier": "team789", "target_type": ActionTarget.SPECIFIC},
            data={"priority": "P1"},
        )

    def test_build_rule_action_blob(self) -> None:
        """Test that build_rule_action_blob creates correct Opsgenie action data"""
        blob = self.handler.build_rule_action_blob(self.action, self.organization.id)

        assert blob == {
            "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
            "account": "1234567890",
            "team": "team789",
            "priority": "P1",
        }

    def test_build_rule_action_blob_no_priority(self) -> None:
        """Test that build_rule_action_blob handles missing priority"""
        self.action.data = {}
        blob = self.handler.build_rule_action_blob(self.action, self.organization.id)

        assert blob == {
            "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
            "account": "1234567890",
            "team": "team789",
            "priority": "",
        }


class TestTicketingIssueAlertHandlerBase(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(project=self.project)
        self.handler: TicketingIssueAlertHandler

    def _test_build_rule_action_blob(self, expected, action_type: Action.Type):
        action_data = pop_keys_from_data_blob(expected, action_type)
        action = self.create_action(
            type=action_type,
            integration_id=expected["integration"],
            data=self._form_ticketing_action_blob(action_data),
        )
        blob = self.handler.build_rule_action_blob(action, self.organization.id)

        # pop uuid from blob
        # (we don't store it anymore since its a legacy artifact when we didn't have the action model)
        expected.pop("uuid")

        assert blob == {
            "id": expected["id"],
            "integration": expected["integration"],
            **expected,
        }

    def _form_ticketing_action_blob(self, expected):
        dynamic_form_fields, additional_fields = TicketingActionDataBlobHelper.separate_fields(
            expected
        )
        return {"dynamic_form_fields": dynamic_form_fields, "additional_fields": additional_fields}


class TestGithubIssueAlertHandler(TestTicketingIssueAlertHandlerBase):
    def setUp(self) -> None:
        super().setUp()
        self.handler = GithubIssueAlertHandler()

    def test_build_rule_action_blob(self) -> None:
        for expected in GITHUB_ACTION_DATA_BLOBS:
            if expected["id"] == ACTION_FIELD_MAPPINGS[Action.Type.GITHUB]["id"]:
                self._test_build_rule_action_blob(expected, Action.Type.GITHUB)
            else:
                self._test_build_rule_action_blob(expected, Action.Type.GITHUB_ENTERPRISE)


class TestAzureDevopsIssueAlertHandler(TestTicketingIssueAlertHandlerBase):
    def setUp(self) -> None:
        super().setUp()
        self.handler = AzureDevopsIssueAlertHandler()

    def test_build_rule_action_blob(self) -> None:
        for expected in AZURE_DEVOPS_ACTION_DATA_BLOBS:
            self._test_build_rule_action_blob(expected, Action.Type.AZURE_DEVOPS)


class TestJiraIssueAlertHandler(TestTicketingIssueAlertHandlerBase):
    def setUp(self) -> None:
        super().setUp()
        self.handler = JiraIssueAlertHandler()

    def test_build_rule_action_blob(self) -> None:
        for expected in JIRA_ACTION_DATA_BLOBS:
            self._test_build_rule_action_blob(expected, Action.Type.JIRA)


class TestJiraServerIssueAlertHandler(TestTicketingIssueAlertHandlerBase):
    def setUp(self) -> None:
        super().setUp()
        self.handler = JiraServerIssueAlertHandler()

    def test_build_rule_action_blob(self) -> None:
        for expected in JIRA_SERVER_ACTION_DATA_BLOBS:
            self._test_build_rule_action_blob(expected, Action.Type.JIRA_SERVER)


class TestEmailIssueAlertHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.handler = EmailIssueAlertHandler()
        self.detector = self.create_detector(project=self.project)
        # These are the actions that are healed from the old email action data blobs
        # It removes targetIdentifier for IssueOwner targets (since that shouldn't be set for those)
        # It also removes the fallthrough_type for Team and Member targets (since that shouldn't be set for those)
        self.HEALED_EMAIL_ACTION_DATA_BLOBS = [
            # IssueOwners (targetIdentifier is "None")
            {
                "targetType": ActionTargetType.ISSUE_OWNERS.value,
                "id": "sentry.mail.actions.NotifyEmailAction",
                "fallthrough_type": FallthroughChoiceType.ACTIVE_MEMBERS,
            },
            # NoOne Fallthrough (targetIdentifier is "")
            {
                "targetType": ActionTargetType.ISSUE_OWNERS.value,
                "id": "sentry.mail.actions.NotifyEmailAction",
                "fallthrough_type": FallthroughChoiceType.NO_ONE,
            },
            # AllMembers Fallthrough (targetIdentifier is None)
            {
                "targetType": ActionTargetType.ISSUE_OWNERS.value,
                "id": "sentry.mail.actions.NotifyEmailAction",
                "fallthrough_type": "AllMembers",
            },
            # NoOne Fallthrough (targetIdentifier is "None")
            {
                "targetType": ActionTargetType.ISSUE_OWNERS.value,
                "id": "sentry.mail.actions.NotifyEmailAction",
                "fallthrough_type": FallthroughChoiceType.NO_ONE,
            },
            # ActiveMembers Fallthrough
            {
                "targetType": ActionTargetType.MEMBER.value,
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "3234013",
            },
            # Member Email
            {
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "2160509",
                "targetType": ActionTargetType.MEMBER.value,
            },
            # Team Email
            {
                "targetType": ActionTargetType.TEAM.value,
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "188022",
            },
        ]

    def test_build_rule_action_blob(self) -> None:
        for expected, healed in zip(EMAIL_ACTION_DATA_BLOBS, self.HEALED_EMAIL_ACTION_DATA_BLOBS):
            action_data = pop_keys_from_data_blob(expected, Action.Type.EMAIL)
            # pop the targetType from the action_data
            target_type = EmailActionHelper.get_target_type_object(action_data.pop("targetType"))
            # Handle all possible targetIdentifier formats
            target_identifier: str | None = str(expected["targetIdentifier"])
            if target_identifier in ("None", "", None):
                target_identifier = None

            action = self.create_action(
                type=Action.Type.EMAIL,
                data=action_data,
                config={
                    "target_type": target_type,
                    "target_identifier": target_identifier,
                },
            )
            blob = self.handler.build_rule_action_blob(action, self.organization.id)
            assert blob == healed


class TestPluginIssueAlertHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.handler = PluginIssueAlertHandler()
        self.detector = self.create_detector(project=self.project)
        self.action = self.create_action(
            type=Action.Type.PLUGIN,
        )

    def test_build_rule_action_blob(self) -> None:
        blob = self.handler.build_rule_action_blob(self.action, self.organization.id)

        assert blob == {
            "id": ACTION_FIELD_MAPPINGS[Action.Type.PLUGIN]["id"],
        }


class TestWebhookIssueAlertHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.handler = WebhookIssueAlertHandler()
        self.detector = self.create_detector(project=self.project)

    def test_build_rule_action_blob(self) -> None:
        for expected in WEBHOOK_ACTION_DATA_BLOBS:
            action = self.create_action(
                type=Action.Type.WEBHOOK, config={"target_identifier": expected["service"]}
            )

            # pop uuid from blob
            expected.pop("uuid")

            blob = self.handler.build_rule_action_blob(action, self.organization.id)

            assert blob == expected


class TestSentryAppIssueAlertHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.handler = SentryAppIssueAlertHandler()
        self.sentry_app = self.create_sentry_app(
            organization=self.organization,
            name="Test Application",
            is_alertable=True,
        )
        self.sentry_app_installation = self.create_sentry_app_installation(
            slug="test-application", organization=self.organization
        )
        self.org2 = self.create_organization()
        self.project2 = self.create_project(organization=self.org2)
        self.sentry_app_installation2 = self.create_sentry_app_installation(
            slug="test-application", organization=self.org2
        )
        self.detector = self.create_detector(project=self.project)
        self.detector2 = self.create_detector(project=self.project2)

    def build_sentry_app_form_config_data_blob(
        self, include_null_label: bool = True
    ) -> list[dict[str, str | None]]:
        blob: list[dict[str, str | None]] = [
            {
                "name": "opsgenieResponders",
                "value": '[{ "id": "8132bcc6-e697-44b2-8b61-c044803f9e6e", "type": "team" }]',
            },
            {"name": "tagsToInclude", "value": "environment", "label": "Tags to Include"},
            {"name": "opsgeniePriority", "value": "P2"},
        ]

        if include_null_label:
            blob[0]["label"] = None

        return blob

    def test_build_rule_action_blob_sentry_app(self) -> None:
        data_blob = self.build_sentry_app_form_config_data_blob()
        cleaned_data_blob = self.build_sentry_app_form_config_data_blob(include_null_label=False)
        target_id = str(self.sentry_app.id)

        # sentry app with settings
        action = self.create_action(
            type=Action.Type.SENTRY_APP,
            data={"settings": data_blob},
            config={
                "target_identifier": target_id,
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
                "target_type": ActionTarget.SENTRY_APP.value,
            },
        )
        blob = self.handler.build_rule_action_blob(action, self.organization.id)

        assert blob == {
            "id": ACTION_FIELD_MAPPINGS[Action.Type.SENTRY_APP]["id"],
            "settings": cleaned_data_blob,
            "sentryAppInstallationUuid": self.sentry_app_installation.uuid,
        }

        action_1_uuid = blob["sentryAppInstallationUuid"]

        action = self.create_action(
            type=Action.Type.SENTRY_APP,
            data={
                "settings": data_blob,
            },
            config={
                "target_identifier": target_id,
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
                "target_type": ActionTarget.SENTRY_APP.value,
            },
        )
        blob = self.handler.build_rule_action_blob(action, self.org2.id)

        assert blob == {
            "id": ACTION_FIELD_MAPPINGS[Action.Type.SENTRY_APP]["id"],
            "settings": cleaned_data_blob,
            "sentryAppInstallationUuid": self.sentry_app_installation2.uuid,
        }

        action_2_uuid = blob["sentryAppInstallationUuid"]

        # Both orgs should have different sentry app installations
        assert action_1_uuid != action_2_uuid

    def test_build_rule_action_blob_sentry_app_sentry_app_installation_uuid(self) -> None:
        data_blob = self.build_sentry_app_form_config_data_blob()
        cleaned_data_blob = self.build_sentry_app_form_config_data_blob(include_null_label=False)

        # sentry app with settings
        action = self.create_action(
            type=Action.Type.SENTRY_APP,
            data={"settings": data_blob},
            config={
                "target_identifier": self.sentry_app_installation.uuid,
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_INSTALLATION_UUID,
                "target_type": ActionTarget.SENTRY_APP.value,
            },
        )
        blob = self.handler.build_rule_action_blob(action, self.organization.id)

        assert blob == {
            "id": ACTION_FIELD_MAPPINGS[Action.Type.SENTRY_APP]["id"],
            "settings": cleaned_data_blob,
            "sentryAppInstallationUuid": self.sentry_app_installation.uuid,
        }

        action_1_uuid = blob["sentryAppInstallationUuid"]

        action = self.create_action(
            type=Action.Type.SENTRY_APP,
            data={
                "settings": data_blob,
            },
            config={
                "target_identifier": self.sentry_app_installation2.uuid,
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_INSTALLATION_UUID,
                "target_type": ActionTarget.SENTRY_APP.value,
            },
        )
        blob = self.handler.build_rule_action_blob(action, self.org2.id)

        assert blob == {
            "id": ACTION_FIELD_MAPPINGS[Action.Type.SENTRY_APP]["id"],
            "settings": cleaned_data_blob,
            "sentryAppInstallationUuid": self.sentry_app_installation2.uuid,
        }

        action_2_uuid = blob["sentryAppInstallationUuid"]

        # Both orgs should have different sentry app installations
        assert action_1_uuid != action_2_uuid

    def test_build_rule_action_blob_sentry_app_no_settings(self) -> None:
        target_id = str(self.sentry_app.id)

        action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": target_id,
                "target_type": ActionTarget.SENTRY_APP.value,
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
            },
        )

        # sentry app with no settings
        blob = self.handler.build_rule_action_blob(action, self.organization.id)

        assert blob == {
            "id": ACTION_FIELD_MAPPINGS[Action.Type.SENTRY_APP]["id"],
            "sentryAppInstallationUuid": self.sentry_app_installation.uuid,
        }

        action_1_uuid = blob["sentryAppInstallationUuid"]

        action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": target_id,
                "target_type": ActionTarget.SENTRY_APP.value,
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
            },
        )
        blob = self.handler.build_rule_action_blob(action, self.org2.id)

        assert blob == {
            "id": ACTION_FIELD_MAPPINGS[Action.Type.SENTRY_APP]["id"],
            "sentryAppInstallationUuid": self.sentry_app_installation2.uuid,
        }

        action_2_uuid = blob["sentryAppInstallationUuid"]

        # Both orgs should have different sentry app installations
        assert action_1_uuid != action_2_uuid


class TestInvokeFutureWithErrorHandling(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.group, self.event, self.group_event = self.create_group_event()
        self.event_data = WorkflowEventData(
            event=self.group_event, workflow_env=self.environment, group=self.group
        )

        self.mock_callback = mock.Mock()
        self.mock_futures = [mock.Mock()]

    def test_happy_path(self):
        from sentry.notifications.notification_action.types import invoke_future_with_error_handling

        invoke_future_with_error_handling(self.event_data, self.mock_callback, self.mock_futures)

        self.mock_callback.assert_called_once_with(self.group_event, self.mock_futures)

    def test_invalid_event_data(self):
        from sentry.notifications.notification_action.types import invoke_future_with_error_handling
        from sentry.workflow_engine.types import WorkflowEventData

        invalid_event_data = WorkflowEventData(
            event=mock.Mock(), workflow_env=self.environment, group=self.group
        )

        with pytest.raises(AssertionError) as excinfo:
            invoke_future_with_error_handling(
                invalid_event_data, self.mock_callback, self.mock_futures
            )

        assert "Expected a GroupEvent" in str(excinfo.value)

    def test_ignores_integration_form_error(self):
        from sentry.notifications.notification_action.types import invoke_future_with_error_handling
        from sentry.shared_integrations.exceptions import IntegrationFormError

        self.mock_callback.side_effect = IntegrationFormError(
            field_errors={"foo": "Test form error"}
        )

        invoke_future_with_error_handling(self.event_data, self.mock_callback, self.mock_futures)

        self.mock_callback.assert_called_once()

    def test_ignores_integration_configuration_error(self):
        from sentry.notifications.notification_action.types import invoke_future_with_error_handling
        from sentry.shared_integrations.exceptions import IntegrationConfigurationError

        self.mock_callback.side_effect = IntegrationConfigurationError("Test config error")

        invoke_future_with_error_handling(self.event_data, self.mock_callback, self.mock_futures)

        self.mock_callback.assert_called_once()

    def test_reraises_processing_deadline_exceeded(self):
        from sentry.notifications.notification_action.types import invoke_future_with_error_handling
        from sentry.taskworker.workerchild import ProcessingDeadlineExceeded

        self.mock_callback.side_effect = ProcessingDeadlineExceeded("Deadline exceeded")

        with pytest.raises(ProcessingDeadlineExceeded):
            invoke_future_with_error_handling(
                self.event_data, self.mock_callback, self.mock_futures
            )

        self.mock_callback.assert_called_once()

    def test_raises_retry_error_for_api_error(self):
        from sentry.notifications.notification_action.types import invoke_future_with_error_handling
        from sentry.shared_integrations.exceptions import ApiError
        from sentry.taskworker.retry import RetryTaskError

        self.mock_callback.side_effect = ApiError("API error", 500)

        with pytest.raises(RetryTaskError) as excinfo:
            invoke_future_with_error_handling(
                self.event_data, self.mock_callback, self.mock_futures
            )

        assert isinstance(excinfo.value.__cause__, ApiError)
        self.mock_callback.assert_called_once()

    @mock.patch("logging.getLogger")
    def test_safe_execute_exception_handling(self, mock_get_logger):
        from sentry.notifications.notification_action.types import invoke_future_with_error_handling

        mock_localized_logger = mock.Mock()
        mock_get_logger.return_value = mock_localized_logger

        test_exception = ValueError("Generic test error")

        class TestCallbackClass:
            def __call__(self, event, futures):  # noqa: ARG002
                raise test_exception

            @property
            def __name__(self):
                return "test_callback"

        failing_callback = TestCallbackClass()

        invoke_future_with_error_handling(self.event_data, failing_callback, self.mock_futures)

        mock_get_logger.assert_called_once_with("sentry.safe_action.testcallbackclass")

        mock_localized_logger.exception.assert_called_once_with(
            "%s.process_error", "test_callback", extra={"exception": test_exception}
        )

    @mock.patch("logging.getLogger")
    def test_generic_exception_with_no_name_attribute(self, mock_get_logger):
        from sentry.notifications.notification_action.types import invoke_future_with_error_handling

        mock_localized_logger = mock.Mock()
        mock_get_logger.return_value = mock_localized_logger

        test_exception = Exception("Test error")

        class CallableWithoutName:
            def __call__(self, event, futures):  # noqa: ARG002
                raise test_exception

        callback_without_name = CallableWithoutName()
        callback_without_name.__class__.__name__ = "CallbackWithoutName"

        invoke_future_with_error_handling(self.event_data, callback_without_name, self.mock_futures)

        mock_get_logger.assert_called_once_with("sentry.safe_action.callbackwithoutname")

        expected_func_name = str(callback_without_name)
        mock_localized_logger.exception.assert_called_once_with(
            "%s.process_error", expected_func_name, extra={"exception": test_exception}
        )

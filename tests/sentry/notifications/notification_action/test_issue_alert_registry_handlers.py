import uuid
from unittest import mock

import pytest

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
    RuleData,
    TicketingIssueAlertHandler,
)
from sentry.notifications.types import (
    TEST_NOTIFICATION_ID,
    ActionTargetType,
    FallthroughChoiceType,
    NotificationActionContext,
)
from sentry.testutils.helpers.data_blobs import (
    AZURE_DEVOPS_ACTION_DATA_BLOBS,
    EMAIL_ACTION_DATA_BLOBS,
    GITHUB_ACTION_DATA_BLOBS,
    JIRA_ACTION_DATA_BLOBS,
    JIRA_SERVER_ACTION_DATA_BLOBS,
    WEBHOOK_ACTION_DATA_BLOBS,
)
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from sentry.workflow_engine.typings.notification_action import (
    ACTION_FIELD_MAPPINGS,
    EXCLUDED_ACTION_DATA_KEYS,
    ActionFieldMapping,
    ActionFieldMappingKeys,
    EmailActionHelper,
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

        class TestHandler(BaseIssueAlertHandler):
            @classmethod
            def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping):
                return {"tags": "environment,user,my_tag"}

            @classmethod
            def get_target_display(cls, action: Action, mapping: ActionFieldMapping):
                return {}

        self.handler = TestHandler()

    def create_context_and_data(
        self,
        *,
        event_data: WorkflowEventData | None = None,
        workflow_id: int | None = None,
    ) -> tuple[NotificationActionContext, RuleData]:
        context = self.handler.create_action_context(
            self.action,
            self.detector,
            event_data or self.event_data,
            workflow_id=self.workflow.id if workflow_id is None else workflow_id,
        )
        data = self.handler.build_rule_data_from_action(self.action, self.detector, context.origin)
        return context, data

    def test_create_rule_instance_from_action_missing_properties_raises_value_error(self) -> None:
        class TestHandler(BaseIssueAlertHandler):
            @classmethod
            def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping):
                return {"tags": "environment,user,my_tag"}

        handler = TestHandler()
        with pytest.raises(ValueError):
            context = handler.create_action_context(
                self.action, self.detector, self.event_data, workflow_id=self.workflow.id
            )
            handler.build_rule_data_from_action(self.action, self.detector, context.origin)

    def test_create_action_context(self) -> None:
        context, data = self.create_context_and_data()

        assert context.action_id == self.action.id
        assert context.project == self.detector.project
        assert context.origin.environment_id is not None
        assert self.workflow.environment is not None
        assert context.origin.environment_id == self.workflow.environment.id
        assert context.origin.label == self.workflow.name
        assert data == {
            "actions": [
                {
                    "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                    "server": "1234567890",
                    "channel_id": "channel456",
                    "tags": "environment,user,my_tag",
                }
            ],
        }

    def test_create_notification_origin(self) -> None:
        origin = self.handler.create_notification_origin(
            self.detector, self.event_data, workflow_id=self.workflow.id
        )

        assert origin.label == self.workflow.name
        assert self.workflow.environment is not None
        assert origin.environment_id == self.workflow.environment.id
        assert origin.workflow_id == self.workflow.id
        assert origin.legacy_rule_id == self.rule.id

    def test_create_action_context_with_workflow_only(self) -> None:
        self.rule.delete()
        context, data = self.create_context_and_data()

        assert context.action_id == self.action.id
        assert context.project == self.detector.project
        assert context.origin.environment_id is not None
        assert self.workflow.environment is not None
        assert context.origin.environment_id == self.workflow.environment.id
        assert context.origin.label == self.workflow.name
        assert data == {
            "actions": [
                {
                    "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                    "server": "1234567890",
                    "channel_id": "channel456",
                    "tags": "environment,user,my_tag",
                }
            ]
        }

    def test_create_action_context_deleted_workflow_falls_back_to_detector_name(
        self,
    ) -> None:
        """Test that label falls back to detector.name when the workflow no longer exists"""
        workflow_id = self.workflow.id
        self.workflow.delete()
        context, data = self.create_context_and_data(workflow_id=workflow_id)

        assert context.origin.label == self.detector.name
        assert data == {
            "actions": [
                {
                    "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                    "server": "1234567890",
                    "channel_id": "channel456",
                    "tags": "environment,user,my_tag",
                }
            ]
        }

    def test_action_context_uses_workflow_name_not_stale_rule_label(
        self,
    ) -> None:
        self.workflow.update(name="Renamed Alert Name")
        context, _ = self.create_context_and_data()
        assert context.origin.label == "Renamed Alert Name"
        assert context.origin.label != self.rule.label  # legacy rule label is still "Test Alert"

    def test_create_action_context_with_test_notification_id(self) -> None:
        """Test that Workflow lookup is skipped for test notifications, falling back to detector name"""
        context, data = self.create_context_and_data(workflow_id=TEST_NOTIFICATION_ID)

        assert context.origin.label == self.detector.name
        assert data == {
            "actions": [
                {
                    "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                    "server": "1234567890",
                    "channel_id": "channel456",
                    "tags": "environment,user,my_tag",
                }
            ],
        }

    def test_create_action_context_no_environment(self) -> None:
        self.create_workflow()
        job = WorkflowEventData(event=self.group_event, workflow_env=None, group=self.group)
        context, data = self.create_context_and_data(event_data=job)

        assert context.action_id == self.action.id
        assert context.project == self.detector.project
        assert context.origin.environment_id is None
        assert context.origin.label == self.workflow.name
        assert data == {
            "actions": [
                {
                    "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
                    "server": "1234567890",
                    "channel_id": "channel456",
                    "tags": "environment,user,my_tag",
                }
            ],
        }

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

        notification_uuid = str(uuid.uuid4())

        invocation = ActionInvocation(
            event_data=self.event_data,
            action=self.action,
            detector=self.detector,
            notification_uuid=notification_uuid,
            workflow_id=self.workflow.id,
        )

        self.handler.invoke_legacy_registry(invocation)

        # Verify activate_downstream_actions called with correct args
        mock_activate_downstream_actions.assert_called_once_with(
            mock.ANY,
            mock.ANY,
            self.event_data.event,
            "12345678-1234-5678-1234-567812345678",
        )
        context, actions, _, _ = mock_activate_downstream_actions.call_args.args
        assert isinstance(context, NotificationActionContext)
        assert context.action_id == self.action.id
        assert context.origin.workflow_id == self.workflow.id
        assert context.origin.legacy_rule_id == self.rule.id
        assert actions[0]["id"] == (
            "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction"
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

    @mock.patch("sentry.integrations.opsgenie.client.logger")
    @mock.patch("sentry.integrations.opsgenie.client.OpsgenieClient.send_notification")
    def test_invoke_legacy_registry_links_to_workflow(
        self, mock_send_notification: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        """
        The workflow engine is the only path into the Opsgenie issue alert payload,
        and every non-test invocation should carry its workflow id through to it.
        """
        integration = self.create_integration(
            organization=self.organization,
            external_id="test-app",
            provider="opsgenie",
            name="test-app",
            metadata={
                "api_key": "1234-ABCD",
                "base_url": "https://api.opsgenie.com/",
                "domain_name": "test-app.app.opsgenie.com",
            },
            oi_params={
                "config": {
                    "team_table": [
                        {"id": "team789", "integration_key": "1234-ABCD", "team": "default team"},
                    ]
                },
            },
        )
        action = self.create_action(
            type=Action.Type.OPSGENIE,
            integration_id=integration.id,
            config={"target_identifier": "team789", "target_type": ActionTarget.SPECIFIC},
            data={"priority": "P1"},
        )
        workflow = self.create_workflow()
        # A dual-written legacy rule means the Rule also carries a legacy_rule_id.
        legacy_rule = self.create_project_rule(project=self.project)
        self.create_alert_rule_workflow(workflow=workflow, rule_id=legacy_rule.id)
        group, _, group_event = self.create_group_event()
        invocation = ActionInvocation(
            event_data=WorkflowEventData(event=group_event, group=group),
            action=action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=workflow.id,
        )

        with self.options({"system.url-prefix": "http://example.com"}):
            self.handler.invoke_legacy_registry(invocation)

        mock_send_notification.assert_called_once()
        details = mock_send_notification.call_args.kwargs["data"]["details"]
        assert details["Triggering Workflows"] == workflow.name
        assert (
            details["Triggering Workflow URLs"]
            == f"http://example.com/organizations/{self.organization.slug}/monitors/alerts/{workflow.id}/"
        )
        mock_logger.warning.assert_not_called()


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

            # Convert fallthroughType (camelCase) to fallthrough_type (snake_case)
            # to match the Action data schema
            if "fallthroughType" in action_data:
                action_data["fallthrough_type"] = action_data.pop("fallthroughType")

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

    def test_happy_path(self) -> None:
        from sentry.notifications.notification_action.types import invoke_future_with_error_handling

        invoke_future_with_error_handling(self.event_data, self.mock_callback, self.mock_futures)

        self.mock_callback.assert_called_once_with(self.group_event, self.mock_futures)

    def test_invalid_event_data(self) -> None:
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

    def test_ignores_integration_form_error(self) -> None:
        from sentry.notifications.notification_action.types import invoke_future_with_error_handling
        from sentry.shared_integrations.exceptions import IntegrationFormError

        self.mock_callback.side_effect = IntegrationFormError(
            field_errors={"foo": "Test form error"}
        )

        invoke_future_with_error_handling(self.event_data, self.mock_callback, self.mock_futures)

        self.mock_callback.assert_called_once()

    def test_ignores_integration_configuration_error(self) -> None:
        from sentry.notifications.notification_action.types import invoke_future_with_error_handling
        from sentry.shared_integrations.exceptions import IntegrationConfigurationError

        self.mock_callback.side_effect = IntegrationConfigurationError("Test config error")

        invoke_future_with_error_handling(self.event_data, self.mock_callback, self.mock_futures)

        self.mock_callback.assert_called_once()

    def test_reraises_processing_deadline_exceeded(self) -> None:
        from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

        from sentry.notifications.notification_action.types import invoke_future_with_error_handling

        self.mock_callback.side_effect = ProcessingDeadlineExceeded("Deadline exceeded")

        with pytest.raises(ProcessingDeadlineExceeded):
            invoke_future_with_error_handling(
                self.event_data, self.mock_callback, self.mock_futures
            )

        self.mock_callback.assert_called_once()

    def test_raises_retry_error_for_api_error(self) -> None:
        from taskbroker_client.retry import RetryTaskError

        from sentry.notifications.notification_action.types import invoke_future_with_error_handling
        from sentry.shared_integrations.exceptions import ApiError

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

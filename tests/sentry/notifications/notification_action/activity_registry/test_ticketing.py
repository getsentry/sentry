from unittest import mock

import pytest

from sentry.integrations.models.external_issue import ExternalIssue
from sentry.models.grouplink import GroupLink
from sentry.notifications.notification_action.activity_registry.ticketing import (
    TicketingActivityHandler,
)
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

TICKETING_ACTION_TYPES = [
    Action.Type.GITHUB,
    Action.Type.GITHUB_ENTERPRISE,
    Action.Type.JIRA,
    Action.Type.JIRA_SERVER,
    Action.Type.AZURE_DEVOPS,
]


@pytest.mark.parametrize("action_type", TICKETING_ACTION_TYPES)
def test_ticketing_registrations(action_type: Action.Type) -> None:
    assert activity_handler_registry.get(action_type) is TicketingActivityHandler


class TestTicketingActivityHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.workflow, self.detector, _, _ = self.create_detector_and_workflow()
        self.integration = self.create_integration(
            organization=self.organization, provider="github", external_id="gh_ext_id"
        )
        self.action = self.create_action(
            type=Action.Type.GITHUB,
            integration_id=self.integration.id,
            data={
                "dynamic_form_fields": [],
                "additional_fields": {"repo": "org/repo"},
            },
            config={
                "target_identifier": None,
                "target_display": None,
                "target_type": 0,
            },
        )

    def _create_invocation(self, activity):
        return self.create_action_invocation(
            event=activity,
            group=self.group,
            action=self.action,
            detector=self.detector,
            workflow_id=self.workflow.id,
        )

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.ticketing.integration_service"
    )
    def test_invoke_action_creates_ticket(self, mock_integration_service):
        mock_integration = mock.MagicMock()
        mock_integration.id = self.integration.id
        mock_integration.provider = "github"
        mock_integration_service.get_integration.return_value = mock_integration

        mock_installation = mock.MagicMock()
        mock_installation.__class__ = type(
            "MockInstallation",
            (mock.MagicMock.__class__,),
            {},
        )
        mock_installation.get_group_link.return_value = [
            f"Sentry Issue: [{self.group.qualified_short_id}](http://testserver)"
        ]
        mock_installation.create_issue.return_value = {
            "key": "GH-123",
            "title": "Test Issue",
            "url": "https://github.com/org/repo/issues/123",
        }
        mock_installation.make_external_key.return_value = "GH-123"
        mock_installation.get_issue_url.return_value = "https://github.com/org/repo/issues/123"
        mock_installation.get_issue_display_name.return_value = ""
        mock_installation.model.get_provider.return_value.name = "github"
        mock_integration.get_installation.return_value = mock_installation

        # Make isinstance check pass for IssueBasicIntegration
        with mock.patch(
            "sentry.notifications.notification_action.activity_registry.ticketing.isinstance",
            return_value=True,
        ):
            activity = self.create_group_activity(
                group=self.group,
                type=ActivityType.SET_RESOLVED.value,
            )
            invocation = self._create_invocation(activity)
            TicketingActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_installation.create_issue.assert_called_once()
        call_data = mock_installation.create_issue.call_args[0][0]
        assert call_data["title"] == self.group.title

        assert ExternalIssue.objects.filter(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            key="GH-123",
        ).exists()

        assert GroupLink.objects.filter(
            group_id=self.group.id,
            project_id=self.group.project_id,
            linked_type=GroupLink.LinkedType.issue,
        ).exists()

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.ticketing.integration_service"
    )
    def test_invoke_action_skips_when_link_exists(self, mock_integration_service):
        mock_integration = mock.MagicMock()
        mock_integration.id = self.integration.id
        mock_integration.provider = "github"
        mock_integration_service.get_integration.return_value = mock_integration

        mock_installation = mock.MagicMock()
        mock_installation.get_group_link.return_value = ["Sentry Issue"]
        mock_integration.get_installation.return_value = mock_installation

        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            key="GH-EXISTING",
        )
        GroupLink.objects.create(
            group_id=self.group.id,
            project_id=self.group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        with mock.patch(
            "sentry.notifications.notification_action.activity_registry.ticketing.isinstance",
            return_value=True,
        ):
            activity = self.create_group_activity(
                group=self.group,
                type=ActivityType.SET_RESOLVED.value,
            )
            invocation = self._create_invocation(activity)
            TicketingActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_installation.create_issue.assert_not_called()

    @mock.patch("sentry.notifications.notification_action.activity_registry.ticketing.logger")
    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.ticketing.integration_service"
    )
    def test_invoke_action_returns_when_integration_not_found(
        self, mock_integration_service, mock_logger
    ):
        mock_integration_service.get_integration.return_value = None

        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
        )
        invocation = self._create_invocation(activity)
        TicketingActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_logger.warning.assert_called_once_with(
            "notification_action.activity.ticketing.integration_not_found",
            extra=mock.ANY,
        )

    def test_invoke_action_raises_when_no_integration_id(self):
        action_no_integration = self.create_action(
            type=Action.Type.GITHUB,
            integration_id=None,
            data={
                "dynamic_form_fields": [],
                "additional_fields": {"repo": "org/repo"},
            },
            config={
                "target_identifier": None,
                "target_display": None,
                "target_type": 0,
            },
        )
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
        )
        invocation = self.create_action_invocation(
            event=activity,
            group=self.group,
            action=action_no_integration,
            detector=self.detector,
            workflow_id=self.workflow.id,
        )
        with pytest.raises(ValueError, match="No integration_id"):
            TicketingActivityHandler.invoke_action(invocation=invocation, activity=activity)

    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.ticketing.integration_service"
    )
    def test_invoke_action_includes_additional_fields(self, mock_integration_service):
        action_with_data = self.create_action(
            type=Action.Type.JIRA,
            integration_id=self.integration.id,
            data={
                "dynamic_form_fields": [],
                "additional_fields": {"project": "PROJ", "issuetype": "Bug"},
            },
            config={
                "target_identifier": None,
                "target_display": None,
                "target_type": 0,
            },
        )

        mock_integration = mock.MagicMock()
        mock_integration.id = self.integration.id
        mock_integration.provider = "jira"
        mock_integration_service.get_integration.return_value = mock_integration

        mock_installation = mock.MagicMock()
        mock_installation.get_group_link.return_value = ["Sentry Issue"]
        mock_installation.create_issue.return_value = {
            "key": "PROJ-1",
            "title": "Test",
            "url": "https://jira.example.com/PROJ-1",
        }
        mock_installation.make_external_key.return_value = "PROJ-1"
        mock_installation.get_issue_url.return_value = "https://jira.example.com/PROJ-1"
        mock_installation.get_issue_display_name.return_value = ""
        mock_installation.model.get_provider.return_value.name = "jira"
        mock_integration.get_installation.return_value = mock_installation

        with mock.patch(
            "sentry.notifications.notification_action.activity_registry.ticketing.isinstance",
            return_value=True,
        ):
            activity = self.create_group_activity(
                group=self.group,
                type=ActivityType.SET_RESOLVED.value,
            )
            invocation = self.create_action_invocation(
                event=activity,
                group=self.group,
                action=action_with_data,
                detector=self.detector,
                workflow_id=self.workflow.id,
            )
            TicketingActivityHandler.invoke_action(invocation=invocation, activity=activity)

        call_data = mock_installation.create_issue.call_args[0][0]
        assert call_data["project"] == "PROJ"
        assert call_data["issuetype"] == "Bug"

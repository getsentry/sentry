from unittest import mock

import pytest

from sentry.integrations.github.integration import GitHubIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.models.activity import Activity
from sentry.models.grouplink import GroupLink
from sentry.models.repository import Repository
from sentry.notifications.notification_action.activity_registry.ticketing import (
    TicketingActivityHandler,
)
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


@pytest.mark.parametrize(
    "action_type",
    [
        Action.Type.GITHUB,
        Action.Type.GITHUB_ENTERPRISE,
        Action.Type.JIRA,
        Action.Type.JIRA_SERVER,
        Action.Type.AZURE_DEVOPS,
    ],
)
def test_ticketing_registrations(action_type: Action.Type) -> None:
    assert activity_handler_registry.get(action_type) is TicketingActivityHandler


@pytest.mark.parametrize(
    "activity_type",
    [
        ActivityType.SEER_RCA_COMPLETED,
        ActivityType.SEER_SOLUTION_COMPLETED,
        ActivityType.SEER_CODING_COMPLETED,
        ActivityType.SEER_PR_CREATED,
    ],
)
def test_activity_compatibility(activity_type: ActivityType) -> None:
    assert activity_type in TicketingActivityHandler.compatible_activity_types


class TestTicketingActivityHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.workflow, self.detector, _, _ = self.create_detector_and_workflow()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="gh_ext_id",
            name="getsentry",
        )
        self.repo = Repository.objects.create(
            name="getsentry/sentry",
            provider="integrations:github",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
        )
        self.action = self.create_action(
            type=Action.Type.GITHUB,
            integration_id=self.integration.id,
            data={"additional_fields": {"repo": "getsentry/sentry"}},
            config={
                "target_identifier": None,
                "target_display": None,
                "target_type": 0,
            },
        )
        self.activity = self.create_group_activity(
            group=self.group, type=ActivityType.SEER_CODING_COMPLETED.value
        )

    def _create_invocation(self, activity: Activity) -> ActionInvocation:
        return self.create_action_invocation(
            event=activity,
            group=self.group,
            action=self.action,
            detector=self.detector,
            workflow_id=self.workflow.id,
        )

    def _mock_github_create_issue(self, number: int = 321) -> mock.MagicMock:
        """Mock only the HTTP-calling create_issue method on the real GitHubIntegration."""
        return mock.patch.object(
            GitHubIntegration,
            "create_issue",
            return_value={
                "key": number,
                "title": "ignored",
                "url": f"https://github.com/getsentry/sentry/issues/{number}",
                "repo": "getsentry/sentry",
            },
        )

    def test_invoke_action_creates_ticket(self) -> None:
        with self._mock_github_create_issue() as mock_create:
            TicketingActivityHandler.invoke_action(
                invocation=self._create_invocation(self.activity), activity=self.activity
            )

        call_data = mock_create.call_args.args[0]
        assert call_data["title"] == f"[Code Changes] {self.group.title}"
        assert "Sentry Issue:" in call_data["description"]

        external_issue = ExternalIssue.objects.get(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
        )
        assert external_issue.key == "getsentry/sentry#321"
        assert external_issue.title == f"[Code Changes] {self.group.title}"

        group_link = GroupLink.objects.get(
            group_id=self.group.id,
            project_id=self.group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
        )
        assert group_link.relationship == GroupLink.Relationship.references

        create_issue_activity = Activity.objects.get(
            group_id=self.group.id, type=ActivityType.CREATE_ISSUE.value
        )
        assert create_issue_activity.data == {
            "title": f"[Code Changes] {self.group.title}",
            "provider": "GitHub",
            "location": "https://github.com/getsentry/sentry/issues/321",
            "label": "getsentry/sentry#321",
            "new": True,
        }

    def test_invoke_action_only_creates_one_ticket(self) -> None:
        with self._mock_github_create_issue() as mock_create:
            invocation = self._create_invocation(self.activity)
            TicketingActivityHandler.invoke_action(invocation=invocation, activity=self.activity)
            TicketingActivityHandler.invoke_action(invocation=invocation, activity=self.activity)

        mock_create.assert_called_once()
        assert ExternalIssue.objects.count() == 1
        assert (
            Activity.objects.filter(
                group_id=self.group.id, type=ActivityType.CREATE_ISSUE.value
            ).count()
            == 1
        )

    @mock.patch("sentry.notifications.notification_action.activity_registry.ticketing.logger")
    @mock.patch(
        "sentry.notifications.notification_action.activity_registry.ticketing.integration_service"
    )
    def test_invoke_action_returns_when_integration_not_found(
        self, mock_integration_service: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        mock_integration_service.get_integration.return_value = None

        TicketingActivityHandler.invoke_action(
            invocation=self._create_invocation(self.activity), activity=self.activity
        )

        mock_logger.warning.assert_called_once_with(
            "notification_action.activity.ticketing.integration_not_found",
            extra=mock.ANY,
        )

    def test_invoke_action_raises_when_no_integration_id(self) -> None:
        self.action.integration_id = None

        with pytest.raises(ValueError, match="No integration_id"):
            TicketingActivityHandler.invoke_action(
                invocation=self._create_invocation(self.activity), activity=self.activity
            )

    def test_invoke_action_includes_additional_fields(self) -> None:
        self.action.data = {
            "additional_fields": {
                "repo": "getsentry/sentry",
                "project": "PROJ",
                "issuetype": "Bug",
            },
        }

        with self._mock_github_create_issue() as mock_create:
            TicketingActivityHandler.invoke_action(
                invocation=self._create_invocation(self.activity), activity=self.activity
            )

        call_data = mock_create.call_args.args[0]
        assert call_data["project"] == "PROJ"
        assert call_data["issuetype"] == "Bug"

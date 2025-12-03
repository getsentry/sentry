from unittest import mock

import sentry_sdk

from sentry.integrations.jira.integration import JiraIntegration
from sentry.integrations.pagerduty.client import PagerDutyClient
from sentry.integrations.pagerduty.utils import PagerDutyServiceDict, add_service
from sentry.integrations.slack.utils.channel import SlackChannelIdData
from sentry.models.project import Project
from sentry.notifications.notification_action.group_type_notification_registry import (
    IssueAlertRegistryHandler,
)
from sentry.notifications.notification_action.issue_alert_registry import (
    PagerDutyIssueAlertHandler,
    PluginIssueAlertHandler,
)
from sentry.rules.actions.notify_event import NotifyEventAction
from sentry.shared_integrations.exceptions import IntegrationFormError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

pytestmark = [requires_snuba]


class TestFireActionsEndpointTest(APITestCase, BaseWorkflowTest):
    endpoint = "sentry-api-0-organization-test-fire-actions"
    method = "POST"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.project = self.create_project(organization=self.organization)
        self.detector = self.create_detector(project=self.project)
        self.issue_stream_detector = self.create_detector(
            project=self.project, type=IssueStreamGroupType.slug
        )
        self.workflow = self.create_workflow()

    def setup_pd_service(self) -> PagerDutyServiceDict:
        service_info = {
            "type": "service",
            "integration_key": "PND123",
            "service_name": "Sentry Service",
        }
        _integration, org_integration = self.create_provider_integration_for(
            provider="pagerduty",
            name="Example PagerDuty",
            external_id="example-pd",
            metadata={"services": [service_info]},
            organization=self.organization,
            user=self.user,
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            return add_service(
                org_integration,
                service_name=service_info["service_name"],
                integration_key=service_info["integration_key"],
            )

    @mock.patch.object(PagerDutyClient, "send_trigger")
    @mock.patch(
        "sentry.notifications.notification_action.registry.group_type_notification_registry.get",
        return_value=IssueAlertRegistryHandler,
    )
    @mock.patch(
        "sentry.notifications.notification_action.registry.issue_alert_handler_registry.get",
        return_value=PagerDutyIssueAlertHandler,
    )
    def test_pagerduty_action(
        self,
        mock_get_issue_alert_handler: mock.MagicMock,
        mock_get_group_type_handler: mock.MagicMock,
        mock_send_trigger: mock.MagicMock,
    ) -> None:
        """Test a PagerDuty action"""
        service_info = self.setup_pd_service()

        action_data = [
            {
                "type": Action.Type.PAGERDUTY.value,
                "integration_id": service_info["integration_id"],
                "data": {
                    "priority": "info",
                },
                "config": {
                    "target_identifier": str(service_info["id"]),
                    "target_type": "specific",
                },
            }
        ]

        response = self.get_success_response(self.organization.slug, actions=action_data)
        assert response.status_code == 200
        assert mock_send_trigger.call_count == 1
        pagerduty_data = mock_send_trigger.call_args.kwargs.get("data")
        assert pagerduty_data is not None
        assert pagerduty_data["payload"]["summary"].startswith(f"[{self.detector.name}]:")

    @mock.patch.object(NotifyEventAction, "after")
    @mock.patch(
        "sentry.notifications.notification_action.registry.group_type_notification_registry.get",
        return_value=IssueAlertRegistryHandler,
    )
    @mock.patch(
        "sentry.notifications.notification_action.registry.issue_alert_handler_registry.get",
        return_value=PluginIssueAlertHandler,
    )
    def test_plugin_notify_event_action(
        self,
        mock_get_issue_alert_handler: mock.MagicMock,
        mock_get_group_type_handler: mock.MagicMock,
        mock_after: mock.MagicMock,
    ) -> None:
        """Test a Plugin action (NotifyEventAction)"""
        action_data = [
            {
                "type": Action.Type.PLUGIN.value,
                "data": {},
                "config": {},
            }
        ]

        response = self.get_success_response(self.organization.slug, actions=action_data)
        assert response.status_code == 200
        assert mock_after.called

    @mock.patch.object(JiraIntegration, "create_issue")
    @mock.patch.object(sentry_sdk, "capture_exception")
    def test_action_with_integration_form_error(
        self, mock_sdk_capture: mock.MagicMock, mock_create_issue: mock.MagicMock
    ) -> None:
        """Test that integration form errors are returned correctly"""
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.jira_integration = self.create_provider_integration(
                provider="jira", name="Jira", external_id="jira:1"
            )
            self.jira_integration.add_organization(self.organization, self.user)

        form_errors = {"broken": "something went wrong"}
        mock_create_issue.side_effect = IntegrationFormError(form_errors)
        mock_sdk_capture.return_value = "abc-1234"

        action_data = [
            {
                "type": Action.Type.JIRA.value,
                "integration_id": self.jira_integration.id,
                "data": {
                    "dynamic_form_fields": [
                        {
                            "fake_field": "fake_value",
                        }
                    ],
                },
                "config": {"target_type": "specific"},
            }
        ]

        response = self.get_error_response(self.organization.slug, actions=action_data)

        assert response.status_code == 400
        assert response.data == {"actions": [str(form_errors)]}
        assert mock_create_issue.call_count == 1

    @mock.patch.object(JiraIntegration, "create_issue")
    @mock.patch.object(sentry_sdk, "capture_exception")
    def test_action_with_unexpected_error(
        self, mock_sdk_capture: mock.MagicMock, mock_create_issue: mock.MagicMock
    ) -> None:
        """Test that unexpected errors are handled correctly"""
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.jira_integration = self.create_provider_integration(
                provider="jira", name="Jira", external_id="jira:1"
            )
            self.jira_integration.add_organization(self.organization, self.user)

        mock_create_issue.side_effect = Exception("Something went wrong")
        mock_sdk_capture.return_value = "abc-1234"

        action_data = [
            {
                "type": Action.Type.JIRA.value,
                "integration_id": self.jira_integration.id,
                "data": {
                    "dynamic_form_fields": [
                        {
                            "fake_field": "fake_value",
                        }
                    ],
                },
                "config": {
                    "target_type": "specific",
                },
            }
        ]

        response = self.get_error_response(self.organization.slug, actions=action_data)
        assert response.status_code == 400
        assert mock_create_issue.call_count == 1
        assert response.data == {"actions": ["An unexpected error occurred. Error ID: 'abc-1234'"]}

    def test_no_projects_available(self) -> None:
        """Test behavior when no projects are available for the organization"""
        Project.objects.filter(organization=self.organization).delete()

        action_data = [
            {
                "type": Action.Type.PLUGIN.value,
                "data": {},
                "config": {},
            }
        ]

        response = self.get_error_response(self.organization.slug, actions=action_data)
        assert response.status_code == 400
        assert response.data == {
            "detail": "No projects found for this organization that the user has access to"
        }

    @mock.patch(
        "sentry.notifications.notification_action.types.BaseIssueAlertHandler.send_test_notification"
    )
    @mock.patch("sentry.integrations.slack.actions.form.get_channel_id")
    def test_updates_action_with_validated_data(
        self, mock_get_channel_id: mock.MagicMock, mock_send_test_notification: mock.MagicMock
    ) -> None:
        self.integration, self.org_integration = self.create_provider_integration_for(
            provider="slack",
            organization=self.organization,
            user=self.user,
            name="slack",
            metadata={"domain_name": "https://slack.com"},
        )

        action_data = [
            {
                "type": Action.Type.SLACK,
                "config": {"targetDisplay": "cathy-sentry", "targetType": "specific"},
                "data": {"tags": "asdf"},
                "integrationId": self.integration.id,
            }
        ]

        mock_get_channel_id.return_value = SlackChannelIdData(
            prefix="#", channel_id="C1234567890", timed_out=False
        )

        self.get_success_response(self.organization.slug, actions=action_data)
        assert mock_send_test_notification.call_count == 1

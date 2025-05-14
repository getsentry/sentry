from unittest import mock

import sentry_sdk

from sentry.integrations.jira.integration import JiraIntegration
from sentry.integrations.pagerduty.client import PagerDutyClient
from sentry.integrations.pagerduty.utils import PagerDutyServiceDict, add_service
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
from sentry.testutils.helpers import apply_feature_flag_on_cls
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

pytestmark = [requires_snuba]


class ProjectRuleActionsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-rule-actions"
    method = "POST"

    def setUp(self):
        self.login_as(self.user)

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

    @mock.patch.object(NotifyEventAction, "after")
    def test_actions(self, action):
        action_data = [
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
            }
        ]

        self.get_success_response(self.organization.slug, self.project.slug, actions=action_data)
        assert action.called

    @mock.patch.object(PagerDutyClient, "send_trigger")
    def test_name_action_default(self, mock_send_trigger):
        """
        Tests that label will be used as 'Test Alert' if not present. Uses PagerDuty since those
        notifications will differ based on the name of the alert.
        """
        service_info = self.setup_pd_service()
        action_data = [
            {
                "account": service_info["integration_id"],
                "service": service_info["id"],
                "severity": "info",
                "id": "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
            }
        ]
        self.get_success_response(self.organization.slug, self.project.slug, actions=action_data)

        assert mock_send_trigger.call_count == 1
        pagerduty_data = mock_send_trigger.call_args.kwargs.get("data")
        assert pagerduty_data["payload"]["summary"].startswith("[Test Alert]:")

    @mock.patch.object(PagerDutyClient, "send_trigger")
    def test_name_action_with_custom_name(self, mock_send_trigger):
        """
        Tests that custom names can be provided to the test notification. Uses PagerDuty since those
        notifications will differ based on the name of the alert.
        """
        service_info = self.setup_pd_service()
        action_data = [
            {
                "account": service_info["integration_id"],
                "service": service_info["id"],
                "severity": "info",
                "id": "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
            }
        ]
        custom_alert_name = "Check #feed-issues"

        self.get_success_response(
            self.organization.slug, self.project.slug, actions=action_data, name=custom_alert_name
        )
        assert mock_send_trigger.call_count == 1
        pagerduty_data = mock_send_trigger.call_args.kwargs.get("data")
        assert pagerduty_data["payload"]["summary"].startswith(f"[{custom_alert_name}]:")

    @mock.patch.object(JiraIntegration, "create_issue")
    @mock.patch.object(sentry_sdk, "capture_exception")
    def test_sample_event_raises_exceptions(self, mock_sdk_capture, mock_create_issue):
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
                "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
                "dynamic_form_fields": {
                    "fake_field": "fake_value",
                },
            }
        ]

        response = self.get_error_response(
            self.organization.slug, self.project.slug, actions=action_data
        )
        assert response.status_code == 400
        assert mock_create_issue.call_count == 1
        assert response.data == {"actions": [str(form_errors)]}

        mock_create_issue.side_effect = Exception("Something went wrong")
        response = self.get_error_response(
            self.organization.slug, self.project.slug, actions=action_data
        )
        actions = response.data.get("actions")
        assert actions is not None
        assert actions == ["An unexpected error occurred. Error ID: 'abc-1234'"]

    def test_no_events(self):
        response = self.get_response(self.organization.slug, self.project.slug)
        assert response.status_code == 400


@apply_feature_flag_on_cls("organizations:workflow-engine-test-notifications")
class ProjectRuleActionsEndpointWorkflowEngineTest(APITestCase, BaseWorkflowTest):
    endpoint = "sentry-api-0-project-rule-actions"
    method = "POST"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
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

    @mock.patch.object(NotifyEventAction, "after")
    @mock.patch(
        "sentry.notifications.notification_action.registry.issue_alert_handler_registry.get",
        return_value=PluginIssueAlertHandler,
    )
    def test_actions(self, mock_get_handler, action):
        action_data = [
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
            }
        ]

        self.get_success_response(self.organization.slug, self.project.slug, actions=action_data)
        assert action.called

    def test_unknown_action_returns_400(self):
        action_data = [
            {
                "id": "sentry.rules.actions.fake_action.FakeAction",
            }
        ]

        response = self.get_error_response(
            self.organization.slug, self.project.slug, actions=action_data
        )
        assert response.status_code == 400

    @mock.patch.object(PagerDutyClient, "send_trigger")
    @mock.patch(
        "sentry.notifications.notification_action.registry.group_type_notification_registry.get",
        return_value=IssueAlertRegistryHandler,
    )
    @mock.patch(
        "sentry.notifications.notification_action.registry.issue_alert_handler_registry.get",
        return_value=PagerDutyIssueAlertHandler,
    )
    def test_name_action_default(
        self, mock_get_issue_alert_handler, mock_get_group_type_handler, mock_send_trigger
    ):
        """
        Tests that label will be used as 'Test Alert' if not present. Uses PagerDuty since those
        notifications will differ based on the name of the alert.
        """
        service_info = self.setup_pd_service()
        action_data = [
            {
                "account": service_info["integration_id"],
                "service": service_info["id"],
                "severity": "info",
                "id": "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
            }
        ]
        self.get_success_response(self.organization.slug, self.project.slug, actions=action_data)

        assert mock_send_trigger.call_count == 1
        pagerduty_data = mock_send_trigger.call_args.kwargs.get("data")
        assert pagerduty_data["payload"]["summary"].startswith("[Test Alert]:")

    @mock.patch.object(PagerDutyClient, "send_trigger")
    @mock.patch(
        "sentry.notifications.notification_action.registry.group_type_notification_registry.get",
        return_value=IssueAlertRegistryHandler,
    )
    @mock.patch(
        "sentry.notifications.notification_action.registry.issue_alert_handler_registry.get",
        return_value=PagerDutyIssueAlertHandler,
    )
    def test_name_action_with_custom_name(
        self, mock_get_issue_alert_handler, mock_get_group_type_handler, mock_send_trigger
    ):
        """
        Tests that custom names can be provided to the test notification. Uses PagerDuty since those
        notifications will differ based on the name of the alert.
        """
        service_info = self.setup_pd_service()
        action_data = [
            {
                "account": service_info["integration_id"],
                "service": service_info["id"],
                "severity": "info",
                "id": "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
            }
        ]
        custom_alert_name = "Check #feed-issues"

        self.get_success_response(
            self.organization.slug, self.project.slug, actions=action_data, name=custom_alert_name
        )
        assert mock_send_trigger.call_count == 1
        pagerduty_data = mock_send_trigger.call_args.kwargs.get("data")
        assert pagerduty_data["payload"]["summary"].startswith(f"[{custom_alert_name}]:")

    @mock.patch.object(JiraIntegration, "create_issue")
    @mock.patch.object(sentry_sdk, "capture_exception")
    def test_sample_event_raises_exceptions_workflow_engine(
        self, mock_sdk_capture, mock_create_issue
    ):
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
                "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
                "dynamic_form_fields": {
                    "fake_field": "fake_value",
                },
            }
        ]

        response = self.get_error_response(
            self.organization.slug, self.project.slug, actions=action_data
        )
        assert response.status_code == 400
        assert mock_create_issue.call_count == 1
        assert response.data == {"actions": [str(form_errors)]}

        mock_create_issue.side_effect = Exception("Something went wrong")
        response = self.get_error_response(
            self.organization.slug, self.project.slug, actions=action_data
        )
        actions = response.data.get("actions")
        assert actions is not None
        assert actions == ["An unexpected error occurred. Error ID: 'abc-1234'"]

    def test_no_events(self):
        response = self.get_response(self.organization.slug, self.project.slug)
        assert response.status_code == 400

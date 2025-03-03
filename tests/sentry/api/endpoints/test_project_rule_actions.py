from unittest import mock

import sentry_sdk

from sentry.integrations.jira.integration import JiraIntegration
from sentry.rules.actions.notify_event import NotifyEventAction
from sentry.shared_integrations.exceptions import IntegrationFormError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class ProjectRuleActionsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-rule-actions"
    method = "POST"

    def setUp(self):
        self.login_as(self.user)

    @mock.patch.object(NotifyEventAction, "after")
    def test_actions(self, action):
        action_data = [
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
            }
        ]

        self.get_success_response(self.organization.slug, self.project.slug, actions=action_data)

        assert action.called

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

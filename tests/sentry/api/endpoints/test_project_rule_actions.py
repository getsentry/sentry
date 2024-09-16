from unittest import mock

from sentry.integrations.jira.integration import JiraIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.rules.actions.notify_event import NotifyEventAction
from sentry.shared_integrations.exceptions import IntegrationFormError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
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
    def test_sample_event_does_not_create_external_issue(self, mock_create_issue):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.jira_integration = self.create_provider_integration(
                provider="jira", name="Jira", external_id="jira:1"
            )
            self.jira_integration.add_organization(self.organization, self.user)

        action_data = [
            {
                "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
                "dynamic_form_fields": {
                    "fake_field": "fake_value",
                },
            }
        ]

        self.get_success_response(self.organization.slug, self.project.slug, actions=action_data)
        assert mock_create_issue.call_count == 1
        assert ExternalIssue.objects.count() == 0

    @mock.patch.object(JiraIntegration, "create_issue")
    @with_feature(
        {
            "projects:verbose-test-alert-reporting": True,
        }
    )
    def test_sample_event_raises_exceptions(self, mock_create_issue):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.jira_integration = self.create_provider_integration(
                provider="jira", name="Jira", external_id="jira:1"
            )
            self.jira_integration.add_organization(self.organization, self.user)

        form_errors = {"broken": "something went wrong"}
        mock_create_issue.side_effect = IntegrationFormError(form_errors)
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

        # TODO(Gabe): look into changing this and returning 500 errors.
        # Unexpected exceptions shouldn't be buried for the user
        mock_create_issue.side_effect = Exception("Something went wrong")
        response = self.get_success_response(
            self.organization.slug, self.project.slug, actions=action_data
        )
        assert response.status_code == 200
        assert response.data is None

    @mock.patch.object(JiraIntegration, "create_issue")
    def test_success_response_when_client_raises(self, mock_create_issue):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.jira_integration = self.create_provider_integration(
                provider="jira", name="Jira", external_id="jira:1"
            )
            self.jira_integration.add_organization(self.organization, self.user)

        mock_create_issue.side_effect = IntegrationFormError({"broken": "something went wrong"})
        action_data = [
            {
                "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
                "dynamic_form_fields": {
                    "fake_field": "fake_value",
                },
            }
        ]

        response = self.get_success_response(
            self.organization.slug, self.project.slug, actions=action_data
        )
        assert mock_create_issue.call_count == 1
        assert response.data is None

        # With error propagation option enabled
        with self.options({"ecosystem:enable_integration_form_error_raise": True}):
            response = self.get_success_response(
                self.organization.slug, self.project.slug, actions=action_data
            )
            assert mock_create_issue.call_count == 2
            assert response.data is None

    def test_no_events(self):
        response = self.get_response(self.organization.slug, self.project.slug)
        assert response.status_code == 400

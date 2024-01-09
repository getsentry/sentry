from unittest import mock

from sentry.integrations.jira.integration import JiraIntegration
from sentry.models.integrations.external_issue import ExternalIssue
from sentry.models.integrations.integration import Integration
from sentry.rules.actions.notify_event import NotifyEventAction
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@region_silo_test
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
            self.jira_integration = Integration.objects.create(
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

    def test_no_events(self):
        response = self.get_response(self.organization.slug, self.project.slug)
        assert response.status_code == 400

from unittest import mock

from sentry.rules.actions.notify_event import NotifyEventAction
from sentry.testutils import APITestCase


class ProjectRuleActionsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-rule-actions"
    method = "POST"

    @mock.patch.object(NotifyEventAction, "after")
    def test_actions(self, action):
        action_data = [
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
            }
        ]
        self.login_as(self.user)

        self.get_success_response(self.organization.slug, self.project.slug, actions=action_data)

        assert action.called

    def test_no_events(self):
        self.login_as(self.user)

        response = self.get_response(self.organization.slug, self.project.slug)
        assert response.status_code == 400

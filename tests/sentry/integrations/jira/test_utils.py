from __future__ import absolute_import

from sentry.integrations.jira.utils import build_user_choice
from sentry.testutils import TestCase
from tests.fixtures.integrations.mock_service import StubService


class BuildUserChoiceTest(TestCase):
    def test_jira_server(self):
        user_response = StubService.get_stub_data("jira", "jira_server_user.json")
        assert build_user_choice(user_response, user_id_field="name") == (
            "bob",
            "Bobby - bob@example.org (bob)",
        )

    def test_jira_cloud(self):
        user_response = StubService.get_stub_data("jira", "user.json")
        assert build_user_choice(user_response, user_id_field="accountId") == (
            self.user_id,
            "Saif Hakim",
        )

    def test_unexpected_id(self):
        user_response = StubService.get_stub_data("jira", "user.json")
        assert build_user_choice(user_response, user_id_field="name") is None

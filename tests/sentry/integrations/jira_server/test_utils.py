from fixtures.integrations.mock_service import StubService
from sentry.integrations.jira.utils import build_user_choice
from sentry.testutils import TestCase


class BuildUserChoiceTest(TestCase):
    def test_jira_server(self):
        user_response = StubService.get_stub_data("jira", "jira_server_user.json")
        assert build_user_choice(user_response, user_id_field="name") == (
            "bob",
            "Bobby - bob@example.org (bob)",
        )

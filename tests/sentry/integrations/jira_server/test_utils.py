from fixtures.integrations.stub_service import StubService
from sentry.integrations.jira_server.utils import build_user_choice
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class BuildUserChoiceTest(TestCase):
    def test_jira_server(self):
        user_response = StubService.get_stub_data("jira", "jira_server_user.json")
        assert build_user_choice(user_response, "name") == (
            "bob",
            "Bobby - bob@example.org (bob)",
        )

from fixtures.integrations.stub_service import StubService
from sentry.integrations.jira.utils import build_user_choice
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class BuildUserChoiceTest(TestCase):
    def test_jira_cloud(self):
        user_response = StubService.get_stub_data("jira", "user.json")
        assert build_user_choice(user_response, "accountId") == (
            "012345:00000000-1111-2222-3333-444444444444",
            "Saif Hakim",
        )

    def test_unexpected_id(self):
        user_response = StubService.get_stub_data("jira", "user.json")
        assert build_user_choice(user_response, "name") is None

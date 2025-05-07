from sentry.testutils.cases import APITestCase
from tests.sentry.api.endpoints.test_assistant import control_silo_test


@control_silo_test
class ListUserAccountsWithSharedEmailTest(APITestCase):
    endpoint = "sentry-api-0-auth-merge-accounts"
    method = "get"

    def test_simple(self):
        user1 = self.create_user(username="mifu1", email="mifu@email.com")
        user2 = self.create_user(username="mifu2", email="mifu@email.com")
        # unrelated user
        self.create_user(username="unrelated-mifu", email="michelle@email.com")

        self.login_as(user1)
        response = self.get_success_response()
        assert len(response.data) == 2
        assert response.data[0]["username"] == user1.username
        assert response.data[1]["username"] == user2.username

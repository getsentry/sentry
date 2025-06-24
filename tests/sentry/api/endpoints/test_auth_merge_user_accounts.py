from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ListUserAccountsWithSharedEmailTest(APITestCase):
    endpoint = "sentry-api-0-auth-merge-accounts"
    method = "get"

    def test_simple(self):
        user1 = self.create_user(username="mifu1", email="mifu@example.com")
        user2 = self.create_user(username="mifu2", email="mifu@example.com")
        # unrelated user
        self.create_user(username="unrelated-mifu", email="michelle@email.com")

        self.login_as(user1)
        response = self.get_success_response()
        assert len(response.data) == 2
        assert response.data[0]["username"] == user1.username
        assert response.data[1]["username"] == user2.username

    def test_with_orgs(self):
        user1 = self.create_user(username="powerful mifu", email="mifu@example.com")
        user2 = self.create_user(username="transcendent mifu", email="mifu@example.com")
        self.create_user(username="garden variety mifu", email="mifu@example.com")

        org1 = self.create_organization(name="hojicha")
        org2 = self.create_organization(name="matcha")
        org3 = self.create_organization(name="oolong")

        self.create_member(user=user1, organization=org1)
        self.create_member(user=user1, organization=org2)
        self.create_member(user=user2, organization=org3)

        self.login_as(user1)
        response = self.get_success_response()

        assert response.data[0]["organizations"] == [org1.name, org2.name]
        assert response.data[1]["organizations"] == [org3.name]
        assert response.data[2]["organizations"] == []

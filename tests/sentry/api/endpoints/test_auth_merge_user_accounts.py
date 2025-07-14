from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user import User
from sentry.users.models.useremail import UserEmail


@control_silo_test
class ListUserAccountsWithSharedEmailTest(APITestCase):
    endpoint = "sentry-api-0-auth-merge-accounts"
    method = "get"

    def test_simple(self):
        user1 = self.create_user(username="mifu1", email="mifu@example.com")
        user2 = self.create_user(username="mifu2", email="mifu@example.com")
        # unrelated user
        self.create_user(username="unrelated-mifu", email="michelle@example.com")

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

@control_silo_test
class MergeUserAccountsWithSharedEmailTest(APITestCase):
    endpoint = "sentry-api-0-auth-merge-accounts"
    method = "post"

    def setUp(self):
        self.user1 = self.create_user(username="powerful mifu", email="mifu@email.com")
        self.user2 = self.create_user(username="transcendent mifu", email="mifu@email.com")
        self.user3 = self.create_user(username="garden variety mifu", email="mifu@email.com")

        org1 = self.create_organization(name="hojicha")
        org2 = self.create_organization(name="matcha")
        org3 = self.create_organization(name="oolong")

        self.create_member(user=self.user1, organization=org1)
        self.create_member(user=self.user1, organization=org2)
        self.create_member(user=self.user2, organization=org3)

        self.unrelated_user = self.create_user(email="foo@bar.com")

        self.login_as(self.user1)

    def test_simple(self):
        data = {"ids_to_delete": [self.user3.id], "ids_to_merge": [self.user2.id]}
        self.get_success_response(**data)

        assert not User.objects.filter(id=self.user2.id).exists()
        assert not User.objects.filter(id=self.user3.id).exists()

    def test_primary_email_unverified(self):
        user_email = UserEmail.objects.get(user_id=self.user1.id, email="mifu@email.com")
        user_email.update(is_verified=False)
        data = {"ids_to_delete": [self.user3.id], "ids_to_merge": [self.user2.id]}
        response = self.get_error_response(**data)
        assert response.status_code == 403
        assert response.data == {
            "error": "You must verify your primary email address to use this endpoint"
        }

    def test_merge_unrelated_account(self):
        data = {"ids_to_merge": [self.unrelated_user.id]}
        response = self.get_error_response(**data)
        assert response.status_code == 403
        assert response.data == {
            "error": "One or more of the accounts in your request does not share your primary email address"
        }

    def test_delete_unrelated_account(self):
        data = {"ids_to_delete": [self.unrelated_user.id]}
        response = self.get_error_response(**data)
        assert response.status_code == 403
        assert response.data == {
            "error": "One or more of the accounts in your request does not share your primary email address"
        }

    def test_related_and_unrelated_accounts(self):
        data = {
            "ids_to_delete": [self.user3.id, self.unrelated_user.id],
            "ids_to_merge": [self.user2.id],
        }
        response = self.get_error_response(**data)
        assert response.status_code == 403
        assert response.data == {
            "error": "One or more of the accounts in your request does not share your primary email address"
        }

    def test_pass_current_user_id(self):
        data = {"ids_to_delete": [self.user1.id]}
        response = self.get_error_response(**data)
        assert response.status_code == 400
        assert response.data == {
            "error": "You may not merge or delete the user attached to your current session"
        }

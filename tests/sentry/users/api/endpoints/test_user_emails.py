from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user import User
from sentry.users.models.user_option import UserOption
from sentry.users.models.useremail import UserEmail


@control_silo_test
class UserEmailsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(email="foo@example.com")
        self.login_as(user=self.user)
        self.url = reverse("sentry-api-0-user-emails", kwargs={"user_id": self.user.id})

    def test_get_emails(self) -> None:
        UserEmail.objects.create(user=self.user, email="altemail1@example.com")
        UserEmail.objects.create(user=self.user, email="altemail2@example.com")

        response = self.client.get(self.url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 3

        primary_email = [n for n in response.data if n["isPrimary"]]
        assert len(primary_email) == 1
        assert primary_email[0]["email"] == "foo@example.com"

        secondary_emails = [n for n in response.data if not n["isPrimary"]]
        assert len(secondary_emails) == 2

    def test_add_secondary_email(self) -> None:
        # test invalid email
        response = self.client.post(self.url, data={"email": "invalidemail"})
        assert response.status_code == 400, response.data
        assert not UserEmail.objects.filter(user=self.user, email="invalidemail").exists()

        # valid secondary email
        response = self.client.post(self.url, data={"email": "altemail1@example.com"})

        assert response.status_code == 201, response.data
        # email is not in db yet - only saved when verified
        assert not UserEmail.objects.filter(user=self.user, email="altemail1@example.com").exists()

        # duplicate email returns 201
        response = self.client.post(self.url, data={"email": "altemail1@example.com"})
        assert response.status_code == 201, response.data

    def test_cant_have_same_email_with_different_casing(self) -> None:
        user = self.create_user(email="FOOBAR@example.com")
        self.login_as(user=user)
        url = reverse("sentry-api-0-user-emails", kwargs={"user_id": user.id})
        response = self.client.post(url, data={"email": "foobar@example.com"})
        assert response.status_code == 409, response.data

    def test_change_verified_secondary_to_primary(self) -> None:
        UserEmail.objects.create(user=self.user, email="altemail1@example.com", is_verified=True)
        response = self.client.put(self.url, data={"email": "altemail1@example.com"})
        assert response.status_code == 200, response.data

        user = User.objects.get(id=self.user.id)
        assert user.email == "altemail1@example.com"
        assert user.username == "altemail1@example.com"

    def test_change_primary_email_updates_email_unique(self) -> None:
        user = self.create_user(email="unique@example.com", is_test_user=False)
        self.login_as(user=user)
        url = reverse("sentry-api-0-user-emails", kwargs={"user_id": user.id})
        UserEmail.objects.create(user=user, email="newprimary@example.com", is_verified=True)

        assert user.email_unique == "unique@example.com"

        response = self.client.put(url, data={"email": "newprimary@example.com"})
        assert response.status_code == 200, response.data

        user = User.objects.get(id=user.id)
        assert user.email == "newprimary@example.com"
        assert user.email_unique == "newprimary@example.com"

    def test_change_unverified_secondary_to_primary(self) -> None:
        UserEmail.objects.create(user=self.user, email="altemail1@example.com", is_verified=False)
        response = self.client.put(self.url, data={"email": "altemail1@example.com"})
        assert response.status_code == 400, response.data

        user = User.objects.get(id=self.user.id)
        assert user.email != "altemail1@example.com"
        assert user.username != "altemail1@example.com"

    def test_change_email_not_on_account_to_primary(self) -> None:
        response = self.client.put(self.url, data={"email": "neveradded@example.com"})
        assert response.status_code == 400, response.data

        user = User.objects.get(id=self.user.id)
        assert user.email == "foo@example.com"
        assert not UserEmail.objects.filter(user=self.user, email="neveradded@example.com").exists()

    def test_change_to_email_on_another_account(self) -> None:
        shared_email = "shared@example.com"
        # another account already owns this email as its primary
        self.create_user(email=shared_email)
        # current user has added and verified the same email as a secondary
        self.create_useremail(user=self.user, email=shared_email, is_verified=True)

        response = self.client.put(self.url, data={"email": shared_email})
        assert response.status_code == 400, response.data
        assert "another account" in str(response.data["email"])

        user = User.objects.get(id=self.user.id)
        assert user.email == "foo@example.com"

    def test_change_primary_migrates_matching_user_options(self) -> None:
        new_email = "altemail1@example.com"
        self.create_useremail(user=self.user, email=new_email, is_verified=True)

        # a per-project notification option pointing at the current primary
        matching_option = UserOption.objects.create(
            user=self.user, project_id=self.project.id, key="mail:email", value="foo@example.com"
        )
        # a per-project option pointing at a different address - must be left alone
        other_project = self.create_project(organization=self.organization)
        unrelated_option = UserOption.objects.create(
            user=self.user,
            project_id=other_project.id,
            key="mail:email",
            value="elsewhere@example.com",
        )

        response = self.client.put(self.url, data={"email": new_email})
        assert response.status_code == 200, response.data

        matching_option.refresh_from_db()
        unrelated_option.refresh_from_db()
        assert matching_option.value == new_email
        assert unrelated_option.value == "elsewhere@example.com"

    def test_remove_email(self) -> None:
        UserEmail.objects.create(user=self.user, email="altemail1@example.com")

        response = self.client.delete(self.url, data={"email": "altemail1@example.com"})
        assert response.status_code == 204, response.data
        assert not len(UserEmail.objects.filter(user=self.user, email="altemail1@example.com"))

    def test_remove_email_also_deletes_user_option_with_same_email(self) -> None:
        mail_to_del = "altemail1@example.com"
        UserEmail.objects.create(user=self.user, email=mail_to_del)
        UserOption.objects.create(
            user=self.user, project_id=self.project.id, key="mail:email", value=mail_to_del
        )

        response = self.client.delete(self.url, data={"email": mail_to_del})
        assert response.status_code == 204, response.data
        assert not len(UserEmail.objects.filter(user=self.user, email=mail_to_del))
        assert not len(
            UserOption.objects.filter(user=self.user, key="mail:email", value=mail_to_del)
        )

    def test_cant_remove_primary_email(self) -> None:
        response = self.client.delete(self.url, data={"email": "foo@example.com"})
        assert response.status_code == 400
        assert len(UserEmail.objects.filter(user=self.user, email="foo@example.com"))

    def test_other_user_cant_change(self) -> None:
        other_user = self.create_user(email="other@example.com")
        self.login_as(user=other_user)

        # self.url represents users url to `self.user` and we are logged in as `other_user`
        response = self.client.post(self.url, data={"email": "altemail1@example.com"})

        assert response.status_code == 403

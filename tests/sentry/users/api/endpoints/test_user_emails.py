from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user import User
from sentry.users.models.user_option import UserOption
from sentry.users.models.useremail import UserEmail


@control_silo_test
class UserEmailsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(email="foo@example.com")
        self.login_as(user=self.user)
        self.url = reverse("sentry-api-0-user-emails", kwargs={"user_id": self.user.id})

    def test_get_emails(self):
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

    def test_add_secondary_email(self):
        # test invalid email
        response = self.client.post(self.url, data={"email": "invalidemail"})
        assert response.status_code == 400, response.data
        assert not UserEmail.objects.filter(user=self.user, email="invalidemail").exists()

        # valid secondary email
        response = self.client.post(self.url, data={"email": "altemail1@example.com"})

        assert response.status_code == 201, response.data
        assert UserEmail.objects.filter(user=self.user, email="altemail1@example.com").exists()

        # duplicate email returns 409
        response = self.client.post(self.url, data={"email": "altemail1@example.com"})
        assert response.status_code == 409, response.data

    def test_cant_have_same_email_with_different_casing(self):
        user = self.create_user(email="FOOBAR@example.com")
        self.login_as(user=user)
        url = reverse("sentry-api-0-user-emails", kwargs={"user_id": user.id})
        response = self.client.post(url, data={"email": "foobar@example.com"})
        assert response.status_code == 409, response.data

    def test_change_verified_secondary_to_primary(self):
        UserEmail.objects.create(user=self.user, email="altemail1@example.com", is_verified=True)
        response = self.client.put(self.url, data={"email": "altemail1@example.com"})
        assert response.status_code == 200, response.data

        user = User.objects.get(id=self.user.id)
        assert user.email == "altemail1@example.com"
        assert user.username == "altemail1@example.com"

    def test_change_unverified_secondary_to_primary(self):
        UserEmail.objects.create(user=self.user, email="altemail1@example.com", is_verified=False)
        response = self.client.put(self.url, data={"email": "altemail1@example.com"})
        assert response.status_code == 400, response.data

        user = User.objects.get(id=self.user.id)
        assert user.email != "altemail1@example.com"
        assert user.username != "altemail1@example.com"

    def test_remove_email(self):
        UserEmail.objects.create(user=self.user, email="altemail1@example.com")

        response = self.client.delete(self.url, data={"email": "altemail1@example.com"})
        assert response.status_code == 204, response.data
        assert not len(UserEmail.objects.filter(user=self.user, email="altemail1@example.com"))

    def test_remove_email_also_deletes_user_option_with_same_email(self):
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

    def test_cant_remove_primary_email(self):
        response = self.client.delete(self.url, data={"email": "foo@example.com"})
        assert response.status_code == 400
        assert len(UserEmail.objects.filter(user=self.user, email="foo@example.com"))

    def test_other_user_cant_change(self):
        other_user = self.create_user(email="other@example.com")
        self.login_as(user=other_user)

        # self.url represents users url to `self.user` and we are logged in as `other_user`
        response = self.client.post(self.url, data={"email": "altemail1@example.com"})

        assert response.status_code == 403

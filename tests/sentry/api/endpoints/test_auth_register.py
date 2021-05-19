from unittest import mock

from sentry import options
from sentry.models import User
from sentry.testutils import APITestCase


class AuthRegisterEndpointTest(APITestCase):
    path = "/api/0/auth/register/"

    def setUp(self):
        super().setUp()
        options.set("auth.allow-registration", True)

    def test_duplicate_username(self):
        self.create_user(email="foo@example.com")
        form_data = {
            "email": "foo@example.com",
            "password": "foo",
            "name": "Foo Bar",
        }
        response = self.client.post(self.path, form_data)

        assert response.status_code == 400, response.data

    @mock.patch(
        "sentry.api.endpoints.auth_register.AuthRegisterSerializer.is_rate_limited",
        autospec=True,
        return_value=True,
    )
    def test_ratelimit(self, mock_is_rate_limited):
        form_data = {
            "email": "foo@example.com",
            "password": "foo",
            "name": "Foo Bar",
        }
        response = self.client.post(self.path, form_data)

        assert response.status_code == 400, response.data

    def test_missing_email(self):
        form_data = {
            "password": "foo",
            "name": "Foo Bar",
        }
        response = self.client.post(self.path, form_data)

        assert response.status_code == 400, response.data

    def test_missing_password(self):
        form_data = {
            "email": "foo@example.com",
            "name": "Foo Bar",
        }
        response = self.client.post(self.path, form_data)

        assert response.status_code == 400, response.data

    def test_missing_name(self):
        form_data = {
            "email": "foo@example.com",
            "password": "foo",
        }
        response = self.client.post(self.path, form_data)

        assert response.status_code == 400, response.data

    @mock.patch("sentry.analytics.record")
    def test_user_register(self, mock_record):
        form_data = {
            "email": "foo@example.com",
            "password": "foo",
            "name": "Foo Bar",
        }
        response = self.client.post(self.path, form_data)

        assert response.status_code == 200, response.data

        data = response.data
        assert data["email"] == form_data["email"]

        user = User.objects.get(username=form_data["email"])
        assert user.email == form_data["email"]
        assert user.username == form_data["email"]
        assert user.name == form_data["name"]
        assert user.check_password(form_data["password"])

        signup_record = [r for r in mock_record.call_args_list if r[0][0] == "user.signup"]
        assert signup_record == [
            mock.call("user.signup", user_id=user.id, source="api", provider=None, referrer=None)
        ]

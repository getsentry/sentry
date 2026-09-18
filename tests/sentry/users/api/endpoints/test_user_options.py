from __future__ import annotations

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user_option import UserOption


@control_silo_test
class UserOptionsGetTest(APITestCase):
    endpoint = "sentry-api-0-user-options"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(email="a@example.com")
        self.login_as(user=self.user)

    def test_returns_defaults_when_nothing_is_set(self) -> None:
        response = self.get_success_response("me")

        assert response.data == {
            "theme": "system",
            "language": "en",
            "stacktraceOrder": -1,
            "defaultIssueEvent": "recommended",
            "timezone": "UTC",
            "clock24Hours": False,
            "prefersIssueDetailsStreamlinedUI": None,
        }

    def test_returns_stored_values(self) -> None:
        UserOption.objects.set_value(user=self.user, key="theme", value="dark")
        UserOption.objects.set_value(user=self.user, key="timezone", value="Europe/Berlin")

        response = self.get_success_response("me")

        assert response.data["theme"] == "dark"
        assert response.data["timezone"] == "Europe/Berlin"

    def test_rejects_another_user(self) -> None:
        other_user = self.create_user()

        self.get_error_response(other_user.id, status_code=403)


@control_silo_test
class UserOptionsPutTest(APITestCase):
    endpoint = "sentry-api-0-user-options"
    method = "put"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(email="a@example.com")
        self.login_as(user=self.user)

    def test_writes_supplied_preferences(self) -> None:
        response = self.get_success_response("me", theme="dark", timezone="Europe/Berlin")

        assert response.data["theme"] == "dark"
        assert response.data["timezone"] == "Europe/Berlin"
        assert UserOption.objects.get_value(user=self.user, key="theme") == "dark"
        assert UserOption.objects.get_value(user=self.user, key="timezone") == "Europe/Berlin"

    def test_leaves_absent_preferences_alone(self) -> None:
        UserOption.objects.set_value(user=self.user, key="timezone", value="Europe/Berlin")

        self.get_success_response("me", theme="dark")

        assert UserOption.objects.get_value(user=self.user, key="timezone") == "Europe/Berlin"

    def test_writes_every_field(self) -> None:
        response = self.get_success_response(
            "me",
            theme="light",
            language="es",
            stacktraceOrder="1",
            defaultIssueEvent="latest",
            timezone="America/New_York",
            clock24Hours=True,
            prefersIssueDetailsStreamlinedUI=True,
        )

        assert response.data == {
            "theme": "light",
            "language": "es",
            "stacktraceOrder": 1,
            "defaultIssueEvent": "latest",
            "timezone": "America/New_York",
            "clock24Hours": True,
            "prefersIssueDetailsStreamlinedUI": True,
        }

    def test_rejects_an_invalid_choice(self) -> None:
        response = self.get_error_response("me", theme="chartreuse", status_code=400)

        assert "theme" in response.data
        assert UserOption.objects.get_value(user=self.user, key="theme") is None

    def test_ignores_account_fields(self) -> None:
        # The whole point of this endpoint: a caller that can write preferences must not
        # be able to rename the account or grant itself privileges through the same body.
        self.get_success_response(
            "me",
            theme="dark",
            username="renamed",
            isSuperuser=True,
            isStaff=True,
            email="elsewhere@example.com",
        )

        self.user.refresh_from_db()
        assert self.user.username == "a@example.com"
        assert self.user.is_superuser is False
        assert self.user.is_staff is False
        assert self.user.email == "a@example.com"

    def test_rejects_another_user(self) -> None:
        other_user = self.create_user()

        self.get_error_response(other_user.id, theme="dark", status_code=403)

        assert UserOption.objects.get_value(user=other_user, key="theme") is None

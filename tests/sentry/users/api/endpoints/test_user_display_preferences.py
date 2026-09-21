from __future__ import annotations

from django.test import override_settings

from sentry.seer import agent_token
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user import User
from sentry.users.models.user_option import UserOption


@control_silo_test
class UserDisplayPreferencesGetTest(APITestCase):
    endpoint = "sentry-api-0-user-display-preferences"
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
class UserDisplayPreferencesPutTest(APITestCase):
    endpoint = "sentry-api-0-user-display-preferences"
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


@control_silo_test
@override_settings(SEER_API_SHARED_SECRET="test-secret")
class UserDisplayPreferencesAgentTokenTest(APITestCase):
    """The same endpoint reached with a real Seer agent bearer token.

    Deliberately end-to-end rather than calling the permission class directly: only a
    real request exercises `AgentTokenAuthentication`, the feature gate, and
    `UserEndpoint.convert_args`, and only a real response carries the RFC 6750
    challenge that tells Seer to ask the user for write approval.
    """

    endpoint = "sentry-api-0-user-display-preferences"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(email="a@example.com")
        self.organization = self.create_organization(owner=self.user)
        # No `login_as`: the bearer token must be the only credential on the request.

    def _headers(self, user: User, scopes: list[str]) -> dict[str, str]:
        token, _ = agent_token.encode_agent_token(
            user_id=user.id,
            organization_id=self.organization.id,
            scopes=scopes,
            session_id="s1",
        )
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def test_reads_the_delegating_users_preferences(self) -> None:
        UserOption.objects.set_value(user=self.user, key="theme", value="dark")

        with self.feature(agent_token.FEATURE_FLAG):
            response = self.get_success_response(
                "me", method="get", extra_headers=self._headers(self.user, ["org:read"])
            )

        assert response.data["theme"] == "dark"

    def test_writes_with_a_write_scope(self) -> None:
        with self.feature(agent_token.FEATURE_FLAG):
            response = self.get_success_response(
                "me",
                method="put",
                theme="dark",
                extra_headers=self._headers(self.user, ["org:write"]),
            )

        assert response.data["theme"] == "dark"
        assert UserOption.objects.get_value(user=self.user, key="theme") == "dark"

    def test_default_agent_token_can_write_with_read_scope(self) -> None:
        # A default agent token carries only SENTRY_READONLY_SCOPES, and that is enough
        # here: the user it acts for needs no scope to change their own preferences, and
        # no write scope exists that a plain member could approve. Ordinary tokens do
        # not get this exception — see UserDisplayPreferencesTokenScopeTest below.
        with self.feature(agent_token.FEATURE_FLAG):
            response = self.get_success_response(
                "me",
                method="put",
                theme="dark",
                extra_headers=self._headers(self.user, ["org:read"]),
            )

        assert response.data["theme"] == "dark"
        assert UserOption.objects.get_value(user=self.user, key="theme") == "dark"

    def test_cannot_read_another_users_preferences(self) -> None:
        other_user = self.create_user()

        with self.feature(agent_token.FEATURE_FLAG):
            self.get_error_response(
                other_user.id,
                method="get",
                status_code=403,
                extra_headers=self._headers(self.user, ["org:read"]),
            )

    def test_cannot_write_another_users_preferences(self) -> None:
        other_user = self.create_user()

        with self.feature(agent_token.FEATURE_FLAG):
            self.get_error_response(
                other_user.id,
                method="put",
                theme="dark",
                status_code=403,
                extra_headers=self._headers(self.user, ["org:write"]),
            )

        assert UserOption.objects.get_value(user=other_user, key="theme") is None


@control_silo_test
class UserDisplayPreferencesTokenScopeTest(APITestCase):
    """An ordinary bearer token: no scope is required, same as every other caller."""

    endpoint = "sentry-api-0-user-display-preferences"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(email="a@example.com")
        self.organization = self.create_organization(owner=self.user)
        # No `login_as`: the bearer token must be the only credential on the request.

    def _headers(self, scopes: list[str]) -> dict[str, str]:
        token = self.create_user_auth_token(user=self.user, scope_list=scopes)
        return {"HTTP_AUTHORIZATION": f"Bearer {token.token}"}

    def test_read_scope_can_read(self) -> None:
        UserOption.objects.set_value(user=self.user, key="theme", value="dark")

        response = self.get_success_response(
            "me", method="get", extra_headers=self._headers(["org:read"])
        )

        assert response.data["theme"] == "dark"

    def test_read_scope_can_persist_a_write(self) -> None:
        # No scope is required for this resource, so a read-only token writing the
        # token owner's own preferences is expected, not an escalation.
        self.get_success_response(
            "me", method="put", theme="dark", extra_headers=self._headers(["org:read"])
        )

        assert UserOption.objects.get_value(user=self.user, key="theme") == "dark"

    def test_write_scope_can_write(self) -> None:
        self.get_success_response(
            "me", method="put", theme="dark", extra_headers=self._headers(["org:write"])
        )

        assert UserOption.objects.get_value(user=self.user, key="theme") == "dark"


@control_silo_test
class UserDisplayPreferencesSuperuserTest(APITestCase):
    """Self-only holds for operators too, unlike most user endpoints."""

    endpoint = "sentry-api-0-user-display-preferences"

    def test_superuser_cannot_write_another_users_preferences(self) -> None:
        victim = self.create_user(email="victim@example.com")
        superuser = self.create_user(is_superuser=True)
        org = self.create_organization(owner=superuser)

        with self.settings(SUPERUSER_ORG_ID=org.id):
            self.login_as(user=superuser, superuser=True)
            self.get_error_response(victim.id, method="put", theme="dark", status_code=403)

        assert UserOption.objects.get_value(user=victim, key="theme") is None

    def test_superuser_cannot_read_another_users_preferences(self) -> None:
        victim = self.create_user(email="victim@example.com")
        superuser = self.create_user(is_superuser=True)
        org = self.create_organization(owner=superuser)

        with self.settings(SUPERUSER_ORG_ID=org.id):
            self.login_as(user=superuser, superuser=True)
            self.get_error_response(victim.id, method="get", status_code=403)

    def test_staff_cannot_write_another_users_preferences(self) -> None:
        victim = self.create_user(email="victim@example.com")
        staff_user = self.create_user(is_staff=True)

        self.login_as(user=staff_user, staff=True)
        self.get_error_response(victim.id, method="put", theme="dark", status_code=403)

        assert UserOption.objects.get_value(user=victim, key="theme") is None

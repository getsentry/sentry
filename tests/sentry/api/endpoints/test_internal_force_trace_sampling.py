from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.models.user import User
from sentry.users.models.useremail import UserEmail
from sentry.utils.force_trace_sampling import COOKIE_NAME, MAX_AGE_SECONDS, read_grant

URL = "/api/0/internal/force-trace-sampling/"


@control_silo_test
@override_options({"tracing.force-sampling.enabled": True})
class InternalForceTraceSamplingTest(APITestCase):
    def create_employee(
        self, *, is_verified: bool = True, email: str = "employee@sentry.io"
    ) -> User:
        user = self.create_user(email=email, is_staff=True)
        with assume_test_silo_mode(SiloMode.CONTROL):
            UserEmail.objects.filter(user=user).update(is_verified=is_verified)
        return user

    def test_employee_gets_signed_cookie(self) -> None:
        user = self.create_employee()
        self.login_as(user)

        response = self.client.post(URL)

        assert response.status_code == 200
        cookie = response.cookies[COOKIE_NAME]
        assert cookie["httponly"] is True
        assert cookie["max-age"] == MAX_AGE_SECONDS

        grant = read_grant(cookie.value)
        assert grant is not None
        assert grant.user_id == user.id
        assert response.data["expiresAt"] == grant.expires_at_ms

    def test_staff_without_company_email_is_denied(self) -> None:
        self.login_as(self.create_employee(email="contractor@example.com"))

        response = self.client.post(URL)

        assert response.status_code == 403
        assert COOKIE_NAME not in response.cookies

    def test_staff_with_unverified_company_email_is_denied(self) -> None:
        self.login_as(self.create_employee(is_verified=False))

        assert self.client.post(URL).status_code == 403

    def test_company_email_without_staff_is_denied(self) -> None:
        user = self.create_user(email="not-staff@sentry.io", is_staff=False)
        with assume_test_silo_mode(SiloMode.CONTROL):
            UserEmail.objects.filter(user=user).update(is_verified=True)
        self.login_as(user)

        assert self.client.post(URL).status_code == 403

    def test_anonymous_is_denied(self) -> None:
        response = self.client.post(URL)

        assert response.status_code in (401, 403)
        assert COOKIE_NAME not in response.cookies

    def test_api_token_is_denied(self) -> None:
        user = self.create_employee()
        token = self.create_user_auth_token(user=user, scope_list=["org:read"])

        response = self.client.post(URL, HTTP_AUTHORIZATION=f"Bearer {token.token}")

        assert response.status_code in (401, 403)
        assert COOKIE_NAME not in response.cookies

    @override_options({"tracing.force-sampling.enabled": False})
    def test_kill_switch(self) -> None:
        self.login_as(self.create_employee())

        response = self.client.post(URL)

        assert response.status_code == 404
        assert COOKIE_NAME not in response.cookies

    def test_delete_clears_cookie(self) -> None:
        self.login_as(self.create_employee())
        self.client.post(URL)

        response = self.client.delete(URL)

        assert response.status_code == 204
        assert response.cookies[COOKIE_NAME]["max-age"] == 0

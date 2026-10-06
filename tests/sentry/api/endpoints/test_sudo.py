from django.conf import settings
from django.urls import reverse

from sentry.auth.services.auth import AuthenticatedToken
from sentry.middleware.placeholder import placeholder_get_response
from sentry.middleware.sudo import SudoMiddleware
from sentry.seer import agent_token
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class SudoTest(APITestCase):
    def test_agent_token_does_not_inherit_passwordless_sudo(self) -> None:
        user = self.create_user()
        user.set_unusable_password()
        user.save(update_fields=["password"])
        middleware = SudoMiddleware(placeholder_get_response)

        assert middleware.has_sudo_privileges(self.make_request(user=user))
        request = self.make_request(
            user=user,
            auth=AuthenticatedToken(kind=agent_token.AGENT_TOKEN_KIND),
        )
        assert not middleware.has_sudo_privileges(request)

    def test_agent_token_never_satisfies_sudo(self) -> None:
        org = self.create_organization()
        user = self.create_user()
        user.set_unusable_password()
        user.save(update_fields=["password"])
        self.create_member(organization=org, user=user, role="owner")
        url = reverse(
            "sentry-api-0-organization-details", kwargs={"organization_id_or_slug": org.slug}
        )
        with (
            self.settings(SEER_API_SHARED_SECRET="sudo-test-secret"),
            self.feature(agent_token.FEATURE_FLAG),
        ):
            token, _ = agent_token.encode_agent_token(
                user_id=user.id,
                organization_id=org.id,
                scopes=["org:admin"],
                session_id="sudo-boundary",
            )
            response = self.client.delete(url, HTTP_AUTHORIZATION=f"Bearer {token}")

        assert response.status_code == 401
        assert response.data["detail"]["code"] == "sudo-required"

    def test_sudo_required_del_org(self) -> None:
        org = self.create_organization()
        url = reverse(
            "sentry-api-0-organization-details", kwargs={"organization_id_or_slug": org.slug}
        )

        user = self.create_user(email="foo@example.com")
        self.create_member(organization=org, user=user, role="owner")

        self.login_as(user)

        middleware = list(settings.MIDDLEWARE)
        index = middleware.index("sentry.testutils.middleware.SudoMiddleware")
        middleware[index] = "sentry.middleware.sudo.SudoMiddleware"

        with self.settings(MIDDLEWARE=tuple(middleware)):
            response = self.client.delete(url, is_sudo=False)
            assert response.status_code == 401
            assert response.data["detail"]["code"] == "sudo-required"
            assert response.data["detail"]["message"] == "Account verification required."
            assert response.data["detail"]["extra"]["username"] == "foo@example.com"

            sudo_url = reverse("sentry-api-0-auth", kwargs={})
            # Now try to gain sudo access
            response = self.client.post(
                sudo_url, {"username": "foo@example.com", "password": "admin"}
            )
            assert response.status_code == 200

            # This should now work
            response = self.client.delete(url, is_sudo=False)
            assert response.status_code == 202

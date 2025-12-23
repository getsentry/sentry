from django.urls import reverse

from sentry.models.apiapplication import ApiApplication
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.token import AuthTokenType


@control_silo_test
class SentryAppRotateSecretTest(APITestCase):
    def setUp(self) -> None:
        self.application = ApiApplication.objects.create(owner=self.user)
        self.sentry_app = SentryApp.objects.create(
            application=self.application, owner_id=self.organization.id, name="a", slug="a"
        )
        self.url = reverse("sentry-api-0-sentry-app-rotate-secret", args=[self.sentry_app.slug])

    def test_unauthenticated_call(self) -> None:
        response = self.client.post(self.url)
        assert response.status_code == 401

    def test_member_call(self) -> None:
        """
        Tests that a low privileged user from the same org cannot rotate a secret.
        """
        other_user = self.create_user()
        other_member = self.create_member(
            user=other_user, organization=self.organization, role="member"
        )
        self.login_as(other_member)
        response = self.client.post(self.url)
        assert response.status_code == 403

    def test_manager_cannot_rotate_privileged_secret(self) -> None:
        """
        Tests that a Manager cannot rotate a secret with a high privileged scope
        (such as org:admin)
        """
        other_application = ApiApplication.objects.create(owner=self.user)
        other_app = SentryApp.objects.create(
            application=other_application,
            owner_id=self.organization.id,
            name="b",
            slug="b",
            scope_list=("org:admin",),
        )
        self.url = reverse("sentry-api-0-sentry-app-rotate-secret", args=[other_app.slug])

        other_user = self.create_user()
        other_manager = self.create_member(
            user=other_user, organization=self.organization, role="manager"
        )
        self.login_as(other_manager)
        response = self.client.post(self.url)
        assert response.status_code == 403
        assert (
            "Requested permission of org:admin exceeds requester's permission. Please contact an owner to make the requested change."
            in response.data["detail"]
        )

    def test_non_owner_call(self) -> None:
        """
        Tests that an authenticated user cannot rotate the secret for an app from other org.
        """
        self.login_as(self.user)
        other_user = self.create_user()
        other_org = self.create_organization(owner=other_user)
        other_app = ApiApplication.objects.create(owner=other_user, name="b")
        other_sentry_app = SentryApp.objects.create(
            application=other_app, owner_id=other_org.id, name="b", slug="b"
        )
        response = self.client.post(
            reverse("sentry-api-0-sentry-app-rotate-secret", args=[other_sentry_app.slug])
        )
        assert response.status_code == 404

    def test_invalid_app_id(self) -> None:
        self.login_as(self.user)
        path_with_invalid_id = reverse("sentry-api-0-sentry-app-rotate-secret", args=["invalid"])
        response = self.client.post(path_with_invalid_id)
        assert response.status_code == 404

    def test_valid_call(self) -> None:
        self.login_as(self.user)
        assert self.sentry_app.application is not None
        old_secret = self.sentry_app.application.client_secret
        response = self.client.post(self.url)
        new_secret = response.data["clientSecret"]
        assert len(new_secret) == len(old_secret)
        assert new_secret != old_secret
        assert new_secret.startswith(AuthTokenType.USER_APP)

    def test_superuser_has_access(self) -> None:
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)
        assert self.sentry_app.application is not None
        old_secret = self.sentry_app.application.client_secret
        response = self.client.post(self.url)
        new_secret = response.data["clientSecret"]
        assert len(new_secret) == len(old_secret)
        assert new_secret != old_secret
        assert new_secret.startswith(AuthTokenType.USER_APP)

    def test_no_corresponding_application_found(self) -> None:
        self.login_as(self.user)
        other_sentry_app = SentryApp.objects.create(
            application=None, owner_id=self.organization.id, name="c", slug="c"
        )
        response = self.client.post(
            reverse("sentry-api-0-sentry-app-rotate-secret", args=[other_sentry_app.slug])
        )
        assert response.status_code == 404
        assert "Corresponding application was not found." in response.data["detail"]

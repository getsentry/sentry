from django.urls import reverse

from sentry.auth.providers.fly.provider import FlyOAuth2Provider
from sentry.models.authprovider import AuthProvider
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class AuthOrganizationChannelLoginTest(TestCase):
    def create_auth_provider(self, partner_org_id, sentry_org_id):
        config_data = FlyOAuth2Provider.build_config(resource={"id": partner_org_id})
        AuthProvider.objects.create(
            organization_id=sentry_org_id, provider="fly", config=config_data
        )

    def setUp(self):
        self.organization = self.create_organization(name="test org", owner=self.user)
        self.create_auth_provider("fly-test-org", self.organization.id)
        self.path = reverse("sentry-auth-channel", args=["fly", "fly-test-org"])

    def test_redirect_for_logged_in_user(self):
        self.login_as(self.user)
        response = self.client.get(self.path, follow=True)
        assert response.status_code == 200
        assert response.redirect_chain == [
            (f"/organizations/{self.organization.slug}/issues/", 302),
        ]

    def test_redirect_for_logged_in_user_with_different_active_org(self):
        self.login_as(self.user)  # log in to "test org"
        another_org = self.create_organization(name="another org", owner=self.user)
        self.create_auth_provider("another-fly-org", another_org.id)
        path = reverse("sentry-auth-channel", args=["fly", "another-fly-org"])
        response = self.client.get(path + "?next=/projects/", follow=True)
        assert response.status_code == 200
        # redirects to login to the org in the url
        assert response.redirect_chain == [
            (f"/auth/login/{another_org.slug}/?next=/projects/", 302),
        ]

    def test_redirect_for_logged_out_user(self):
        response = self.client.get(self.path, follow=True)
        assert response.status_code == 200
        assert response.redirect_chain == [
            (f"/auth/login/{self.organization.slug}/", 302),
        ]

    def test_with_next_uri(self):
        self.login_as(self.user)
        response = self.client.get(self.path + "?next=/projects/", follow=True)
        assert response.status_code == 200
        assert response.redirect_chain == [
            ("/projects/", 302),
        ]

    def test_subdomain_precedence(self):
        another_org = self.create_organization(name="another org")
        path = reverse("sentry-auth-channel", args=["fly", another_org.id])
        response = self.client.get(
            path,
            HTTP_HOST=f"{self.organization.slug}.testserver",
            follow=True,
        )
        assert response.status_code == 200
        assert response.redirect_chain == [
            (f"/auth/login/{self.organization.slug}/", 302),
        ]

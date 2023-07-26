from django.urls import reverse

from sentry.auth.providers.fly.provider import FlyOAuth2Provider
from sentry.models.authprovider import AuthProvider
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class AuthOrganizationChannelLoginTest(TestCase):
    def setup(self):
        self.organization = self.create_organization(name="test org", owner=self.user)
        self.partner_org_id = "foobar"
        config_data = FlyOAuth2Provider.build_config(resource={"id": self.partner_org_id})
        AuthProvider.objects.create(
            organization_id=self.organization.id, provider="fly", config=config_data
        )
        self.path = reverse("sentry-auth-channel", args=["fly", self.partner_org_id])

    def test_redirect_for_logged_in_user(self):
        self.setup()
        self.login_as(self.user)
        response = self.client.get(self.path, follow=True)
        assert response.status_code == 200
        assert response.redirect_chain == [
            (f"/organizations/{self.organization.slug}/issues/", 302),
        ]

    def test_redirect_for_logged_out_user(self):
        self.setup()
        response = self.client.get(self.path, follow=True)
        assert response.status_code == 200
        assert response.redirect_chain == [
            (f"/auth/login/{self.organization.slug}/", 302),
        ]

    def test_with_next_uri(self):
        self.setup()
        self.login_as(self.user)
        response = self.client.get(self.path + "?next=/projects/", follow=True)
        assert response.status_code == 200
        assert response.redirect_chain == [
            ("/projects/", 302),
        ]

    def test_subdomain_precedence(self):
        self.setup()
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

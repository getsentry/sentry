from functools import cached_property

from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class AuthOrganizationIdentifierLoginTest(TestCase):
    @cached_property
    def organization(self):
        return self.create_organization(name="test org", owner=self.user)

    @cached_property
    def path(self):
        return reverse("sentry-auth-organization-id", args=[self.organization.id])

    def test_redirect_for_logged_in_user(self):
        self.login_as(self.user)
        response = self.client.get(self.path, follow=True)
        assert response.status_code == 200
        assert response.redirect_chain == [
            (f"/organizations/{self.organization.slug}/issues/", 302),
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
        response = self.client.get(
            reverse("sentry-auth-organization-id", args=[another_org.id]),
            HTTP_HOST=f"{self.organization.slug}.testserver",
            follow=True,
        )
        assert response.status_code == 200
        assert response.redirect_chain == [
            (f"/auth/login/{self.organization.slug}/", 302),
        ]

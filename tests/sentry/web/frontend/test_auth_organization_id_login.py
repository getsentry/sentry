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
        response = self.client.get(self.path)
        assert response.status_code == 302
        self.assertRedirects(response, "/issues/")

    def test_redirect_for_logged_out_user(self):
        response = self.client.get(self.path)
        assert response.status_code == 302
        self.assertRedirects(response, f"/auth/login/{self.organization.slug}/")

    def test_with_next_uri(self):
        self.login_as(self.user)
        response = self.client.post(self.path + "?next=/projects/")
        assert response.status_code == 302
        self.assertRedirects(response, "/projects/")

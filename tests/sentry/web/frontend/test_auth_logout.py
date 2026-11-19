from functools import cached_property

from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class AuthLogoutPageTest(TestCase):
    @cached_property
    def path(self) -> str:
        return reverse("sentry-logout")

    def test_renders_react_page_without_logging_out(self) -> None:
        self.login_as(self.user)

        response = self.client.get(self.path)

        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/base-react.html")
        assert self.client.session.keys(), "Not logged out yet"

    def test_is_public(self) -> None:
        response = self.client.get(self.path)

        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/base-react.html")

    def test_shell_is_not_cacheable(self) -> None:
        response = self.client.get(self.path)

        assert "no-store" in response["Cache-Control"]

    def test_logout_requires_api(self) -> None:
        self.login_as(self.user)

        response = self.client.post(self.path)

        assert response.status_code == 405
        assert self.client.session.keys(), "Not logged out"

    def test_stays_on_primary_domain_with_active_organization(self) -> None:
        organization = self.create_organization(owner=self.user)
        self.login_as(self.user)
        session = self.client.session
        session["activeorg"] = organization.slug
        session.save()

        with self.feature({"system:multi-region": True}):
            response = self.client.get(self.path, HTTP_HOST="testserver", follow=True)

        assert response.status_code == 200
        assert response.redirect_chain == []
        self.assertTemplateUsed(response, "sentry/base-react.html")

    def test_customer_domain_redirects_to_primary_domain(self) -> None:
        organization = self.create_organization(owner=self.user)
        self.login_as(self.user)
        path = f"{self.path}?next=/welcome/"

        with self.feature({"system:multi-region": True}):
            response = self.client.get(
                path, HTTP_HOST=f"{organization.slug}.testserver", follow=True
            )

        assert response.status_code == 200
        assert response.redirect_chain == [(f"http://testserver{path}", 302)]
        self.assertTemplateUsed(response, "sentry/base-react.html")

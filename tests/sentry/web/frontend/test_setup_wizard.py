from django.urls import reverse

from sentry.testutils.cases import PermissionTestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test


@control_silo_test
class SetupWizard(PermissionTestCase):
    def test_authenticated(self) -> None:
        self.login_as(self.user)
        url = reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "session-hash"})

        response = self.client.get(url)

        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/base-react.html")

    def test_anonymous(self) -> None:
        url = reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "session-hash"})

        response = self.client.get(f"{url}?signup=1&partner=partner-slug")

        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/base-react.html")

    def test_renders_outside_active_organization(self) -> None:
        organization = self.create_organization(owner=self.user)
        self.login_as(self.user)
        session = self.client.session
        session["activeorg"] = organization.id
        session.save()
        url = reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "session-hash"})

        with self.feature({"system:multi-region": True}):
            response = self.client.get(url)

        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/base-react.html")

    def test_redirect_from_customer_domain(self) -> None:
        organization = self.create_organization(owner=self.user)
        self.login_as(self.user)
        url = reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "session-hash"})
        query = "?signup=1&partner=partner-slug"

        with (
            self.feature({"system:multi-region": True}),
            override_options({"system.url-prefix": "http://testserver"}),
        ):
            response = self.client.get(f"{url}{query}", HTTP_HOST=f"{organization.slug}.testserver")

        assert response.status_code == 302
        assert response["Location"] == f"http://testserver{url}{query}"

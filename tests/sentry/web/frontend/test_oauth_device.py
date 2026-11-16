from functools import cached_property

from django.urls import reverse

from sentry.models.apiapplication import ApiApplication
from sentry.models.apidevicecode import ApiDeviceCode, DeviceCodeStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OAuthDevicePageTest(TestCase):
    @cached_property
    def path(self) -> str:
        return reverse("sentry-oauth-device")

    def setUp(self) -> None:
        super().setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user, redirect_uris="https://example.com", name="Test App"
        )
        self.device_code = ApiDeviceCode.objects.create(
            application=self.application,
            scope_list=["project:read", "org:read"],
        )

    def test_stays_on_primary_domain_with_active_organization(self) -> None:
        organization = self.create_organization(owner=self.user)
        self.login_as(self.user)
        session = self.client.session
        session["activeorg"] = organization.slug
        session.save()
        path = f"{self.path}?user_code=ABCD-EFGH"

        with self.feature({"system:multi-region": True}):
            response = self.client.get(path, HTTP_HOST="testserver", follow=True)

        assert response.status_code == 200
        assert response.redirect_chain == []
        self.assertTemplateUsed(response, "sentry/base-react.html")

    def test_customer_domain_redirects_to_primary_domain(self) -> None:
        organization = self.create_organization(owner=self.user)
        self.login_as(self.user)
        session = self.client.session
        session["activeorg"] = organization.slug
        session.save()
        path = f"{self.path}?user_code=ABCD-EFGH"

        with self.feature({"system:multi-region": True}):
            response = self.client.get(
                path, HTTP_HOST=f"{organization.slug}.testserver", follow=True
            )

        assert response.status_code == 200
        assert response.redirect_chain == [(f"http://testserver{path}", 302)]
        self.assertTemplateUsed(response, "sentry/base-react.html")

    def test_code_entry_is_public(self) -> None:
        response = self.client.get(self.path)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/base-react.html")

    def test_verification_is_public(self) -> None:
        response = self.client.get(self.path, {"user_code": self.device_code.user_code})
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/base-react.html")
        self.device_code.refresh_from_db()
        assert self.device_code.status == DeviceCodeStatus.PENDING

    def test_shell_is_not_cacheable(self) -> None:
        response = self.client.get(self.path)

        assert response.status_code == 200
        assert "no-store" in response["Cache-Control"]

    def test_consent_requires_api(self) -> None:
        self.login_as(self.user)
        response = self.client.post(self.path, {"op": "approve"})

        assert response.status_code == 405

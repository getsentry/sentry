from functools import cached_property
from unittest import mock

from django.test import override_settings
from django.urls import reverse

from sentry.ratelimits.config import RateLimitConfig
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.silo import control_silo_test
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.web.frontend.auth_login import AuthPageView


# TODO(dcramer): need tests for SSO behavior and single org behavior
@control_silo_test
class AuthLoginTest(TestCase, HybridCloudTestMixin):
    @cached_property
    def path(self) -> str:
        return reverse("sentry-login")

    def allow_registration(self):
        return self.options({"auth.allow-registration": True})

    def test_login_post_requires_api(self) -> None:
        response = self.client.post(self.path, {"op": "login"})

        assert response.status_code == 405

    def test_registration_post_requires_api(self) -> None:
        response = self.client.post(reverse("sentry-register"), {"op": "register"})

        assert response.status_code == 405

    def test_renders_react_template_by_default(self) -> None:
        response = self.client.get(self.path)

        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/base-react.html")

    @with_feature("system:multi-region")
    def test_customer_domain_login_redirects_to_primary_domain(self) -> None:
        organization = self.create_organization(slug="customer-domain-org")

        response = self.client.get(
            f"{self.path}?next=%2Fsettings%2Faccount%2F",
            HTTP_HOST=f"{organization.slug}.testserver",
            follow=True,
        )

        assert response.status_code == 200
        assert response.redirect_chain == [
            (
                f"http://testserver/auth/login/{organization.slug}/?next=%2Fsettings%2Faccount%2F",
                302,
            )
        ]
        self.assertTemplateUsed(response, "sentry/base-react.html")

    @with_feature("system:multi-region")
    def test_customer_domain_register_redirects_to_primary_domain_registration(self) -> None:
        organization = self.create_organization(slug="customer-domain-org")
        self.session["can_register"] = True
        self.save_session()

        response = self.client.get(
            reverse("sentry-register"),
            HTTP_HOST=f"{organization.slug}.testserver",
            follow=True,
        )

        assert response.status_code == 200
        assert response.redirect_chain == [("http://testserver/auth/register/", 302)]
        self.assertTemplateUsed(response, "sentry/base-react.html")

    def test_customer_domain_login_does_not_redirect_without_multi_region(self) -> None:
        organization = self.create_organization(slug="customer-domain-org")

        response = self.client.get(
            self.path,
            HTTP_HOST=f"{organization.slug}.testserver",
        )

        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/base-react.html")

    @override_settings(SENTRY_SELF_HOSTED=False)
    @mock.patch.object(
        AuthPageView,
        "rate_limits",
        RateLimitConfig(
            limit_overrides={
                "GET": {
                    RateLimitCategory.IP: RateLimit(limit=20, window=60),
                }
            }
        ),
    )
    def test_login_ratelimited_ip_gets(self) -> None:
        url = reverse("sentry-login")

        with freeze_time("2000-01-01"):
            for _ in range(25):
                self.client.get(url)
            resp = self.client.get(url)
            assert resp.status_code == 429

    def test_register_renders_correct_template(self) -> None:
        with self.allow_registration():
            register_path = reverse("sentry-register")
            resp = self.client.get(register_path)

            assert resp.status_code == 200
            self.assertTemplateUsed("sentry/base-react.html")


@control_silo_test
class AuthLoginCustomerDomainTest(TestCase):
    @cached_property
    def path(self) -> str:
        return reverse("sentry-login")

    def setUp(self) -> None:
        super().setUp()

    def disable_registration(self):
        return self.options({"auth.allow-registration": False})

    def test_renders_correct_template_nonexistent_org(self) -> None:
        with self.disable_registration():
            resp = self.client.get(
                self.path,
                HTTP_HOST="does-not-exist.testserver",
            )

            assert resp.status_code == 200
            self.assertTemplateUsed("sentry/base-react.html")

    def test_explicit_org_path_does_not_use_customer_domain_subdomain(self) -> None:
        visible_org = self.create_organization(owner=self.user)
        self.create_organization(name="albertos-apples")
        self.login_as(self.user)

        resp = self.client.get(
            reverse("sentry-organization-issue-list", args=[visible_org.slug]),
            HTTP_HOST="albertos-apples.testserver",
        )

        assert resp.status_code == 200

from functools import cached_property
from unittest import mock
from urllib.parse import quote as urlquote

from django.test import override_settings
from django.urls import reverse

from sentry.auth.authenticators.recovery_code import RecoveryCodeInterface
from sentry.auth.authenticators.totp import TotpInterface
from sentry.models.authprovider import AuthProvider
from sentry.ratelimits.config import RateLimitConfig
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.silo import control_silo_test
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.models.user import User
from sentry.web.frontend.auth_login import AuthLoginView


# TODO(dcramer): need tests for SSO behavior and single org behavior
@control_silo_test
class AuthLoginTest(TestCase, HybridCloudTestMixin):
    @cached_property
    def path(self) -> str:
        return reverse("sentry-login")

    def setUp(self) -> None:
        super().setUp()
        self.client.get(reverse("sentry-api-0-auth-config"))

    def allow_registration(self):
        return self.options({"auth.allow-registration": True})

    def test_renders_react_template(self) -> None:
        response = self.client.get(self.path)

        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/base-react.html")
        self.assertTemplateNotUsed(response, "sentry/login.html")

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

    def test_login_invalid_password(self) -> None:
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(
            self.path, {"username": self.user.username, "password": "bizbar", "op": "login"}
        )
        assert resp.status_code == 200
        assert resp.context["login_form"].errors["__all__"] == [
            "Please enter a correct username and password. Note that both fields may be case-sensitive."
        ]

    @override_settings(SENTRY_SELF_HOSTED=False)
    @mock.patch.object(
        AuthLoginView,
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

    def test_login_ratelimited_user(self) -> None:
        self.client.get(self.path)
        # Make sure user gets ratelimited
        for i in range(5):
            self.client.post(
                self.path,
                {"username": self.user.username, "password": "wront_password", "op": "login"},
                follow=True,
            )
        resp = self.client.post(
            self.path,
            {"username": self.user.username, "password": "admin", "op": "login"},
            follow=True,
        )
        assert resp.status_code == 200
        assert resp.redirect_chain == []
        assert (
            "You have made too many login attempts. Please try again later."
            in resp.content.decode()
        )

    def test_login_valid_credentials(self) -> None:
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(
            self.path,
            {"username": self.user.username, "password": "admin", "op": "login"},
            follow=True,
        )
        assert resp.status_code == 200
        assert resp.redirect_chain == [(reverse("sentry-login"), 302)]

    def test_login_valid_credentials_with_org(self) -> None:
        self.create_organization(owner=self.user)
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(
            self.path,
            {"username": self.user.username, "password": "admin", "op": "login"},
            follow=True,
        )
        assert resp.status_code == 200
        assert resp.redirect_chain == [(reverse("sentry-login"), 302)]

    def test_login_invalid_op(self) -> None:
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(
            self.path,
            {"username": self.user.username, "password": "admin", "op": "alert('hackerman')"},
            follow=True,
        )
        assert resp.status_code == 400

    def test_login_suspended_user(self) -> None:
        self.user.update(is_suspended=True)
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(
            self.path,
            {"username": self.user.username, "password": "admin", "op": "login"},
        )
        assert resp.status_code == 200
        assert b"Your account has been suspended." in resp.content
        assert "_auth_user_id" not in self.client.session

    def test_login_valid_credentials_2fa_redirect(self) -> None:
        user = self.create_user("bar@example.com")
        RecoveryCodeInterface().enroll(user)
        TotpInterface().enroll(user)
        self.create_member(organization=self.organization, user=user)

        self.client.get(self.path)

        resp = self.client.post(
            self.path,
            {"username": user.username, "password": "admin", "op": "login"},
            follow=True,
        )
        assert resp.status_code == 200
        assert resp.redirect_chain == [(reverse("sentry-login"), 302)]

        with mock.patch("sentry.auth.authenticators.TotpInterface.validate_otp", return_value=True):
            resp = self.client.post(reverse("sentry-2fa-dialog"), {"otp": "something"}, follow=True)
            assert resp.status_code == 200
            assert resp.redirect_chain == [(reverse("sentry-login"), 302)]

    @with_feature("system:multi-region")
    def test_login_valid_credentials_with_org_and_customer_domains(self) -> None:
        org = self.create_organization(owner=self.user)
        # load it once for test cookie
        self.client.get(self.path)

        resp = self.client.post(
            self.path,
            {"username": self.user.username, "password": "admin", "op": "login"},
            follow=True,
        )
        assert resp.status_code == 200
        assert resp.redirect_chain == [
            (f"http://{org.slug}.testserver/auth/login/", 302),
            ("http://testserver/auth/login/", 302),
        ]

    @with_feature("system:multi-region")
    def test_redirect_to_login_with_org_and_customer_domains(self) -> None:
        org = self.create_organization(owner=self.user)
        self.create_project(organization=org, name="project")
        # load it once for test cookie
        self.client.get(self.path)

        project_path = reverse("project-details", kwargs={"project_slug": "project"})
        resp = self.client.get(project_path, HTTP_HOST=f"{org.slug}.testserver")

        assert resp.status_code == 302
        # redirect to auth org login page by parsing customer domain
        redirect_url = getattr(resp, "url", None)
        assert redirect_url == reverse("sentry-auth-organization", args=[org.slug])

        # Canonicalize the customer-domain login URL onto the primary domain.
        resp = self.client.get(redirect_url, HTTP_HOST=f"{org.slug}.testserver")
        assert resp.status_code == 302
        assert resp["Location"] == f"http://testserver/auth/login/{org.slug}/"

    def test_register_renders_correct_template(self) -> None:
        with self.allow_registration():
            register_path = reverse("sentry-register")
            resp = self.client.get(register_path)

            assert resp.status_code == 200
            self.assertTemplateUsed(resp, "sentry/base-react.html")

    @override_options({"auth.allow-registration": True})
    @with_feature("auth:register")
    def test_registration_post_requires_auth_api(self) -> None:
        for route in ("sentry-login", "sentry-register"):
            with self.subTest(route=route):
                response = self.client.post(
                    reverse(route),
                    {
                        "username": "new.user@example.com",
                        "password": "new-secure-password",
                        "name": "New User",
                        "op": "register",
                    },
                )

                assert response.status_code == 400
                assert not User.objects.filter(email="new.user@example.com").exists()

    def test_doesnt_redirect_to_external_next_url(self) -> None:
        next = "http://example.com"
        self.client.get(self.path + "?next=" + urlquote(next))

        resp = self.client.post(
            self.path,
            {"username": self.user.username, "password": "admin", "op": "login"},
            follow=True,
        )
        assert resp.redirect_chain == [(reverse("sentry-login"), 302)]

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [1]})
    def test_login_demo_mode(self) -> None:
        demo_user = self.create_user(
            is_staff=False,
            email="readonly@example.com",
            password="foo",
            id=1,
        )
        self.client.get(self.path)

        resp = self.client.post(
            self.path,
            # login with any password
            {"username": demo_user.username, "password": "bar", "op": "login"},
            follow=True,
        )

        assert resp.status_code == 200
        # successful login redirects to organizations/new
        assert resp.redirect_chain == [(reverse("sentry-login"), 302)]

    @override_options({"demo-mode.enabled": False, "demo-mode.users": [1]})
    def test_login_demo_mode_disabled(self) -> None:
        demo_user = self.create_user(
            is_staff=False,
            id=1,
            email="readonly@example.com",
            password="foo",
        )
        self.client.get(self.path)

        resp = self.client.post(
            self.path,
            # login with any password
            {"username": demo_user.username, "password": "bar", "op": "login"},
            follow=True,
        )

        assert resp.status_code == 200
        assert resp.redirect_chain == []
        assert "Please enter a correct username and password" in resp.content.decode()

    @override_options({"demo-mode.enabled": True, "demo-mode.users": []})
    def test_login_demo_mode_not_demo_user(self) -> None:
        demo_user = self.create_user(
            is_staff=False,
            id=1,
            email="readonly@example.com",
            password="foo",
        )
        self.client.get(self.path)

        resp = self.client.post(
            self.path,
            # login with any password
            {"username": demo_user.username, "password": "bar", "op": "login"},
            follow=True,
        )

        assert resp.status_code == 200
        assert resp.redirect_chain == []
        assert "Please enter a correct username and password" in resp.content.decode()

    def test_login_demo_mode_with_org(self) -> None:
        demo_user = self.create_user(
            is_staff=False,
            email="readonly@example.com",
            password="foo",
        )
        demo_org = self.create_organization(owner=demo_user)

        with override_options(
            {
                "demo-mode.enabled": True,
                "demo-mode.users": [demo_user.id],
                "demo-mode.orgs": [demo_org.id],
            }
        ):
            self.client.get(self.path)

            resp = self.client.post(
                self.path,
                # login with any password
                {"username": demo_user.username, "password": "bar", "op": "login"},
                follow=True,
            )

            assert resp.status_code == 200
            # successful login redirects to demo orgs issue stream
            assert resp.redirect_chain == [(reverse("sentry-login"), 302)]


@control_silo_test
class AuthLoginCustomerDomainTest(TestCase):
    @cached_property
    def path(self) -> str:
        return reverse("sentry-login")

    def setUp(self) -> None:
        super().setUp()
        self.client.get(reverse("sentry-api-0-auth-config"))

    def disable_registration(self):
        return self.options({"auth.allow-registration": False})

    def test_renders_correct_template_existent_org(self) -> None:
        with self.disable_registration():
            resp = self.client.get(
                self.path,
                HTTP_HOST=f"{self.organization.slug}.testserver",
                follow=True,
            )

            assert resp.status_code == 200
            assert resp.redirect_chain == []
            self.assertTemplateUsed(resp, "sentry/base-react.html")

    def test_renders_correct_template_existent_org_preserve_querystring(self) -> None:
        with self.disable_registration():
            resp = self.client.get(
                f"{self.path}?one=two",
                HTTP_HOST=f"{self.organization.slug}.testserver",
                follow=True,
            )

            assert resp.status_code == 200
            assert resp.redirect_chain == []
            self.assertTemplateUsed(resp, "sentry/base-react.html")

    def test_renders_correct_template_nonexistent_org(self) -> None:
        with self.disable_registration():
            resp = self.client.get(
                self.path,
                HTTP_HOST="does-not-exist.testserver",
            )

            assert resp.status_code == 200
            self.assertTemplateUsed(resp, "sentry/base-react.html")

    def test_explicit_org_path_does_not_use_customer_domain_subdomain(self) -> None:
        visible_org = self.create_organization(owner=self.user)
        self.create_organization(name="albertos-apples")
        self.login_as(self.user)

        resp = self.client.get(
            reverse("sentry-organization-issue-list", args=[visible_org.slug]),
            HTTP_HOST="albertos-apples.testserver",
        )

        assert resp.status_code == 200

    def test_login_valid_credentials(self) -> None:
        # load it once for test cookie
        with self.disable_registration():
            self.client.get(self.path)

            resp = self.client.post(
                self.path,
                {"username": self.user.username, "password": "admin", "op": "login"},
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )

            assert resp.status_code == 200
            assert resp.redirect_chain == [("http://albertos-apples.testserver/auth/login/", 302)]
            self.assertTemplateUsed(resp, "sentry/base-react.html")

    def test_login_valid_credentials_with_org(self) -> None:
        with self.disable_registration():
            self.create_organization(name="albertos-apples", owner=self.user)
            # load it once for test cookie
            self.client.get(self.path)

            resp = self.client.post(
                self.path,
                {"username": self.user.username, "password": "admin", "op": "login"},
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )
            assert resp.status_code == 200
            assert resp.redirect_chain == [("http://albertos-apples.testserver/auth/login/", 302)]

    def test_login_valid_credentials_invalid_customer_domain(self) -> None:
        with self.feature("system:multi-region"), self.disable_registration():
            self.create_organization(name="albertos-apples", owner=self.user)

            # load it once for test cookie
            self.client.get(self.path)
            resp = self.client.post(
                self.path,
                {"username": self.user.username, "password": "admin", "op": "login"},
                HTTP_POST="invalid.testserver",
                follow=True,
            )

            assert resp.status_code == 200
            assert resp.redirect_chain == [
                ("http://albertos-apples.testserver/auth/login/", 302),
                ("http://testserver/auth/login/", 302),
            ]

    def test_login_valid_credentials_non_staff(self) -> None:
        with self.disable_registration():
            org = self.create_organization(name="albertos-apples")
            non_staff_user = self.create_user(is_staff=False)
            self.create_member(organization=org, user=non_staff_user)

            # load it once for test cookie
            self.client.get(self.path)

            resp = self.client.post(
                self.path,
                {"username": non_staff_user.username, "password": "admin", "op": "login"},
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )
            assert resp.status_code == 200
            assert resp.redirect_chain == [("http://albertos-apples.testserver/auth/login/", 302)]

    def test_login_valid_credentials_not_a_member(self) -> None:
        user = self.create_user()
        self.create_organization(name="albertos-apples")
        self.create_member(organization=self.organization, user=user)
        with self.disable_registration():
            # load it once for test cookie
            self.client.get(self.path)

            resp = self.client.post(
                self.path,
                {"username": user.username, "password": "admin", "op": "login"},
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )

            assert resp.status_code == 200
            assert resp.redirect_chain == [
                (f"http://albertos-apples.testserver{reverse('sentry-login')}", 302)
            ]

    def test_login_valid_credentials_orgless(self) -> None:
        user = self.create_user()
        self.create_organization(name="albertos-apples")
        with self.disable_registration():
            # load it once for test cookie
            self.client.get(self.path)

            resp = self.client.post(
                self.path,
                {"username": user.username, "password": "admin", "op": "login"},
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )

            assert resp.status_code == 200
            assert resp.redirect_chain == [("http://albertos-apples.testserver/auth/login/", 302)]

    def test_login_valid_credentials_org_does_not_exist(self) -> None:
        user = self.create_user()
        with self.disable_registration():
            # load it once for test cookie
            self.client.get(self.path)

            resp = self.client.post(
                self.path,
                {"username": user.username, "password": "admin", "op": "login"},
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )

            assert resp.status_code == 200
            assert resp.redirect_chain == [("http://albertos-apples.testserver/auth/login/", 302)]

    def test_login_redirects_to_sso_org_does_not_exist(self) -> None:
        # load it once for test cookie
        with self.disable_registration():
            user = self.create_user()

            self.client.get(self.path)
            user = self.create_user()
            resp = self.client.post(
                self.path,
                {
                    "username": user.username,
                    "password": "admin",
                    "op": "sso",
                    "organization": "foobar",
                },
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )
            assert resp.status_code == 200
            assert resp.redirect_chain == [("/auth/login/", 302)]  # Redirects to default login

    def test_login_redirects_to_sso_provider_does_not_exist(self) -> None:
        # load it once for test cookie
        with self.disable_registration():
            user = self.create_user()
            self.create_organization(name="albertos-apples")

            self.client.get(self.path)
            user = self.create_user()
            resp = self.client.post(
                self.path,
                {
                    "username": user.username,
                    "password": "admin",
                    "op": "sso",
                    "organization": "albertos-apples",
                },
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )
            assert resp.status_code == 200
            assert resp.redirect_chain == [("/auth/login/", 302)]  # Redirects to default login

    def test_login_redirects_to_sso_provider(self) -> None:
        # load it once for test cookie
        with self.disable_registration():
            user = self.create_user()
            custom_organization = self.create_organization(name="albertos-apples")
            AuthProvider.objects.create(organization_id=custom_organization.id, provider="dummy")
            self.client.get(self.path)
            user = self.create_user()
            resp = self.client.post(
                self.path,
                {
                    "username": user.username,
                    "password": "admin",
                    "op": "sso",
                    "organization": "albertos-apples",
                },
                HTTP_HOST="albertos-apples.testserver",
                follow=True,
            )
            assert resp.status_code == 200
            assert resp.redirect_chain == [("/auth/login/albertos-apples/", 302)]

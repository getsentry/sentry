from functools import cached_property
from unittest import mock

from django.conf import settings
from django.test import override_settings
from django.urls import reverse

from sentry import options
from sentry.api.utils import generate_region_url
from sentry.auth import superuser
from sentry.conf.types.sentry_config import SentryMode
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.deletions.tasks.scheduled import run_deletion
from sentry.models.apitoken import ApiToken
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmember import OrganizationMember
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode, create_test_regions, region_silo_test
from sentry.utils import json


class CrossDomainXmlTest(TestCase):
    @cached_property
    def path(self):
        return reverse("sentry-api-crossdomain-xml", kwargs={"project_id": self.project.id})

    def test_inaccessible_in_control_silo(self):
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            resp = self.client.get(self.path)
            assert resp.status_code == 404

    @mock.patch("sentry.web.api.get_origins")
    def test_output_with_global(self, get_origins):
        get_origins.return_value = "*"
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        assert resp.status_code == 200, resp.content
        self.assertEqual(resp["Content-Type"], "application/xml")
        self.assertTemplateUsed(resp, "sentry/crossdomain.xml")
        assert b'<allow-access-from domain="*" secure="false" />' in resp.content

    @mock.patch("sentry.web.api.get_origins")
    def test_output_with_allowed_origins(self, get_origins):
        get_origins.return_value = ["disqus.com", "www.disqus.com"]
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "application/xml")
        self.assertTemplateUsed(resp, "sentry/crossdomain.xml")
        assert b'<allow-access-from domain="disqus.com" secure="false" />' in resp.content
        assert b'<allow-access-from domain="www.disqus.com" secure="false" />' in resp.content

    @mock.patch("sentry.web.api.get_origins")
    def test_output_with_no_origins(self, get_origins):
        get_origins.return_value = []
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "application/xml")
        self.assertTemplateUsed(resp, "sentry/crossdomain.xml")
        assert b"<allow-access-from" not in resp.content

    def test_output_allows_x_sentry_auth(self):
        resp = self.client.get(self.path)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "application/xml")
        self.assertTemplateUsed(resp, "sentry/crossdomain.xml")
        assert (
            b'<allow-http-request-headers-from domain="*" headers="*" secure="false" />'
            in resp.content
        )


class RobotsTxtTest(TestCase):
    @cached_property
    def path(self):
        return reverse("sentry-robots-txt")

    def test_robots_self_hosted(self):
        with override_settings(SENTRY_MODE=SentryMode.SELF_HOSTED):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "text/plain"
            assert (
                resp.content
                == b"""\
User-agent: *
Disallow: /
"""
            )

    def test_robots_saas(self):
        with override_settings(SENTRY_MODE=SentryMode.SAAS):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "text/plain"
            # This is sentry.io/robots.txt.
            assert (
                resp.content
                == b"""\
User-agent: *
Disallow: /api/
Allow: /api/*/store/
Allow: /

Sitemap: https://sentry.io/sitemap-index.xml
"""
            )

            # SaaS customer domains should disallow all.
            resp = self.client.get(self.path, HTTP_HOST="foo.testserver")
            assert resp.status_code == 200
            assert resp["Content-Type"] == "text/plain"
            assert (
                resp.content
                == b"""\
User-agent: *
Disallow: /
"""
            )

    def test_robots_single_tenant(self):
        with override_settings(SENTRY_MODE=SentryMode.SINGLE_TENANT):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "text/plain"
            assert (
                resp.content
                == b"""\
User-agent: *
Disallow: /
"""
            )


@region_silo_test(regions=create_test_regions("us", "eu"), include_monolith_run=True)
class ClientConfigViewTest(TestCase):
    @cached_property
    def path(self):
        return reverse("sentry-api-client-config")

    def test_cookie_names(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert data["csrfCookieName"] == "sc"
        assert data["csrfCookieName"] == settings.CSRF_COOKIE_NAME
        assert data["superUserCookieName"] == "su"
        assert data["superUserCookieName"] == superuser.COOKIE_NAME

    def test_has_user_registration(self):
        with self.options({"auth.allow-registration": True}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"
            data = json.loads(resp.content)
            assert data["features"] == [
                "organizations:create",
                "auth:register",
            ]

        with self.options({"auth.allow-registration": False}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"
            data = json.loads(resp.content)
            assert data["features"] == [
                "organizations:create",
            ]

    def test_org_create_feature(self):
        with self.feature({"organizations:create": True}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"
            data = json.loads(resp.content)
            assert data["features"] == [
                "organizations:create",
            ]

        with self.feature({"organizations:create": False}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"
            data = json.loads(resp.content)
            assert data["features"] == []

    def test_customer_domain_feature(self):
        self.login_as(self.user)

        # Induce last active organization
        resp = self.client.get(
            reverse("sentry-api-0-organization-projects", args=[self.organization.slug])
        )
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        with self.feature({"system:multi-region": True}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"
            data = json.loads(resp.content)
            assert data["lastOrganization"] == self.organization.slug
            assert data["features"] == [
                "organizations:create",
                "system:multi-region",
            ]

        with self.feature({"system:multi-region": False}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"
            data = json.loads(resp.content)
            assert data["features"] == [
                "organizations:create",
            ]

            # Customer domain feature is injected if a customer domain is used.
            resp = self.client.get(self.path, HTTP_HOST="albertos-apples.testserver")
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"
            data = json.loads(resp.content)
            assert data["features"] == ["organizations:create"]

    def test_unauthenticated(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert not data["isAuthenticated"]
        assert data["user"] is None
        assert data["features"] == ["organizations:create"]
        assert data["customerDomain"] is None

    def test_authenticated(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert data["isAuthenticated"]
        assert data["user"]
        assert data["user"]["email"] == user.email
        assert data["features"] == ["organizations:create"]
        assert data["customerDomain"] is None

    def _run_test_with_privileges(self, is_superuser: bool, is_staff: bool):
        user = self.create_user("foo@example.com", is_superuser=is_superuser, is_staff=is_staff)
        self.create_organization(owner=user)
        self.login_as(user, superuser=is_superuser, staff=is_staff)

        other_org = self.create_organization()

        with mock.patch("sentry.auth.superuser.SUPERUSER_ORG_ID", self.organization.id):
            resp = self.client.get(self.path)

        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert data["isAuthenticated"]
        assert data["user"]
        assert data["user"]["email"] == user.email
        assert data["user"]["isSuperuser"] is is_superuser
        assert data["lastOrganization"] is None
        if is_superuser:
            assert data["links"] == {
                "organizationUrl": None,
                "regionUrl": None,
                "sentryUrl": "http://testserver",
                "superuserUrl": f"http://{self.organization.slug}.testserver",
            }
        else:
            assert data["links"] == {
                "organizationUrl": None,
                "regionUrl": None,
                "sentryUrl": "http://testserver",
            }
        assert "activeorg" not in self.client.session

        # Induce last active organization
        with (
            self.feature({"system:multi-region": [other_org.slug]}),
            assume_test_silo_mode(SiloMode.MONOLITH),
        ):
            response = self.client.get(
                "/",
                HTTP_HOST=f"{other_org.slug}.testserver",
                follow=True,
            )
            assert response.status_code == 200
            if is_superuser:
                assert response.redirect_chain == [
                    (f"http://{other_org.slug}.testserver/issues/", 302)
                ]
                assert self.client.session["activeorg"] == other_org.slug
            else:
                assert response.redirect_chain == [
                    (f"http://{other_org.slug}.testserver/auth/login/{other_org.slug}/", 302)
                ]
                assert "activeorg" not in self.client.session

        # lastOrganization is set
        with mock.patch("sentry.auth.superuser.SUPERUSER_ORG_ID", self.organization.id):
            resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)

        if is_superuser:
            assert data["lastOrganization"] == other_org.slug
            assert data["links"] == {
                "organizationUrl": f"http://{other_org.slug}.testserver",
                "regionUrl": generate_region_url(),
                "sentryUrl": "http://testserver",
                "superuserUrl": f"http://{self.organization.slug}.testserver",
            }
        else:
            assert data["lastOrganization"] is None
            assert data["links"] == {
                "organizationUrl": None,
                "regionUrl": None,
                "sentryUrl": "http://testserver",
            }

    def test_superuser(self):
        self._run_test_with_privileges(is_superuser=True, is_staff=False)

    @override_options({"staff.ga-rollout": True})
    def test_staff(self):
        self._run_test_with_privileges(is_superuser=False, is_staff=True)

    @override_options({"staff.ga-rollout": True})
    def test_superuser_and_staff(self):
        self._run_test_with_privileges(is_superuser=True, is_staff=True)

    def test_superuser_cookie_domain(self):
        # Cannot set the superuser cookie domain using override_settings().
        # So we set them and restore them manually.
        old_super_cookie_domain = superuser.COOKIE_DOMAIN
        superuser.COOKIE_DOMAIN = ".testserver"

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"
        data = json.loads(resp.content)
        assert data["superUserCookieDomain"] == ".testserver"

        superuser.COOKIE_DOMAIN = None

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"
        data = json.loads(resp.content)
        assert data["superUserCookieDomain"] is None

        # Restore values
        superuser.COOKIE_DOMAIN = old_super_cookie_domain

    def test_links_unauthenticated(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert not data["isAuthenticated"]
        assert data["user"] is None
        assert data["lastOrganization"] is None
        assert data["links"] == {
            "organizationUrl": None,
            "regionUrl": None,
            "sentryUrl": "http://testserver",
        }

    def test_links_authenticated(self):
        self.login_as(self.user)

        # Induce last active organization
        resp = self.client.get(
            reverse("sentry-api-0-organization-projects", args=[self.organization.slug])
        )
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)

        assert data["isAuthenticated"] is True
        assert data["lastOrganization"] == self.organization.slug
        assert data["links"] == {
            "organizationUrl": f"http://{self.organization.slug}.testserver",
            "regionUrl": generate_region_url(),
            "sentryUrl": "http://testserver",
        }

    def test_organization_url_region(self):
        self.login_as(self.user)

        # Induce last active organization
        resp = self.client.get(
            reverse("sentry-api-0-organization-projects", args=[self.organization.slug])
        )
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        with override_settings(SENTRY_REGION="eu"):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"

            data = json.loads(resp.content)

            assert data["isAuthenticated"] is True
            assert data["lastOrganization"] == self.organization.slug
            assert data["links"] == {
                "organizationUrl": f"http://{self.organization.slug}.testserver",
                "regionUrl": generate_region_url(),
                "sentryUrl": "http://testserver",
            }

    def test_organization_url_organization_base_hostname(self):
        self.login_as(self.user)

        # Induce last active organization
        resp = self.client.get(
            reverse("sentry-api-0-organization-projects", args=[self.organization.slug])
        )
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        with self.options({"system.organization-base-hostname": "invalid"}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"

            data = json.loads(resp.content)

            assert data["isAuthenticated"] is True
            assert data["lastOrganization"] == self.organization.slug
            assert data["links"] == {
                "organizationUrl": "http://testserver",
                "regionUrl": generate_region_url(),
                "sentryUrl": "http://testserver",
            }

        with self.options({"system.organization-base-hostname": "{slug}.testserver"}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"

            data = json.loads(resp.content)

            assert data["isAuthenticated"] is True
            assert data["lastOrganization"] == self.organization.slug
            assert data["links"] == {
                "organizationUrl": f"http://{self.organization.slug}.testserver",
                "regionUrl": generate_region_url(),
                "sentryUrl": "http://testserver",
            }

    def test_organization_url_organization_url_template(self):
        self.login_as(self.user)

        # Induce last active organization
        resp = self.client.get(
            reverse("sentry-api-0-organization-projects", args=[self.organization.slug])
        )
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        with self.options({"system.organization-url-template": "invalid"}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"

            data = json.loads(resp.content)

            assert data["isAuthenticated"] is True
            assert data["lastOrganization"] == self.organization.slug
            assert data["links"] == {
                "organizationUrl": "invalid",
                "regionUrl": generate_region_url(),
                "sentryUrl": "http://testserver",
            }

        with self.options({"system.organization-url-template": None}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"

            data = json.loads(resp.content)

            assert data["isAuthenticated"] is True
            assert data["lastOrganization"] == self.organization.slug
            assert data["links"] == {
                "organizationUrl": "http://testserver",
                "regionUrl": generate_region_url(),
                "sentryUrl": "http://testserver",
            }

        with self.options({"system.organization-url-template": "ftp://{hostname}"}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"

            data = json.loads(resp.content)

            assert data["isAuthenticated"] is True
            assert data["lastOrganization"] == self.organization.slug
            assert data["links"] == {
                "organizationUrl": f"ftp://{self.organization.slug}.testserver",
                "regionUrl": generate_region_url(),
                "sentryUrl": "http://testserver",
            }

    def test_deleted_last_organization(self):
        self.login_as(self.user)

        # Check lastOrganization
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)

        assert data["isAuthenticated"] is True
        assert data["lastOrganization"] is None
        assert "activeorg" not in self.client.session

        # Induce last active organization
        resp = self.client.get(
            reverse("sentry-api-0-organization-projects", args=[self.organization.slug])
        )
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        # Check lastOrganization
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)

        assert data["isAuthenticated"] is True
        assert data["lastOrganization"] == self.organization.slug
        assert self.client.session["activeorg"] == self.organization.slug

        # Delete lastOrganization
        assert Organization.objects.filter(slug=self.organization.slug).count() == 1
        assert RegionScheduledDeletion.objects.count() == 0

        self.organization.update(status=OrganizationStatus.PENDING_DELETION)
        deletion = RegionScheduledDeletion.schedule(self.organization, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert Organization.objects.filter(slug=self.organization.slug).count() == 0

        # Check lastOrganization
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)

        assert data["isAuthenticated"] is True
        assert data["lastOrganization"] is None
        assert "activeorg" not in self.client.session

    def test_not_member_of_last_org(self):
        self.login_as(self.user)
        other_org = self.create_organization(
            name="other_org", owner=self.create_user("bar@example.com")
        )
        member_om = self.create_member(user=self.user, organization=other_org, role="owner")

        # Check lastOrganization
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)

        assert data["isAuthenticated"] is True
        assert data["lastOrganization"] is None
        assert "activeorg" not in self.client.session

        # Induce last active organization
        resp = self.client.get(reverse("sentry-api-0-organization-projects", args=[other_org.slug]))
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        # Check lastOrganization
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)

        assert data["isAuthenticated"] is True
        assert data["lastOrganization"] == other_org.slug
        assert self.client.session["activeorg"] == other_org.slug

        # Delete membership
        assert OrganizationMember.objects.filter(id=member_om.id).exists()
        resp = self.client.delete(
            reverse("sentry-api-0-organization-member-details", args=[other_org.slug, member_om.id])
        )
        assert resp.status_code == 204
        assert not OrganizationMember.objects.filter(id=member_om.id).exists()

        # Check lastOrganization
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)

        assert data["isAuthenticated"] is True
        assert data["lastOrganization"] is None
        assert "activeorg" not in self.client.session

    def test_api_token(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            api_token = ApiToken.objects.create(
                user=self.user, scope_list=["org:write", "org:read"]
            )
        HTTP_AUTHORIZATION = f"Bearer {api_token.token}"

        # Induce last active organization
        resp = self.client.get(
            reverse("sentry-api-0-organization-projects", args=[self.organization.slug]),
            HTTP_AUTHORIZATION=HTTP_AUTHORIZATION,
        )
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"
        assert "activeorg" not in self.client.session

        # Load client config
        response = self.client.get(self.path, HTTP_AUTHORIZATION=HTTP_AUTHORIZATION)
        assert response.status_code == 200
        assert response["Content-Type"] == "application/json"

        data = json.loads(response.content)

        assert data["isAuthenticated"] is True
        assert data["lastOrganization"] is None
        assert data["links"] == {
            "organizationUrl": None,
            "regionUrl": None,
            "sentryUrl": "http://testserver",
        }

    def test_region_api_url_template(self):
        self.login_as(self.user)

        # Induce last active organization
        resp = self.client.get(
            reverse("sentry-api-0-organization-projects", args=[self.organization.slug])
        )
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        with self.options({"system.region-api-url-template": "http://foobar.{region}.testserver"}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"

            data = json.loads(resp.content)

            expected_region_url = (
                "http://foobar.us.testserver"
                if SiloMode.get_current_mode() == SiloMode.REGION
                else options.get("system.url-prefix")
            )
            assert data["isAuthenticated"] is True
            assert data["lastOrganization"] == self.organization.slug
            assert data["links"] == {
                "organizationUrl": f"http://{self.organization.slug}.testserver",
                "regionUrl": expected_region_url,
                "sentryUrl": "http://testserver",
            }

    def test_customer_domain(self):
        # With customer domain
        resp = self.client.get(self.path, HTTP_HOST="albertos-apples.testserver")
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert not data["isAuthenticated"]
        assert data["customerDomain"] == {
            "organizationUrl": "http://albertos-apples.testserver",
            "sentryUrl": "http://testserver",
            "subdomain": "albertos-apples",
        }

        # Without customer domain
        resp = self.client.get(self.path, HTTP_HOST="testserver")
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert not data["isAuthenticated"]
        assert data["customerDomain"] is None

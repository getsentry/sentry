from unittest import mock

from django.conf import settings
from django.urls import reverse
from exam import fixture

from sentry.auth import superuser
from sentry.models import (
    ApiToken,
    Organization,
    OrganizationMember,
    OrganizationStatus,
    ScheduledDeletion,
)
from sentry.tasks.deletion import run_deletion
from sentry.testutils import TestCase
from sentry.utils import json


class CrossDomainXmlTest(TestCase):
    @fixture
    def path(self):
        return reverse("sentry-api-crossdomain-xml", kwargs={"project_id": self.project.id})

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
    @fixture
    def path(self):
        return reverse("sentry-api-robots-txt")

    def test_robots(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "text/plain"


class ClientConfigViewTest(TestCase):
    @fixture
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
            assert data["features"] == ["organizations:create", "auth:register"]

        with self.options({"auth.allow-registration": False}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"
            data = json.loads(resp.content)
            assert data["features"] == ["organizations:create"]

    def test_org_create_feature(self):
        with self.feature({"organizations:create": True}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"
            data = json.loads(resp.content)
            assert data["features"] == ["organizations:create"]

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

        with self.feature({"organizations:customer-domains": True}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"
            data = json.loads(resp.content)
            assert data["lastOrganization"] == self.organization.slug
            assert data["features"] == ["organizations:create", "organizations:customer-domains"]

        with self.feature({"organizations:customer-domains": False}):
            resp = self.client.get(self.path)
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

    def test_superuser(self):
        user = self.create_user("foo@example.com", is_superuser=True)
        self.login_as(user, superuser=True)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert data["isAuthenticated"]
        assert data["user"]
        assert data["user"]["email"] == user.email
        assert data["user"]["isSuperuser"] is True
        assert data["lastOrganization"] is None
        assert "activeorg" not in self.client.session

        # Induce last active organization
        resp = self.client.get(
            reverse("sentry-api-0-organization-projects", args=[self.organization.slug])
        )
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"
        assert "activeorg" not in self.client.session

        # lastOrganization is not set
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert data["lastOrganization"] is None
        assert "activeorg" not in self.client.session

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
            "regionUrl": "http://us.testserver",
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

        with self.options({"system.region": "eu"}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"

            data = json.loads(resp.content)

            assert data["isAuthenticated"] is True
            assert data["lastOrganization"] == self.organization.slug
            assert data["links"] == {
                "organizationUrl": f"http://{self.organization.slug}.testserver",
                "regionUrl": "http://eu.testserver",
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
                "regionUrl": "http://us.testserver",
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
                "regionUrl": "http://us.testserver",
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
                "regionUrl": "http://us.testserver",
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
                "regionUrl": "http://us.testserver",
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
                "regionUrl": "http://us.testserver",
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
        assert ScheduledDeletion.objects.count() == 0

        self.organization.update(status=OrganizationStatus.PENDING_DELETION)
        deletion = ScheduledDeletion.schedule(self.organization, days=0)
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
        api_token = ApiToken.objects.create(user=self.user, scope_list=["org:write", "org:read"])
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

            assert data["isAuthenticated"] is True
            assert data["lastOrganization"] == self.organization.slug
            assert data["links"] == {
                "organizationUrl": f"http://{self.organization.slug}.testserver",
                "regionUrl": "http://foobar.us.testserver",
                "sentryUrl": "http://testserver",
            }

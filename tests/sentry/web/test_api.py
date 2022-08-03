from unittest import mock

from django.urls import reverse
from exam import fixture

from sentry.models import Organization, OrganizationStatus, ScheduledDeletion
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

    def test_unauthenticated(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert not data["isAuthenticated"]
        assert data["user"] is None

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

    def test_organization_url_unauthenticated(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert not data["isAuthenticated"]
        assert data["user"] is None
        assert data["lastOrganization"] is None
        assert data["sentryUrl"] == "http://testserver"
        assert data["organizationUrl"] is None

    def test_organization_url_authenticated(self):
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
        assert data["sentryUrl"] == "http://testserver"
        assert data["organizationUrl"] == f"http://{self.organization.slug}.us.testserver"

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
            assert data["sentryUrl"] == "http://testserver"
            assert data["organizationUrl"] == f"http://{self.organization.slug}.eu.testserver"

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
            assert data["sentryUrl"] == "http://testserver"
            assert data["organizationUrl"] == "http://testserver"

        with self.options({"system.organization-base-hostname": "{region}.{slug}.testserver"}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"

            data = json.loads(resp.content)

            assert data["isAuthenticated"] is True
            assert data["lastOrganization"] == self.organization.slug
            assert data["sentryUrl"] == "http://testserver"
            assert data["organizationUrl"] == f"http://us.{self.organization.slug}.testserver"

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
            assert data["sentryUrl"] == "http://testserver"
            assert data["organizationUrl"] == "invalid"

        with self.options({"system.organization-url-template": None}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"

            data = json.loads(resp.content)

            assert data["isAuthenticated"] is True
            assert data["lastOrganization"] == self.organization.slug
            assert data["sentryUrl"] == "http://testserver"
            assert data["organizationUrl"] == "http://testserver"

        with self.options({"system.organization-url-template": "ftp://{hostname}"}):
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            assert resp["Content-Type"] == "application/json"

            data = json.loads(resp.content)

            assert data["isAuthenticated"] is True
            assert data["lastOrganization"] == self.organization.slug
            assert data["sentryUrl"] == "http://testserver"
            assert data["organizationUrl"] == f"ftp://{self.organization.slug}.us.testserver"

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

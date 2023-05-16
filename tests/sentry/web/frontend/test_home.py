from functools import cached_property

from django.urls import reverse

from sentry.models import OrganizationStatus
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class HomeTest(TestCase):
    @cached_property
    def path(self):
        return reverse("sentry")

    def test_redirects_to_login(self):
        resp = self.client.get(self.path)

        self.assertRedirects(resp, "/auth/login/")

    def test_redirects_to_create_org(self):
        self.login_as(self.user)

        with self.feature("organizations:create"):
            resp = self.client.get(self.path)

        self.assertRedirects(resp, "/organizations/new/")

    def test_shows_no_access(self):
        self.login_as(self.user)

        with self.feature({"organizations:create": False}):
            resp = self.client.get(self.path)

        assert resp.status_code == 403
        self.assertTemplateUsed("sentry/no-organization-access.html")

    def test_redirects_to_org_home(self):
        self.login_as(self.user)
        org = self.create_organization(owner=self.user)

        with self.feature("organizations:create"):
            resp = self.client.get(self.path)

        self.assertRedirects(resp, f"/organizations/{org.slug}/issues/")

    def test_customer_domain(self):
        org = self.create_organization(owner=self.user)

        self.login_as(self.user)

        with self.feature({"organizations:customer-domains": [org.slug]}):
            response = self.client.get(
                "/",
                SERVER_NAME=f"{org.slug}.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == [
                (f"http://{org.slug}.testserver/issues/", 302),
            ]
            assert self.client.session["activeorg"] == org.slug

    def test_customer_domain_org_pending_deletion(self):
        org = self.create_organization(owner=self.user, status=OrganizationStatus.PENDING_DELETION)

        self.login_as(self.user)

        with self.feature({"organizations:customer-domains": [org.slug]}):
            response = self.client.get(
                "/",
                SERVER_NAME=f"{org.slug}.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == [
                (f"http://{org.slug}.testserver/restore/", 302),
            ]
            assert "activeorg" not in self.client.session

    def test_customer_domain_org_deletion_in_progress(self):
        org = self.create_organization(
            owner=self.user, status=OrganizationStatus.DELETION_IN_PROGRESS
        )

        self.login_as(self.user)

        with self.feature({"organizations:customer-domains": [org.slug]}):
            response = self.client.get(
                "/",
                SERVER_NAME=f"{org.slug}.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == [
                ("http://testserver/organizations/new/", 302),
            ]
            assert "activeorg" not in self.client.session

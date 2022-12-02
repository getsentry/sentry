from django.urls import reverse

from sentry.testutils import TestCase
from sentry.web.frontend.react_page import NON_CUSTOMER_DOMAIN_URL_NAMES


class ReactPageViewTest(TestCase):
    def test_redirects_unauthenticated_request(self):
        owner = self.create_user("bar@example.com")
        org = self.create_organization(owner=owner)

        path = reverse("sentry-organization-home", args=[org.slug])
        resp = self.client.get(path)

        self.assertRedirects(resp, reverse("sentry-auth-organization", args=[org.slug]))
        assert resp["X-Robots-Tag"] == "noindex, nofollow"

    def test_superuser_can_load(self):
        org = self.create_organization(owner=self.user)
        path = reverse("sentry-organization-home", args=[org.slug])

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/base-react.html")
        assert resp.context["request"]

    def test_redirects_user_to_auth_without_membership(self):
        owner = self.create_user("bar@example.com")
        org = self.create_organization(owner=owner)
        non_member = self.create_user("foo@example.com")

        path = reverse("sentry-organization-home", args=[org.slug])

        self.login_as(non_member)

        resp = self.client.get(path)

        self.assertRedirects(resp, reverse("sentry-auth-organization", args=[org.slug]))

        # ensure we don't redirect to auth if its not a valid org
        path = reverse("sentry-organization-home", args=["foobar"])

        resp = self.client.get(path)

        assert resp.status_code == 302
        assert resp["Location"] != reverse("sentry-auth-organization", args=[org.slug])

        # ensure we don't redirect with valid membership
        path = reverse("sentry-organization-home", args=[org.slug])

        self.login_as(owner)

        resp = self.client.get(path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/base-react.html")
        assert resp.context["request"]

    def test_inactive_superuser_bypasses_server_auth(self):
        owner = self.create_user("bar@example.com")
        org = self.create_organization(owner=owner)
        non_member = self.create_user("foo@example.com", is_superuser=True)

        path = reverse("sentry-organization-home", args=[org.slug])

        self.login_as(non_member)

        resp = self.client.get(path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/base-react.html")
        assert resp.context["request"]

    def test_org_subpages_capture_slug(self):
        owner = self.create_user("bar@example.com")
        org = self.create_organization(owner=owner)
        # User is *not* logged in. Check for redirect to org's auth login.

        for path in [
            f"/organizations/{org.slug}/settings/",
            f"/organizations/{org.slug}/discover/",
            f"/organizations/{org.slug}/releases/1.0/?project=1",
            f"/organizations/{org.slug}/new_page_that_does_not_exist_yet/",
            f"/settings/{org.slug}/developer-settings/",
            f"/settings/{org.slug}/new_page_that_does_not_exist_yet/",
        ]:
            resp = self.client.get(path)
            assert resp.status_code == 302
            assert resp.url == f"/auth/login/{org.slug}/"

    def test_redirect_to_customer_domain(self):
        user = self.create_user("bar@example.com")
        org = self.create_organization(owner=user)

        self.login_as(user)

        with self.feature({"organizations:customer-domains": False}):
            assert "activeorg" not in self.client.session

            response = self.client.get(reverse("sentry-organization-issue-list", args=[org.slug]))
            assert response.status_code == 200
            assert self.client.session["activeorg"]

        with self.feature({"organizations:customer-domains": True}):

            # Redirect to customer domain
            response = self.client.get(
                reverse("sentry-organization-issue-list", args=[org.slug]), follow=True
            )
            assert response.status_code == 200
            assert response.redirect_chain == [
                (f"http://{org.slug}.testserver/organizations/{org.slug}/issues/", 302)
            ]

            response = self.client.get(reverse("issues"), follow=True)
            assert response.status_code == 200
            assert response.redirect_chain == [(f"http://{org.slug}.testserver/issues/", 302)]

            response = self.client.get("/", follow=True)
            assert response.status_code == 200
            # TODO(alberto): follow up with patch to make /issues/ the default whenever customer domain feature is
            #                enabled.
            assert response.redirect_chain == [
                (f"/organizations/{org.slug}/issues/", 302),
                (f"http://{org.slug}.testserver/organizations/{org.slug}/issues/", 302),
            ]

            # No redirect if customer domain is already being used
            response = self.client.get(
                reverse("sentry-organization-issue-list", args=[org.slug]),
                HTTP_HOST=f"{org.slug}.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == []

            response = self.client.get(
                reverse("issues"),
                HTTP_HOST=f"{org.slug}.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == []

            response = self.client.get(
                "/",
                HTTP_HOST=f"{org.slug}.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == [(f"http://{org.slug}.testserver/issues/", 302)]

    def test_non_customer_domain_url_names(self):
        user = self.create_user("bar@example.com")
        org = self.create_organization(owner=user)
        self.login_as(user)

        for url_name in NON_CUSTOMER_DOMAIN_URL_NAMES:
            path = reverse(url_name)
            # Does not redirect a non-customer domain URL
            response = self.client.get(path)

            self.assertTemplateUsed(response, "sentry/base-react.html")
            assert response.status_code == 200

            # Redirects for a customer domain URL
            response = self.client.get(path, HTTP_HOST=f"{org.slug}.testserver")

            assert response.status_code == 302
            assert response["Location"] == f"http://testserver{path}"

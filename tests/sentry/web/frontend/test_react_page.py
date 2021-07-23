from django.urls import reverse

from sentry.testutils import TestCase


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
        self.assertTemplateUsed(resp, "sentry/bases/react.html")
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
        self.assertTemplateUsed(resp, "sentry/bases/react.html")
        assert resp.context["request"]

    def test_inactive_superuser_bypasses_server_auth(self):
        owner = self.create_user("bar@example.com")
        org = self.create_organization(owner=owner)
        non_member = self.create_user("foo@example.com", is_superuser=True)

        path = reverse("sentry-organization-home", args=[org.slug])

        self.login_as(non_member)

        resp = self.client.get(path)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/bases/react.html")
        assert resp.context["request"]

    def test_org_subpages_capture_slug(self):
        owner = self.create_user("bar@example.com")
        org = self.create_organization(owner=owner)
        # User is *not* logged in. Check for redirect to org's auth login.

        # TODO(RyanSkonnord): Generalize URL pattern; add
        #  f"/organizations/{org.slug}/new_page_that_does_not_exist_yet/"
        #  to list of test paths without causing other regressions.
        #  See OrganizationReleasesTest.test_detail_global_header,
        #  which exposes a buggy interaction with appendTrailingSlash
        #  in static/app/routes.tsx.
        for path in [
            f"/organizations/{org.slug}/settings/",
            f"/organizations/{org.slug}/discover/",
            f"/settings/{org.slug}/developer-settings/",
            f"/settings/{org.slug}/new_page_that_does_not_exist_yet/",
        ]:
            resp = self.client.get(path)
            assert resp.status_code == 302
            assert resp.url == f"/auth/login/{org.slug}/"

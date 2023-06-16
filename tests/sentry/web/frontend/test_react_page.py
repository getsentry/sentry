from fnmatch import fnmatch

from django.urls import URLResolver, get_resolver, reverse

from sentry.models import OrganizationStatus
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.web.frontend.react_page import NON_CUSTOMER_DOMAIN_URL_NAMES, ReactMixin


@control_silo_test
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
            assert response.redirect_chain == [(f"http://{org.slug}.testserver/issues/", 302)]

            response = self.client.get(reverse("issues"), follow=True)
            assert response.status_code == 200
            assert response.redirect_chain == [(f"http://{org.slug}.testserver/issues/", 302)]

            response = self.client.get("/", follow=True)
            assert response.status_code == 200
            assert response.redirect_chain == [
                (f"/organizations/{org.slug}/issues/", 302),
                (f"http://{org.slug}.testserver/issues/", 302),
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

    def test_does_not_redirect_to_customer_domain_for_unsupported_paths(self):
        user = self.create_user("bar@example.com")
        org = self.create_organization(owner=user)
        self.login_as(user)

        with self.feature({"organizations:customer-domains": True}):

            url_name = "sentry-organization-create"
            url_name_is_non_customer_domain = any(
                fnmatch(url_name, p) for p in NON_CUSTOMER_DOMAIN_URL_NAMES
            )
            assert (
                url_name_is_non_customer_domain
            ), "precondition missing. org-create should be non-customer-domain"

            # Induce last active org.
            assert "activeorg" not in self.client.session
            response = self.client.get(
                reverse(
                    "sentry-organization-issue-list",
                    args=[org.slug],
                ),
                HTTP_HOST=f"{org.slug}.testserver",
            )
            assert response.status_code == 200
            assert self.client.session["activeorg"]

            # No redirect to customer domain if path is not meant to be accessed in customer domain context.
            # There should be no redirect to the last active org.
            response = self.client.get(
                reverse(url_name),
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == []

    def test_non_customer_domain_url_names(self):
        user = self.create_user("bar@example.com")
        org = self.create_organization(owner=user)
        self.login_as(user)

        def extract_url_names(urlpatterns, parents):
            for pattern in urlpatterns:
                path = parents[:] + [pattern]
                if isinstance(pattern, URLResolver):
                    yield from extract_url_names(pattern.url_patterns, path)
                else:
                    url_pattern = path[-1]
                    url_name = url_pattern.name
                    if (
                        url_name
                        and url_pattern.callback
                        and hasattr(url_pattern.callback, "view_class")
                        and issubclass(url_pattern.callback.view_class, ReactMixin)
                    ):
                        yield url_name

        url_names = list(extract_url_names(get_resolver().url_patterns, []))
        for url_name in url_names:
            for url_name_pattern in NON_CUSTOMER_DOMAIN_URL_NAMES:
                if not fnmatch(url_name, url_name_pattern):
                    continue

                path = reverse(url_name)
                # Does not redirect a non-customer domain URL
                response = self.client.get(path)

                self.assertTemplateUsed(response, "sentry/base-react.html")
                assert response.status_code == 200

                # Redirects for a customer domain URL
                response = self.client.get(path, HTTP_HOST=f"{org.slug}.testserver")

                assert response.status_code == 302
                assert response["Location"] == f"http://testserver{path}"

    def test_handles_unknown_url_name(self):
        user = self.create_user("bar@example.com")
        org = self.create_organization(owner=user)
        self.login_as(user)

        response = self.client.get(f"/settings/{org.slug}/projects/albertos-apples/keys/")
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/base-react.html")

    def test_customer_domain_non_member_org_superuser(self):
        org = self.create_organization(owner=self.user)
        other_org = self.create_organization()

        self.login_as(self.user, superuser=True)

        with self.feature({"organizations:customer-domains": [org.slug]}):
            # Induce activeorg
            response = self.client.get(
                "/",
                HTTP_HOST=f"{org.slug}.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == [(f"http://{org.slug}.testserver/issues/", 302)]
            assert self.client.session["activeorg"] == org.slug

            # Access another org as superuser on non-customer domain
            response = self.client.get(
                reverse("sentry-organization-issue-list", args=[other_org.slug]),
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == []

    def test_customer_domain_superuser(self):
        org = self.create_organization(owner=self.user)
        other_org = self.create_organization(slug="albertos-apples")

        self.login_as(self.user)

        with self.feature({"organizations:customer-domains": [org.slug]}):
            # Induce activeorg
            response = self.client.get(
                "/",
                HTTP_HOST=f"{org.slug}.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == [(f"http://{org.slug}.testserver/issues/", 302)]
            assert self.client.session["activeorg"] == org.slug

            # Access another org as superuser on customer domain
            response = self.client.get("/", HTTP_HOST=f"{other_org.slug}.testserver", follow=True)
            assert response.status_code == 200
            assert response.redirect_chain == [
                (f"http://{other_org.slug}.testserver/issues/", 302),
            ]

    def test_customer_domain_loads(self):
        org = self.create_organization(owner=self.user, status=OrganizationStatus.ACTIVE)

        self.login_as(self.user)

        with self.feature({"organizations:customer-domains": [org.slug]}):
            response = self.client.get(
                "/issues/",
                SERVER_NAME=f"{org.slug}.testserver",
            )
            assert response.status_code == 200
            self.assertTemplateUsed(response, "sentry/base-react.html")
            assert response.context["request"]
            assert self.client.session["activeorg"] == org.slug

    def test_customer_domain_org_pending_deletion(self):
        org = self.create_organization(owner=self.user, status=OrganizationStatus.PENDING_DELETION)

        self.login_as(self.user)

        with self.feature({"organizations:customer-domains": [org.slug]}):
            response = self.client.get(
                "/issues/",
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
                "/issues/",
                SERVER_NAME=f"{org.slug}.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == [
                ("http://testserver/organizations/new/", 302),
            ]
            assert "activeorg" not in self.client.session

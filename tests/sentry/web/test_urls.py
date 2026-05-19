from django.urls import reverse

from sentry.testutils.cases import TestCase


class DocsRedirectTest(TestCase):
    def test_response(self) -> None:
        path = reverse("sentry-docs-redirect")
        resp = self.client.get(path)
        assert resp["Location"] == "https://docs.sentry.io/"
        assert resp.status_code == 302, resp.status_code


class ApiDocsRedirectTest(TestCase):
    def test_response(self) -> None:
        path = reverse("sentry-api-docs-redirect")
        resp = self.client.get(path)
        assert resp["Location"] == "https://docs.sentry.io/api/"
        assert resp.status_code == 302, resp.status_code


class ExploreProfilingRedirectTest(TestCase):
    def test_redirects_to_profiles(self) -> None:
        org = self.create_organization()
        resp = self.client.get(f"/organizations/{org.slug}/explore/profiling/")
        assert resp["Location"] == f"/organizations/{org.slug}/explore/profiles/"
        assert resp.status_code == 302, resp.status_code

    def test_preserves_subpath(self) -> None:
        org = self.create_organization()
        resp = self.client.get(
            f"/organizations/{org.slug}/explore/profiling/profile/my-project/abc123/flamegraph/"
        )
        assert (
            resp["Location"]
            == f"/organizations/{org.slug}/explore/profiles/profile/my-project/abc123/flamegraph/"
        )
        assert resp.status_code == 302, resp.status_code

    def test_preserves_query_string(self) -> None:
        org = self.create_organization()
        resp = self.client.get(f"/organizations/{org.slug}/explore/profiling/?referrer=performance")
        assert (
            resp["Location"] == f"/organizations/{org.slug}/explore/profiles/?referrer=performance"
        )
        assert resp.status_code == 302, resp.status_code

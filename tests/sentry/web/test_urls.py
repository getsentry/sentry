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


class StorybookRoutesTest(TestCase):
    def test_scraps_response(self) -> None:
        path = reverse("scraps")
        resp = self.client.get(path)
        assert resp.status_code == 200, resp.status_code

    def test_legacy_stories_response(self) -> None:
        path = reverse("stories")
        resp = self.client.get(path)
        assert resp.status_code == 200, resp.status_code

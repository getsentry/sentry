from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


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


@control_silo_test
class StorybookRoutesTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        user = self.create_user("user@example.com")
        self.create_organization(owner=user)
        self.login_as(user)

    def test_scraps_response(self) -> None:
        path = reverse("scraps")
        resp = self.client.get(path)
        assert resp.status_code == 200, resp.status_code

    def test_legacy_stories_response(self) -> None:
        path = reverse("stories")
        resp = self.client.get(path)
        assert resp.status_code == 200, resp.status_code

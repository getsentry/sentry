from typing import int
from sentry.testutils.cases import APITestCase


class BuiltinSymbolSourcesNoSlugTest(APITestCase):
    endpoint = "sentry-api-0-builtin-symbol-sources"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    def test_no_slug(self) -> None:
        resp = self.get_response()
        assert resp.status_code == 200

        body = resp.data
        assert len(body)
        assert "sentry_key" in body[0]
        assert "id" in body[0]
        assert "name" in body[0]
        assert "hidden" in body[0]


class BuiltinSymbolSourcesWithSlugTest(APITestCase):
    endpoint = "sentry-api-0-organization-builtin-symbol-sources"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    def test_with_slug(self) -> None:
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 200

        body = resp.data
        assert len(body)
        assert "sentry_key" in body[0]
        assert "id" in body[0]
        assert "name" in body[0]
        assert "hidden" in body[0]

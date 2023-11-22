from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class GroupingConfigsNoSlugTest(APITestCase):
    endpoint = "sentry-api-0-grouping-configs"

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    def test_no_slug(self):
        resp = self.get_response()
        assert resp.status_code == 200

        body = resp.data
        assert len(body)
        assert "id" in body[0]
        assert "base" in body[0]
        assert "changelog" in body[0]
        assert "delegates" in body[0]


@region_silo_test
class GroupingConfigsWithSlugTest(APITestCase):
    endpoint = "sentry-api-0-organization-grouping-configs"

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    def test_with_slug(self):
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 200

        body = resp.data
        assert len(body)
        assert "id" in body[0]
        assert "base" in body[0]
        assert "changelog" in body[0]
        assert "delegates" in body[0]

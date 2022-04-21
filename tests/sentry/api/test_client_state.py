from django.urls import reverse

from sentry.testutils import APITestCase
from sentry.utils import json


class ClientStateTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.path = reverse(
            "sentry-api-0-organization-client-state", args=[self.organization.slug, "onboarding"]
        )

    def test_add_state(self):
        # Invalid feature prompt name
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data == {}

        resp = self.client.put(
            self.path,
            {"test": "data"},
        )
        assert resp.status_code == 201

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"
        assert json.loads(resp.content) == {"test": "data"}

        path = reverse(
            "sentry-api-0-organization-client-state-list",
            args=[self.organization.slug],
        )
        resp = self.client.get(path)
        assert resp.status_code == 200
        assert resp.data == {"onboarding": {"test": "data"}}

    def test_null_state(self):
        path = reverse(
            "sentry-api-0-organization-client-state-list",
            args=[self.organization.slug],
        )
        resp = self.client.get(path)
        assert resp.status_code == 200
        assert resp.data == {}

        path = reverse(
            "sentry-api-0-organization-client-state", args=[self.organization.slug, "onboarding"]
        )
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"
        assert json.loads(resp.content) == {}

    def test_get_category_not_exist(self):
        path = reverse(
            "sentry-api-0-organization-client-state",
            args=[self.organization.slug, "onboarding-aaa"],
        )
        resp = self.client.get(path)
        assert resp.status_code == 404

    def test_put_category_not_exist(self):
        path = reverse(
            "sentry-api-0-organization-client-state",
            args=[self.organization.slug, "onboarding-aaa"],
        )

        resp = self.client.put(
            path,
            {"test": "Dummy Data"},
        )
        assert resp.status_code == 404

    def test_org_not_exist(self):
        path = reverse("sentry-api-0-organization-client-state", args=["ggg", "onboarding"])
        resp = self.client.get(path)
        assert resp.status_code == 404

    def test_large_payload(self):
        resp = self.client.put(
            self.path,
            {"test": 300 * "Dummy Data"},
        )
        assert resp.status_code == 413

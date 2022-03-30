from django.urls import reverse

from sentry.testutils import APITestCase


class ClientStateTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.path = reverse(
            "sentry-api-0-organization-client-state", args=[self.org.slug, "onboarding"]
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
        assert resp.data == {"test": "data"}

    def test_category_not_exist(self):
        path = reverse(
            "sentry-api-0-organization-client-state", args=[self.org.slug, "onboarding-aaa"]
        )
        resp = self.client.get(path)
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

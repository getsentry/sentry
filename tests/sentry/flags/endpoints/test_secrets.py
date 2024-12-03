from django.urls import reverse

from sentry.flags.models import FlagWebHookSigningSecretModel
from sentry.testutils.cases import APITestCase


class OrganizationFlagsWebHookSigningSecretEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-flag-hooks-signing-secret"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.id))

    @property
    def features(self):
        return {"organizations:feature-flag-audit-log": True}

    def test_post(self):
        with self.feature(self.features):
            response = self.client.post(
                self.url, data={"secret": "123", "provider": "launchdarkly"}
            )
            assert response.status_code == 201, response.content

        models = FlagWebHookSigningSecretModel.objects.all()
        assert len(models) == 1
        assert models[0].secret == "123"

    def test_post_disabled(self):
        response = self.client.post(self.url, data={"secret": "123"})
        assert response.status_code == 404, response.content

    def test_post_invalid_provider(self):
        with self.feature(self.features):
            url = reverse(self.endpoint, args=(self.organization.id))
            response = self.client.post(url, data={"secret": "123", "provider": "other"})
            assert response.status_code == 400, response.content
            assert response.json()["provider"] == ["This field is required."]

    def test_post_empty_request(self):
        with self.feature(self.features):
            response = self.client.post(self.url, data={})
            assert response.status_code == 400, response.content
            assert response.json()["provider"] == ["This field is required."]
            assert response.json()["secret"] == ["This field is required."]

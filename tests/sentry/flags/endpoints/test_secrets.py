from django.urls import reverse

from sentry.flags.models import FlagWebHookSigningSecretModel
from sentry.testutils.cases import APITestCase


class OrganizationFlagsWebHookSigningSecretsEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-flag-hooks-signing-secrets"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.obj = FlagWebHookSigningSecretModel.objects.create(
            created_by=self.user.id,
            organization=self.organization,
            provider="launchdarkly",
            secret="123456123456",
        )
        self.url = reverse(self.endpoint, args=(self.organization.id,))

    @property
    def features(self):
        return {"organizations:feature-flag-audit-log": True}

    def test_browse(self):
        org = self.create_organization()
        FlagWebHookSigningSecretModel.objects.create(
            created_by=self.user.id,
            organization=org,
            provider="launchdarkly",
            secret="123456123456",
        )

        with self.feature(self.features):
            response = self.client.get(self.url)
            assert response.status_code == 200

            response_json = response.json()
            assert len(response_json["data"]) == 1
            assert response_json == {
                "data": [
                    {
                        "createdAt": self.obj.date_added.isoformat(),
                        "createdBy": self.obj.created_by,
                        "id": self.obj.id,
                        "provider": self.obj.provider,
                        "secret": "123456******",
                    }
                ]
            }

    def test_browse_disabled(self):
        response = self.client.get(self.url)
        assert response.status_code == 404

    def test_post_launchdarkly(self):
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={"secret": "41271af8b9804cd99a4c787a28274991", "provider": "launchdarkly"},
            )
            assert response.status_code == 201, response.content

        models = FlagWebHookSigningSecretModel.objects.filter(provider="launchdarkly").all()
        assert len(models) == 1
        assert models[0].secret == "41271af8b9804cd99a4c787a28274991"

    def test_post_generic(self):
        with self.feature(self.features):
            response = self.client.post(
                self.url,
                data={"secret": "41271af8b9804cd99a4c787a28274991", "provider": "generic"},
            )
            assert response.status_code == 201, response.content

        models = FlagWebHookSigningSecretModel.objects.filter(provider="generic").all()
        assert len(models) == 1
        assert models[0].secret == "41271af8b9804cd99a4c787a28274991"

    def test_post_disabled(self):
        response = self.client.post(self.url, data={})
        assert response.status_code == 404, response.content

    def test_post_invalid(self):
        with self.feature(self.features):
            url = reverse(self.endpoint, args=(self.organization.id,))
            response = self.client.post(url, data={"secret": "123", "provider": "other"})
            assert response.status_code == 400, response.content
            assert response.json()["provider"] == ['"other" is not a valid choice.']
            assert response.json()["secret"] == ["Ensure this field has at least 32 characters."]

    def test_post_empty_request(self):
        with self.feature(self.features):
            response = self.client.post(self.url, data={})
            assert response.status_code == 400, response.content
            assert response.json()["provider"] == ["This field is required."]
            assert response.json()["secret"] == ["This field is required."]

    def test_post_other_organization(self):
        org = self.create_organization()
        url = reverse(self.endpoint, args=(org.id,))

        with self.feature(self.features):
            response = self.client.post(url, data={})
            assert response.status_code == 403, response.content


class OrganizationFlagsWebHookSigningSecretEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-flag-hooks-signing-secret"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.obj = FlagWebHookSigningSecretModel.objects.create(
            created_by=self.user.id,
            organization=self.organization,
            provider="launchdarkly",
            secret="123456123456",
        )
        self.url = reverse(self.endpoint, args=(self.organization.id, self.obj.id))

    @property
    def features(self):
        return {"organizations:feature-flag-audit-log": True}

    def test_delete(self):
        with self.feature(self.features):
            response = self.client.delete(self.url)
            assert response.status_code == 204

    def test_delete_disabled(self):
        response = self.client.delete(self.url)
        assert response.status_code == 404

    def test_delete_other_organization(self):
        """Attempt to delete a secret outside your organization."""
        org = self.create_organization()
        obj = FlagWebHookSigningSecretModel.objects.create(
            created_by=self.user.id,
            organization=org,
            provider="launchdarkly",
            secret="123456123456",
        )
        url = reverse(self.endpoint, args=(self.organization.id, obj.id))

        with self.feature(self.features):
            response = self.client.delete(url)
            assert response.status_code == 404

from django.urls import reverse
from rest_framework import status

from sentry.api.serializers.base import serialize
from sentry.models.integrationfeature import IntegrationFeature, IntegrationTypes
from sentry.testutils import APITestCase


class DocIntegrationsTest(APITestCase):
    url = reverse("sentry-api-0-doc-integrations")

    def setUp(self):
        self.user = self.create_user(email="jinx@lol.com")
        self.superuser = self.create_user(email="vi@lol.com", is_superuser=True)
        self.doc_1 = self.create_doc_integration(name="test_1", is_draft=False)
        self.doc_2 = self.create_doc_integration(name="test_2", is_draft=True)
        self.doc_3 = self.create_doc_integration(
            name="test_3",
            is_draft=False,
            metadata={"resources": [{"title": "Documentation", "url": "https://docs.sentry.io/"}]},
            features=[2, 3, 4],
        )


class GetDocIntegrationsTest(DocIntegrationsTest):
    def test_read_docs_for_superuser(self):
        # Check that all DocIntegrations were returned
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.get(self.url, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3
        for doc in [self.doc_1, self.doc_2, self.doc_3]:
            assert serialize(doc) in response.data
        # Check that IntegrationFeatures were also serialized
        features = IntegrationFeature.objects.filter(
            target_id=self.doc_3.id, target_type=IntegrationTypes.DOC_INTEGRATION.value
        )
        for feature in features:
            assert serialize(feature) in serialize(self.doc_3)["features"]

    def test_read_docs_public(self):
        # Check that only non-draft DocIntegrations were returned
        self.login_as(user=self.user)
        response = self.client.get(self.url, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2
        for doc in [self.doc_1, self.doc_3]:
            assert serialize(doc) in response.data
        # Check that IntegrationFeatures were also serialized
        features = IntegrationFeature.objects.filter(
            target_id=self.doc_3.id, target_type=IntegrationTypes.DOC_INTEGRATION.value
        )
        for feature in features:
            assert serialize(feature) in serialize(self.doc_3)["features"]


class PostDocIntegrationsTest(DocIntegrationsTest):
    payload = {
        "name": "Enemy",
        "author": "Imagine Dragons",
        "description": "An opening theme song 👀",
        "url": "https://github.com/getsentry/sentry/",
        "popularity": 5,
        "resources": [{"title": "Docs", "url": "https://github.com/getsentry/sentry/"}],
        "features": [1, 2, 3],
    }

    def test_create_doc_for_superuser(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.post(self.url, self.payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        # DocIntegration.objects.get()

    def test_create_invalid_auth(self):
        pass

    def test_create_repeated_slug(self):
        pass

    def test_create_invalid_metadata(self):
        pass

    def test_create_ignore_draft(self):
        pass

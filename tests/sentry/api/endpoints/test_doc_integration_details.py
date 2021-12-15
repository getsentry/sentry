import pytest
from rest_framework import status

from sentry.api.serializers.base import serialize
from sentry.models.integration import DocIntegration
from sentry.models.integrationfeature import IntegrationFeature, IntegrationTypes
from sentry.testutils import APITestCase


class DocIntegrationDetailsTest(APITestCase):
    endpoint = "sentry-api-0-doc-integration-details"

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
        self.doc_delete = self.create_doc_integration(
            name="test_4", is_draft=True, features=[1, 2, 3, 4, 5, 6, 7]
        )


class GetDocIntegrationDetailsTest(DocIntegrationDetailsTest):
    method = "GET"

    def test_read_doc_for_superuser(self):
        """
        Tests that any DocIntegration is visible (with all the expected data)
        for those with superuser permissions
        """
        self.login_as(user=self.superuser, superuser=True)
        # Non-draft DocIntegration, with features
        response = self.get_success_response(self.doc_3.slug, status_code=status.HTTP_200_OK)
        assert serialize(self.doc_3) == response.data
        features = IntegrationFeature.objects.filter(
            target_id=self.doc_3.id, target_type=IntegrationTypes.DOC_INTEGRATION.value
        )
        for feature in features:
            assert serialize(feature) in serialize(self.doc_3)["features"]
        # Draft DocIntegration, without features
        response = self.get_success_response(self.doc_2.slug, status_code=status.HTTP_200_OK)
        assert serialize(self.doc_2) == response.data

    def test_read_doc_for_public(self):
        """
        Tests that only non-draft DocIntegrations (with all the expected data)
        are visible for those without superuser permissions
        """
        self.login_as(user=self.user)
        # Non-draft DocIntegration, with features
        response = self.get_success_response(self.doc_3.slug, status_code=status.HTTP_200_OK)
        assert serialize(self.doc_3) == response.data
        features = IntegrationFeature.objects.filter(
            target_id=self.doc_3.id, target_type=IntegrationTypes.DOC_INTEGRATION.value
        )
        for feature in features:
            assert serialize(feature) in serialize(self.doc_3)["features"]
        # Draft DocIntegration, without features
        self.get_error_response(self.doc_2.slug, status_code=status.HTTP_403_FORBIDDEN)


class PutDocIntegrationDetailsTest(DocIntegrationDetailsTest):
    method = "PUT"
    payload = {
        "name": "Enemy",
        "author": "Imagine Dragons",
        "description": "An opening theme song 👀",
        "url": "https://github.com/getsentry/sentry/",
        "popularity": 5,
        "resources": [{"title": "Docs", "url": "https://github.com/getsentry/sentry/"}],
        "features": [1, 2, 3],
    }

    def test_update_doc_for_superuser(self):
        pass

    def test_update_invalid_auth(self):
        pass

    def test_update_removes_unused_features(self):
        pass

    def test_update_retains_carryover_features(self):
        pass

    def test_update_does_not_change_slug(self):
        pass

    def test_update_invalid_metadata(self):
        pass

    def test_update_empty_metadata(self):
        pass

    def test_update_ignore_keys(self):
        pass

    @pytest.mark.skip
    def test_create_doc_for_superuser(self):
        """
        Tests that a draft DocIntegration is created for superuser requests along
        with all the appropriate IntegrationFeatures
        """
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.post(self.url, self.payload, format="json")
        doc = DocIntegration.objects.get(name=self.payload["name"], author=self.payload["author"])
        assert response.status_code == status.HTTP_201_CREATED
        assert serialize(doc) == response.data
        assert doc.is_draft
        features = IntegrationFeature.objects.filter(
            target_id=doc.id, target_type=IntegrationTypes.DOC_INTEGRATION.value
        )
        assert features.exists()
        assert len(features) == 3
        for feature in features:
            assert serialize(feature) in response.data["features"]

    @pytest.mark.skip
    def test_create_invalid_auth(self):
        """
        Tests that the POST endpoint is only accessible for superusers
        """
        self.login_as(user=self.user)
        response = self.client.post(self.url, self.payload, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.skip
    def test_create_repeated_slug(self):
        """
        Tests that repeated names throw errors when generating slugs
        """
        self.login_as(user=self.superuser, superuser=True)
        payload = {**self.payload, "name": self.doc_1.name}
        response = self.client.post(self.url, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "name" in response.data.keys()

    @pytest.mark.skip
    def test_create_invalid_metadata(self):
        """
        Tests that incorrectly structured metadata throws an error
        """
        self.login_as(user=self.superuser, superuser=True)
        invalid_resources = {
            "not_an_array": {},
            "extra_keys": [{**self.payload["resources"][0], "extra": "key"}],
            "missing_keys": [{"title": "Missing URL field"}],
        }
        for resources in invalid_resources.values():
            response = self.client.post(
                self.url, {**self.payload, "resources": resources}, format="json"
            )
            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert "metadata" in response.data.keys()

    @pytest.mark.skip
    def test_create_empty_metadata(self):
        """
        Tests that sending no metadata keys does not trigger errors
        and resolves to an appropriate default
        """
        self.login_as(user=self.superuser, superuser=True)
        payload = {**self.payload}
        del payload["resources"]
        response = self.client.post(self.url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert "resources" in response.data.keys()
        assert len(response.data["resources"]) == 0

    @pytest.mark.skip
    def test_create_ignore_keys(self):
        """
        Test that certain reserved keys cannot be overridden by the
        request payload. They must be created by the API.
        """
        self.login_as(user=self.superuser, superuser=True)
        payload = {**self.payload, "is_draft": False, "metadata": {"should": "not override"}}
        response = self.client.post(self.url, payload, format="json")
        doc = DocIntegration.objects.get(name=self.payload["name"], author=self.payload["author"])
        assert response.status_code == status.HTTP_201_CREATED
        for key in self.ignored_keys:
            assert key not in response.data.keys()
            assert getattr(doc, key) is not payload[key]


class DeleteDocIntegrationDetailsTest(DocIntegrationDetailsTest):
    method = "DELETE"

    def test_delete_invalid_for_public(self):
        """
        Tests that the delete method is not accessible by those with regular member
        permissions, and no changes occur in the database.
        """
        self.login_as(user=self.user)
        self.get_error_response(self.doc_delete.slug, status_code=status.HTTP_403_FORBIDDEN)
        assert DocIntegration.objects.get(id=self.doc_delete.id)
        features = IntegrationFeature.objects.filter(
            target_id=self.doc_delete.id, target_type=IntegrationTypes.DOC_INTEGRATION.value
        )
        assert features.exists()
        assert len(features) == 7

    def test_delete_valid_for_superuser(self):
        """
        Tests that the delete method works for those with superuser
        permissions, deleting the DocIntegration and associated IntegrationFeatures
        """
        self.login_as(user=self.superuser, superuser=True)
        self.get_success_response(self.doc_delete.slug, status_code=status.HTTP_204_NO_CONTENT)
        with self.assertRaises(DocIntegration.DoesNotExist):
            DocIntegration.objects.get(id=self.doc_delete.id)
        features = IntegrationFeature.objects.filter(
            target_id=self.doc_delete.id, target_type=IntegrationTypes.DOC_INTEGRATION.value
        )
        assert not features.exists()

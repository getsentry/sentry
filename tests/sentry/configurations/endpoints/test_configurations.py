import uuid

from django.urls import reverse

from sentry.configurations.models import ConfigurationFeatureModel, ConfigurationModel
from sentry.testutils.cases import APITestCase


class ConfigurationsAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-configurations"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test_get_configurations(self):
        model = ConfigurationModel.objects.create(
            id=42, slug="test", organization_id=self.organization.id
        )

        response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.json() == {"data": [{"id": 42, "slug": model.slug}]}

    def test_post_configuration(self):
        response = self.client.post(self.url, data={"data": {"slug": "abc"}}, format="json")
        assert response.status_code == 201, response.content
        assert response.json() == {"data": {"id": 1, "slug": "abc"}}

    def test_post_configuration_invalid_slug(self):
        response = self.client.post(self.url, data={"data": {"slug": "a" * 33}}, format="json")
        assert response.status_code == 400, response.content
        # TODO: Why does this live inside the data key? Shouldn't it be an error key?
        assert response.json() == {
            "data": {"slug": ["Ensure this field has no more than 32 characters."]}
        }

    def test_post_configuration_duplicate(self):
        """Test creating a configuration with a duplicate slug."""
        response = self.client.post(self.url, data={"data": {"slug": "abc"}}, format="json")
        assert response.status_code == 201, response.content

        # Same organization and slug -- not cool.
        response = self.client.post(self.url, data={"data": {"slug": "abc"}}, format="json")
        assert response.status_code == 400, response.content
        # TODO: This error message should be structured and ideally associated with a field.
        assert response.content == b"Slug is already in use"

        # TODO: Figure out how to create a new org and associated metadata.
        # Different organization and slug -- very cool.
        # organization = None
        # url = reverse(self.endpoint, args=(organization.slug,))

        # response = self.client.post(url, data={"data": {"slug": "abc"}}, format="json")
        # assert response.status_code == 400, response.content


class ConfigurationAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-configuration"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

        self.model = ConfigurationModel.objects.create(
            id=42, slug="test", organization_id=self.organization.id
        )
        self.url = reverse(self.endpoint, args=(self.organization.slug, self.model.id))

    def test_get_configuration(self):
        response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.json() == {"data": {"id": 42, "slug": self.model.slug}}

    def test_delete_configuration(self):
        response = self.client.delete(self.url)
        assert response.status_code == 204
        assert list(ConfigurationModel.objects.all()) == []


class ConfigurationFeaturesAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-configuration-features"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

        self.configuration = ConfigurationModel.objects.create(
            id=42, slug="test", organization_id=self.organization.id
        )
        self.url = reverse(self.endpoint, args=(self.organization.slug, self.configuration.id))

    def test_get_configuration(self):
        uid = uuid.uuid4().hex

        self.model = ConfigurationFeatureModel.objects.create(
            id=uid,
            key="hello",
            value="world",
            configuration_id=self.configuration.id,
            organization_id=self.organization.id,
        )

        response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.json() == {"data": [{"id": uid, "key": "hello", "value": "world"}]}

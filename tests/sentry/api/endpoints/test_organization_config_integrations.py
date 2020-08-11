from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.features import OrganizationFeature
from sentry import features


class OrganizationConfigIntegrationsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")

        url = reverse("sentry-api-0-organization-config-integrations", args=[org.slug])
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data["providers"]) > 0
        provider = [r for r in response.data["providers"] if r["key"] == "example"]
        assert len(provider) == 1
        provider = provider[0]
        assert provider["name"] == "Example"
        assert provider["setupDialog"]["url"]

    def test_provider_key(self):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name="baz")
        path = u"/api/0/organizations/{}/config/integrations/?provider_key=example_server".format(
            org.slug
        )
        response = self.client.get(path, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data["providers"]) == 1
        assert response.data["providers"][0]["name"] == "Example Server"

    def test_feature_flag_integration(self):
        features.add("organizations:integrations-feature_flag_integration", OrganizationFeature)
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name="baz")

        url = reverse("sentry-api-0-organization-config-integrations", args=[org.slug])
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        provider = [r for r in response.data["providers"] if r["key"] == "feature_flag_integration"]
        assert len(provider) == 0

        with self.feature("organizations:integrations-feature_flag_integration"):
            response = self.client.get(url)

            assert response.status_code == 200, response.content
            provider = [
                r for r in response.data["providers"] if r["key"] == "feature_flag_integration"
            ]
            assert len(provider) == 1

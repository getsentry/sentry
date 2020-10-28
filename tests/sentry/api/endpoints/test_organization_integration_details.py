from __future__ import absolute_import

import six

from sentry.models import Integration, OrganizationIntegration, Repository
from sentry.testutils import APITestCase


class OrganizationIntegrationDetailsTest(APITestCase):
    def setUp(self):
        super(OrganizationIntegrationDetailsTest, self).setUp()

        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.integration = Integration.objects.create(provider="example", name="Example")
        self.integration.add_organization(self.org, self.user)

        self.repo = Repository.objects.create(
            provider="example",
            name="getsentry/sentry",
            organization_id=self.org.id,
            integration_id=self.integration.id,
        )

        self.path = u"/api/0/organizations/{}/integrations/{}/".format(
            self.org.slug, self.integration.id
        )

    def test_simple(self):
        response = self.client.get(self.path, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(self.integration.id)

    def test_removal(self):
        with self.tasks():
            response = self.client.delete(self.path, format="json")

            assert response.status_code == 204, response.content
            assert Integration.objects.filter(id=self.integration.id).exists()

            # Ensure Organization integrations are removed
            assert not OrganizationIntegration.objects.filter(
                integration=self.integration, organization=self.org
            ).exists()

            # make sure repo is dissociated from integration
            assert Repository.objects.get(id=self.repo.id).integration_id is None

    def test_update_config(self):
        config = {"setting": "new_value", "setting2": "baz"}

        response = self.client.post(self.path, format="json", data=config)

        assert response.status_code == 200, response.content

        org_integration = OrganizationIntegration.objects.get(
            integration=self.integration, organization=self.org
        )

        assert org_integration.config == config

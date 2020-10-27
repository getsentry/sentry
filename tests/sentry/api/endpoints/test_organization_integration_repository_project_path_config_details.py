from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.api.serializers import serialize
from sentry.models import Integration, Repository, RepositoryProjectPathConfig
from sentry.testutils import APITestCase


class OrganizationIntegrationRepositoryProjectPathConfigTest(APITestCase):
    def setUp(self):
        super(OrganizationIntegrationRepositoryProjectPathConfigTest, self).setUp()

        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.integration = Integration.objects.create(
            provider="github", name="Example", external_id="abcd"
        )
        self.org_integration = self.integration.add_organization(self.org, self.user)
        self.repo = Repository.objects.create(
            name="example", organization_id=self.org.id, integration_id=self.integration.id
        )
        self.config = RepositoryProjectPathConfig.objects.create(
            repository_id=six.text_type(self.repo.id),
            project_id=six.text_type(self.project.id),
            organization_integration_id=six.text_type(self.org_integration.id),
            stack_root="/stack/root",
            source_root="/source/root",
            default_branch="master",
        )

        self.url = reverse(
            "sentry-api-0-organization-integration-repository-project-path-config-details",
            args=[self.org.slug, self.integration.id, self.config.id],
        )

    def make_put(self, data):
        # reconstruct the original object
        config_data = serialize(self.config, self.user)
        config_data["repositoryId"] = six.text_type(self.repo.id)
        # update with the new fields
        config_data.update(data)
        return self.client.put(self.url, config_data)

    def test_basic_delete(self):
        resp = self.client.delete(self.url)
        assert resp.status_code == 204
        assert not RepositoryProjectPathConfig.objects.filter(
            id=six.text_type(self.config.id)
        ).exists()

    def test_basic_edit(self):
        resp = self.make_put({"stackRoot": "newRoot"})
        assert resp.status_code == 200
        assert resp.data["id"] == six.text_type(self.config.id)
        assert resp.data["stackRoot"] == "newRoot"

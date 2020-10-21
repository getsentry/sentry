from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import Integration, Repository, RepositoryProjectPathConfig
from sentry.testutils import APITestCase


class OrganizationIntegrationRepositoryProjectPathConfigTest(APITestCase):
    def setUp(self):
        super(OrganizationIntegrationRepositoryProjectPathConfigTest, self).setUp()

        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project1 = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.project2 = self.create_project(organization=self.org, teams=[self.team], name="Tiger")
        self.integration = Integration.objects.create(provider="github", name="Example")
        self.org_integration = self.integration.add_organization(self.org, self.user)
        self.repo1 = Repository.objects.create(
            name="example", organization_id=self.org.id, integration_id=self.integration.id
        )
        self.url = reverse(
            "sentry-api-0-organization-integration-repository-project-path-config",
            args=[self.org.slug, self.integration.id],
        )

    def test_basic_get(self):
        path_config1 = RepositoryProjectPathConfig.objects.create(
            organization_integration=self.org_integration,
            project=self.project1,
            repository=self.repo1,
            stack_root="stack/root",
            source_root="source/root",
            default_branch="master",
        )
        path_config2 = RepositoryProjectPathConfig.objects.create(
            organization_integration=self.org_integration,
            project=self.project2,
            repository=self.repo1,
            stack_root="another/path",
            source_root="hey/there",
        )
        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content

        assert response.data[0] == {
            "id": six.text_type(path_config1.id),
            "repositoryId": six.text_type(self.repo1.id),
            "projectId": six.text_type(self.project1.id),
            "stackRoot": "stack/root",
            "sourceRoot": "source/root",
            "defaultBranch": "master",
        }

        assert response.data[1] == {
            "id": six.text_type(path_config2.id),
            "repositoryId": six.text_type(self.repo1.id),
            "projectId": six.text_type(self.project2.id),
            "stackRoot": "another/path",
            "sourceRoot": "hey/there",
            "defaultBranch": None,
        }

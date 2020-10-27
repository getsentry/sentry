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
        self.integration = Integration.objects.create(
            provider="github", name="Example", external_id="abcd"
        )
        self.org_integration = self.integration.add_organization(self.org, self.user)
        self.repo1 = Repository.objects.create(
            name="example", organization_id=self.org.id, integration_id=self.integration.id
        )
        self.url = reverse(
            "sentry-api-0-organization-integration-repository-project-path-config",
            args=[self.org.slug, self.integration.id],
        )

    def make_post(self, data=None):
        config_data = {
            "repositoryId": self.repo1.id,
            "projectId": self.project1.id,
            "stackRoot": "/stack/root",
            "sourceRoot": "/source/root",
            "defaultBranch": "master",
        }
        if data:
            config_data.update(data)
        return self.client.post(self.url, data=config_data, format="json")

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
            "projectId": six.text_type(self.project1.id),
            "projectSlug": self.project1.slug,
            "repoId": six.text_type(self.repo1.id),
            "repoName": self.repo1.name,
            "organizationIntegrationId": six.text_type(self.org_integration.id),
            "stackRoot": "stack/root",
            "sourceRoot": "source/root",
            "defaultBranch": "master",
        }

        assert response.data[1] == {
            "id": six.text_type(path_config2.id),
            "projectId": six.text_type(self.project2.id),
            "projectSlug": self.project2.slug,
            "repoId": six.text_type(self.repo1.id),
            "repoName": self.repo1.name,
            "organizationIntegrationId": six.text_type(self.org_integration.id),
            "stackRoot": "another/path",
            "sourceRoot": "hey/there",
            "defaultBranch": None,
        }

    def test_basic_post(self):
        response = self.make_post()
        assert response.status_code == 201, response.content
        assert response.data == {
            "id": six.text_type(response.data["id"]),
            "projectId": six.text_type(self.project1.id),
            "projectSlug": self.project1.slug,
            "repoId": six.text_type(self.repo1.id),
            "repoName": self.repo1.name,
            "organizationIntegrationId": six.text_type(self.org_integration.id),
            "stackRoot": "/stack/root",
            "sourceRoot": "/source/root",
            "defaultBranch": "master",
        }

    def test_empty_roots_post(self):
        response = self.make_post({"stackRoot": "", "sourceRoot": ""})
        assert response.status_code == 201, response.content

    def test_project_does_not_exist(self):
        bad_org = self.create_organization()
        bad_project = self.create_project(organization=bad_org)
        response = self.make_post({"projectId": bad_project.id})
        assert response.status_code == 400
        assert response.data == {"projectId": ["Project does not exist"]}

    def test_repo_does_not_exist(self):
        bad_integration = Integration.objects.create(provider="github", external_id="radsfas")
        bad_integration.add_organization(self.org, self.user)
        bad_repo = Repository.objects.create(
            name="another", organization_id=self.org.id, integration_id=bad_integration.id
        )
        response = self.make_post({"repositoryId": bad_repo.id})

        assert response.status_code == 400
        assert response.data == {"repositoryId": ["Repository does not exist"]}

    def test_validate_path_conflict(self):
        self.make_post()
        response = self.make_post()
        assert response.status_code == 400
        assert response.data == {
            "nonFieldErrors": [u"Code path config already exists with this project and stack root"]
        }

    def test_invalid_characters_stack_root(self):
        response = self.make_post({"stackRoot": "has space"})
        assert response.status_code == 400
        assert response.data == {
            "stackRoot": ["Path may not contain spaces"],
        }

    def test_invalid_characters_source_root(self):
        response = self.make_post({"sourceRoot": "has space"})
        assert response.status_code == 400
        assert response.data == {
            "sourceRoot": ["Path may not contain spaces"],
        }

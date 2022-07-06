from django.urls import reverse

from sentry.api.serializers import serialize
from sentry.models import Integration, Repository, RepositoryProjectPathConfig
from sentry.testutils import APITestCase


class OrganizationCodeMappingDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-code-mapping-details"

    def setUp(self):
        super().setUp()

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
            repository_id=str(self.repo.id),
            project_id=str(self.project.id),
            organization_integration_id=str(self.org_integration.id),
            stack_root="/stack/root",
            source_root="/source/root",
            default_branch="master",
        )

        self.url = reverse(
            self.endpoint,
            args=[self.org.slug, self.config.id],
        )

    def make_put(self, data):
        # reconstruct the original object
        config_data = serialize(self.config, self.user)
        return self.client.put(
            self.url,
            {**config_data, **data, "repositoryId": self.repo.id},
        )

    def test_basic_delete(self):
        resp = self.client.delete(self.url)
        assert resp.status_code == 204
        assert not RepositoryProjectPathConfig.objects.filter(id=str(self.config.id)).exists()

    def test_basic_edit(self):
        resp = self.make_put({"sourceRoot": "newRoot"})
        assert resp.status_code == 200
        assert resp.data["id"] == str(self.config.id)
        assert resp.data["sourceRoot"] == "newRoot"

    def test_delete_with_existing_codeowners(self):
        self.create_codeowners(project=self.project, code_mapping=self.config)
        resp = self.client.delete(self.url)
        assert resp.status_code == 409
        assert (
            resp.data
            == "Cannot delete Code Mapping. Must delete Code Owner that uses this mapping first."
        )
        assert RepositoryProjectPathConfig.objects.filter(id=str(self.config.id)).exists()

    def test_delete_another_orgs_code_mapping(self):
        invalid_user = self.create_user()
        invalid_organization = self.create_organization(owner=invalid_user)
        self.login_as(user=invalid_user)
        url = reverse(
            self.endpoint,
            args=[invalid_organization.slug, self.config.id],
        )
        resp = self.client.delete(url)
        assert resp.status_code == 404

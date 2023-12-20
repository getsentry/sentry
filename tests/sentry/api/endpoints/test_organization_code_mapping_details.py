from django.urls import reverse

from sentry.api.serializers import serialize
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.repository import Repository
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
class OrganizationCodeMappingDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-code-mapping-details"

    def setUp(self):
        super().setUp()

        self.login_as(user=self.user)
        self.user2 = self.create_user("nisanthan@sentry.io", is_superuser=False)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.team2 = self.create_team(
            organization=self.org,
            name="Ecosystem",
        )
        self.create_member(
            organization=self.org,
            user=self.user2,
            has_global_access=False,
            teams=[self.team2],
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = Integration.objects.create(
                provider="github", name="Example", external_id="abcd"
            )
            self.org_integration = self.integration.add_organization(self.org, self.user)
        self.repo = Repository.objects.create(
            name="example", organization_id=self.org.id, integration_id=self.integration.id
        )
        self.config = RepositoryProjectPathConfig.objects.create(
            repository_id=self.repo.id,
            project_id=self.project.id,
            organization_integration_id=self.org_integration.id,
            integration_id=self.org_integration.integration_id,
            organization_id=self.org_integration.organization_id,
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

    def test_basic_edit_from_member_permissions(self):
        self.login_as(user=self.user2)
        resp = self.make_put({"sourceRoot": "newRoot"})
        assert resp.status_code == 200

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

from django.urls import reverse
from rest_framework import status

from sentry.api.serializers import serialize
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationCodeMappingDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-code-mapping-details"

    def setUp(self):
        super().setUp()

        self.login_as(user=self.user)
        self.user2 = self.create_user("nisanthan@sentry.io", is_superuser=False)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.org.flags.allow_joinleave = False
        self.org.save()
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.team2 = self.create_team(
            organization=self.org,
            name="Ecosystem",
        )
        self.create_member(
            organization=self.org,
            user=self.user2,
            has_global_access=False,
            teams=[self.team, self.team2],
        )
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.integration, self.org_integration = self.create_provider_integration_for(
            self.org, self.user, provider="github", name="Example", external_id="abcd"
        )
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

    def test_non_project_member_permissions(self):
        non_member = self.create_user()
        non_member_om = self.create_member(organization=self.org, user=non_member)
        self.login_as(user=non_member)

        response = self.make_put({"sourceRoot": "newRoot"})
        assert response.status_code == status.HTTP_403_FORBIDDEN

        response = self.client.delete(self.url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

        self.create_team_membership(team=self.team, member=non_member_om)

        response = self.make_put({"sourceRoot": "newRoot"})
        assert response.status_code == status.HTTP_200_OK

        # Needed for DELETE on OrganizationIntegrationsLoosePermission
        non_member_om.update(role="admin")

        response = self.client.delete(self.url)
        assert response.status_code == status.HTTP_204_NO_CONTENT

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

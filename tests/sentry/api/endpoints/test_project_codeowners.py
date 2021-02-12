from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.models import Integration, ProjectCodeOwners


class ProjectOwnershipEndpointTestCase(APITestCase):
    def setUp(self):
        self.login_as(user=self.user)

        self.team = self.create_team(
            organization=self.organization, slug="tiger-team", members=[self.user]
        )

        self.project = self.project = self.create_project(
            organization=self.organization, teams=[self.team], slug="bengal"
        )

        self.path = reverse(
            "sentry-api-0-project-codeowners",
            kwargs={"organization_slug": self.organization.slug, "project_slug": self.project.slug},
        )

    def _create_codeowner_with_integration(self):
        self.integration = Integration.objects.create(
            provider="github",
            name="getsentry",
            external_id="1234",
            metadata={"domain_name": "github.com/getsentry"},
        )
        self.oi = self.integration.add_organization(self.organization, self.user)
        self.repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            url="https://github.com/getsentry/sentry",
        )
        self.code_mapping = self.create_code_mapping(
            project=self.project, repo=self.repo, organization_integration=self.oi
        )
        self.code_owner = ProjectCodeOwners.objects.create(
            project=self.project,
            raw="*.js @tiger-team",
            organization_integration=self.oi,
            repository_project_path_config=self.code_mapping,
        )

    def test_no_codeowners(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data == []

    def test_codeowners_without_integrations(self):
        code_mapping = self.create_code_mapping(project=self.project)
        code_owner = ProjectCodeOwners.objects.create(
            project=self.project,
            raw="*.js @tiger-team",
            repository_project_path_config=code_mapping,
        )
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        resp_data = resp.data[0]
        assert resp_data["raw"] == code_owner.raw
        assert resp_data["dateCreated"] == code_owner.date_added
        assert resp_data["dateUpdated"] == code_owner.date_updated
        assert resp_data["provider"] == "unknown"

    def test_codeowners_with_integration(self):
        self._create_codeowner_with_integration()
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        resp_data = resp.data[0]
        assert resp_data["raw"] == self.code_owner.raw
        assert resp_data["dateCreated"] == self.code_owner.date_added
        assert resp_data["dateUpdated"] == self.code_owner.date_updated
        assert resp_data["provider"] == self.integration.provider

from django.urls import reverse

from sentry.models import Integration, Repository
from sentry.testutils import APITestCase
from sentry.utils.compat.mock import patch

GITHUB_CODEOWNER = {
    "filepath": "CODEOWNERS",
    "html_url": "https://example.com/example/CODEOWNERS",
    "raw": "* @MeredithAnya\n",
}


class OrganizationCodeMappingCodeOwnersTest(APITestCase):
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

        self.config = self.create_code_mapping(
            repo=self.repo, project=self.project, organization_integration=self.org_integration
        )

        self.url = reverse(
            "sentry-api-0-organization-code-mapping-codeowners",
            args=[self.org.slug, self.config.id],
        )

    def test_invalid_code_mapping(self):
        self.url = reverse(
            "sentry-api-0-organization-code-mapping-codeowners",
            args=[self.org.slug, "123"],
        )
        resp = self.client.get(self.url)
        assert resp.status_code == 404

    def test_code_mapping_without_integration(self):
        config = self.create_code_mapping(
            repo=self.repo, project=self.project, stack_root="no/integration/"
        )
        self.url = reverse(
            "sentry-api-0-organization-code-mapping-codeowners",
            args=[self.org.slug, config.id],
        )
        resp = self.client.get(self.url)
        assert resp.status_code == 400
        assert resp.data["error"] == "No associated integration."

    @patch("sentry.integrations.github.GitHubIntegration.get_codeowner_file", return_value=None)
    def test_no_codeowner_file_found(self, mock_get_codeowner_file):
        resp = self.client.get(self.url)
        assert resp.status_code == 404

    @patch(
        "sentry.integrations.github.GitHubIntegration.get_codeowner_file",
        return_value=GITHUB_CODEOWNER,
    )
    def test_codeowner_contents(self, mock_get_codeowner_file):
        resp = self.client.get(self.url)
        assert resp.status_code == 200
        assert resp.data == GITHUB_CODEOWNER

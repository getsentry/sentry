from unittest.mock import patch

from django.urls import reverse

from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test

GITHUB_CODEOWNER = {
    "filepath": "CODEOWNERS",
    "html_url": "https://example.com/example/CODEOWNERS",
    "raw": "* @MeredithAnya\n",
}


@region_silo_test
class OrganizationCodeMappingCodeOwnersTest(APITestCase):
    def setUp(self):
        super().setUp()

        self.login_as(user=self.user)

        self.team = self.create_team(organization=self.organization, name="Mariachi Band")
        self.project = self.create_project(
            organization=self.organization, teams=[self.team], name="Bengal"
        )

        self.repo = Repository.objects.create(
            name="example", organization_id=self.organization.id, integration_id=self.integration.id
        )

        self.config = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
        )

        self.url = reverse(
            "sentry-api-0-organization-code-mapping-codeowners",
            args=[self.organization.slug, self.config.id],
        )

    def test_invalid_code_mapping(self):
        self.url = reverse(
            "sentry-api-0-organization-code-mapping-codeowners",
            args=[self.organization.slug, "123"],
        )
        resp = self.client.get(self.url)
        assert resp.status_code == 404

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

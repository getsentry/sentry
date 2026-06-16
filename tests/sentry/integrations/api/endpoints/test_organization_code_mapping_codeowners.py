from unittest.mock import MagicMock, patch

from django.urls import reverse

from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase

GITHUB_CODEOWNER = {
    "filepath": "CODEOWNERS",
    "html_url": "https://example.com/example/CODEOWNERS",
    "raw": "* @MeredithAnya\n",
}


class OrganizationCodeMappingCodeOwnersTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()

        self.login_as(user=self.user)

        # Restrict project membership so that team assignment controls access.
        self.organization.flags.allow_joinleave = False
        self.organization.save()

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

    def test_invalid_code_mapping(self) -> None:
        self.url = reverse(
            "sentry-api-0-organization-code-mapping-codeowners",
            args=[self.organization.slug, "123"],
        )
        resp = self.client.get(self.url)
        assert resp.status_code == 404

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_codeowner_file",
        return_value=None,
    )
    def test_no_codeowner_file_found(self, mock_get_codeowner_file: MagicMock) -> None:
        resp = self.client.get(self.url)
        assert resp.status_code == 404

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_codeowner_file",
        return_value=GITHUB_CODEOWNER,
    )
    def test_codeowner_contents(self, mock_get_codeowner_file: MagicMock) -> None:
        resp = self.client.get(self.url)
        assert resp.status_code == 200
        assert resp.data == GITHUB_CODEOWNER

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_codeowner_file",
        return_value=GITHUB_CODEOWNER,
    )
    def test_user_without_project_access_cannot_read_codeowners(
        self, mock_get_codeowner_file: MagicMock
    ) -> None:
        outsider = self.create_user()
        self.create_member(
            organization=self.organization,
            user=outsider,
            has_global_access=False,
            teams=[],
        )
        self.login_as(user=outsider)
        resp = self.client.get(self.url)
        assert resp.status_code == 403

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_codeowner_file",
        return_value=GITHUB_CODEOWNER,
    )
    def test_user_with_project_access_can_read_codeowners(
        self, mock_get_codeowner_file: MagicMock
    ) -> None:
        insider = self.create_user()
        self.create_member(
            organization=self.organization,
            user=insider,
            has_global_access=False,
            teams=[self.team],
        )
        self.login_as(user=insider)
        resp = self.client.get(self.url)
        assert resp.status_code == 200
        assert resp.data == GITHUB_CODEOWNER

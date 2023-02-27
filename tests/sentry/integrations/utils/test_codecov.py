from unittest.mock import patch

import responses

from sentry import options
from sentry.db.postgres.roles import in_test_psql_role_override
from sentry.integrations.utils.codecov import CodecovIntegrationError, has_codecov_integration
from sentry.models.integrations.integration import Integration
from sentry.testutils.cases import APITestCase


class TestCodecovIntegration(APITestCase):
    def setUp(self):
        self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="extid",
        )
        options.set("codecov.client-secret", "supersecrettoken")

    def test_no_github_integration(self):
        with in_test_psql_role_override("postgres"):
            Integration.objects.all().delete()

        has_integration, error = has_codecov_integration(self.organization)
        assert not has_integration
        assert error == CodecovIntegrationError.MISSING_GH.value

    @responses.activate
    @patch(
        "sentry.integrations.github.GitHubAppsClient.get_repositories",
        return_value=["testgit/abc"],
    )
    def test_no_codecov_integration(self, mock_get_repositories):
        responses.add(
            responses.GET,
            "https://api.codecov.io/api/v2/gh/testgit/repos",
            status=404,
        )

        has_integration, error = has_codecov_integration(self.organization)
        assert not has_integration
        assert error == CodecovIntegrationError.MISSING_CODECOV.value

    @responses.activate
    @patch(
        "sentry.integrations.github.GitHubAppsClient.get_repositories",
        return_value=["testgit/abc"],
    )
    def test_has_codecov_integration(self, mock_get_repositories):
        responses.add(
            responses.GET,
            "https://api.codecov.io/api/v2/gh/testgit/repos",
            status=200,
        )

        has_integration, _ = has_codecov_integration(self.organization)
        assert has_integration

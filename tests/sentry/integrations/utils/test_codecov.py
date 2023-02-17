from unittest.mock import patch

import responses

from sentry import options
from sentry.integrations.utils.codecov import has_codecov_integration
from sentry.testutils.cases import APITestCase


class TestCodecovIntegration(APITestCase):
    def setUp(self):
        self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="extid",
        )
        options.set("codecov.client-secret", "supersecrettoken")

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

        assert not has_codecov_integration(self.organization)

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

        assert has_codecov_integration(self.organization)

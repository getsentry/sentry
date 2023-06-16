from unittest.mock import patch

import pytest
import responses

from sentry import options
from sentry.db.postgres.roles import in_test_psql_role_override
from sentry.integrations.utils.codecov import (
    CodecovIntegrationError,
    get_codecov_data,
    has_codecov_integration,
)
from sentry.models.integrations.integration import Integration
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
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
        return_value=[{"name": "abc", "full_name": "testgit/abc"}],
    )
    def test_no_codecov_integration(self, mock_get_repositories):
        responses.add(
            responses.GET,
            "https://api.codecov.io/api/v2/github/testgit",
            status=404,
        )

        has_integration, error = has_codecov_integration(self.organization)
        assert not has_integration
        assert error == CodecovIntegrationError.MISSING_CODECOV.value

    @responses.activate
    @patch(
        "sentry.integrations.github.GitHubAppsClient.get_repositories",
        return_value=[{"name": "abc", "full_name": "testgit/abc"}],
    )
    def test_has_codecov_integration(self, mock_get_repositories):
        responses.add(
            responses.GET,
            "https://api.codecov.io/api/v2/github/testgit",
            status=200,
        )

        has_integration, _ = has_codecov_integration(self.organization)
        assert has_integration

    @responses.activate
    def test_get_codecov_report(self):
        expected_line_coverage = [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]]
        expected_codecov_url = "https://app.codecov.io/gh/testgit/abc/commit/0f1e2d/path/to/file.py"
        responses.add(
            responses.GET,
            "https://api.codecov.io/api/v2/gh/testgit/repos/abc/file_report/path/to/file.py",
            status=200,
            json={
                "line_coverage": expected_line_coverage,
                "commit_file_url": expected_codecov_url,
                "commit_sha": "0f1e2d",
            },
        )

        coverage, url = get_codecov_data(
            repo="testgit/abc",
            service="github",
            path="path/to/file.py",
        )
        assert coverage == expected_line_coverage
        assert url == expected_codecov_url

    @responses.activate
    def test_get_codecov_report_error(self):
        responses.add(
            responses.GET,
            "https://api.codecov.io/api/v2/gh/testgit/repos/abc/file_report/path/to/file.py",
            status=404,
        )

        with pytest.raises(Exception) as e:
            _, _ = get_codecov_data(
                repo="testgit/abc",
                service="github",
                path="path/to/file.py",
            )

            assert e.status == 404

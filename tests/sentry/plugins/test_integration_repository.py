from functools import cached_property
from unittest.mock import patch

import pytest
import responses
from django.db import IntegrityError

from sentry.integrations.github.repository import GitHubRepositoryProvider
from sentry.models import Repository
from sentry.plugins.providers.integration_repository import RepoExists
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class IntegrationRepositoryTestCase(TestCase):
    @responses.activate
    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, provider="github", external_id="654321"
        )
        self.repo_name = "getsentry/sentry"
        self.config = {
            "identifier": self.repo_name,
            "external_id": "654321",
            "integration_id": self.integration.id,
        }

        responses.add(
            responses.GET,
            "https://api.github.com/repos/" + self.repo_name,
            json={
                "id": 1296269,
                "node_id": "MDEwOlJlcG9zaXRvcnkxMjk2MjY5",
                "name": "example-repo",
                "full_name": self.repo_name,
            },
        )

    @cached_property
    def provider(self):
        return GitHubRepositoryProvider("integrations:github")

    def _create_repo(self):
        return Repository.objects.create(
            name=self.repo_name,
            provider="integrations:github",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            url="https://github.com/" + self.repo_name,
            config={"name": self.repo_name},
        )

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    def test_create_repository(self, get_jwt):
        self.provider.create_repository(self.config, self.organization)

        repos = Repository.objects.all()
        assert len(repos) == 1

        assert repos[0].name == self.repo_name
        assert repos[0].provider == "integrations:github"

    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    def test_create_repository__repo_exists(self, get_jwt):
        self._create_repo()

        with pytest.raises(RepoExists):
            self.provider.create_repository(self.config, self.organization)

    @patch("sentry.models.Repository.objects.create")
    @patch("sentry.plugins.providers.IntegrationRepositoryProvider.on_delete_repository")
    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    def test_create_repository__delete_webhook(self, get_jwt, mock_on_delete, mock_repo):
        self._create_repo()

        mock_repo.side_effect = IntegrityError
        mock_on_delete.side_effect = IntegrationError

        with pytest.raises(RepoExists):
            self.provider.create_repository(self.config, self.organization)

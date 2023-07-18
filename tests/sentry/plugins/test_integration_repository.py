from functools import cached_property
from unittest.mock import patch

import pytest
import responses
from django.db import IntegrityError

from sentry.constants import ObjectStatus
from sentry.integrations.github.repository import GitHubRepositoryProvider
from sentry.models import Repository
from sentry.plugins.providers.integration_repository import RepoExistsError
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
@patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
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

    def _create_repo(self, external_id=None):
        return Repository.objects.create(
            name=self.repo_name,
            provider="integrations:github",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            url="https://github.com/" + self.repo_name,
            config={"name": self.repo_name},
            external_id=external_id if external_id else "123456",
        )

    def test_create_repository(self, get_jwt):
        self.provider.create_repository(self.config, self.organization)

        repos = Repository.objects.all()
        assert len(repos) == 1

        assert repos[0].name == self.repo_name
        assert repos[0].provider == "integrations:github"

    def test_create_repository__repo_exists(self, get_jwt):
        self._create_repo()

        with pytest.raises(RepoExistsError):
            self.provider.create_repository(self.config, self.organization)

    @patch("sentry.models.Repository.objects.create")
    @patch("sentry.plugins.providers.IntegrationRepositoryProvider.on_delete_repository")
    def test_create_repository__delete_webhook(self, mock_on_delete, mock_repo, get_jwt):
        self._create_repo()

        mock_repo.side_effect = IntegrityError
        mock_on_delete.side_effect = IntegrationError

        with pytest.raises(RepoExistsError):
            self.provider.create_repository(self.config, self.organization)

    @patch("sentry.plugins.providers.integration_repository.metrics")
    def test_create_repository__activates_existing_hidden_repo(self, mock_metrics, get_jwt):
        repo = self._create_repo(external_id=self.config["external_id"])
        repo.status = ObjectStatus.HIDDEN
        repo.save()

        self.provider.create_repository(self.config, self.organization)
        repo.refresh_from_db()
        assert repo.status == ObjectStatus.ACTIVE
        mock_metrics.incr.assert_called_with("sentry.integration_repo_provider.repo_relink")

    def test_create_repository__only_activates_hidden_repo(self, get_jwt):
        repo = self._create_repo(external_id=self.config["external_id"])
        repo.status = ObjectStatus.PENDING_DELETION
        repo.save()

        with pytest.raises(RepoExistsError):
            self.provider.create_repository(self.config, self.organization)
        repo.refresh_from_db()
        assert repo.status == ObjectStatus.PENDING_DELETION

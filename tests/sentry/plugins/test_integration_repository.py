from functools import cached_property
from unittest.mock import MagicMock, patch

import pytest
import responses
from django.db import IntegrityError

from sentry.constants import ObjectStatus
from sentry.integrations.github.repository import GitHubRepositoryProvider
from sentry.models.repository import REPOSITORY_NAME_LENGTH, REPOSITORY_URL_LENGTH, Repository
from sentry.plugins.providers.integration_repository import RepoExistsError
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import TestCase


@patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
class IntegrationRepositoryTestCase(TestCase):
    @responses.activate
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, provider="github", external_id="654321"
        )
        self.repo_name = "getsentry/sentry"
        self.config = {
            "identifier": self.repo_name,
            "external_id": "654321",
            "integration_id": self.integration.id,
            "url": "https://github.com/getsentry/sentry",
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
    def provider(self) -> GitHubRepositoryProvider:
        return GitHubRepositoryProvider("integrations:github")

    def _create_repo(
        self,
        external_id: str | None = None,
        name: str | None = None,
        status: int = ObjectStatus.ACTIVE,
        integration_id: int | None = None,
    ) -> Repository:
        if not name:
            name = self.repo_name
        return Repository.objects.create(
            name=name,
            provider="integrations:github",
            organization_id=self.organization.id,
            integration_id=integration_id if integration_id else self.integration.id,
            url="https://github.com/" + name,
            config={"name": name},
            external_id=external_id if external_id else "123456",
            status=status,
        )

    def test_create_repository_truncate_overflows(self, get_jwt: MagicMock) -> None:
        config = self.config.copy()
        config["identifier"] = "a" * 510
        self.provider.create_repository(config, self.organization)

        repos = Repository.objects.all()
        assert len(repos) == 1

        assert repos[0].name == config["identifier"][:REPOSITORY_NAME_LENGTH]
        assert repos[0].url == f"https://github.com/{config['identifier']}"[:REPOSITORY_URL_LENGTH]
        assert repos[0].provider == "integrations:github"

    def test_create_repository(self, get_jwt: MagicMock) -> None:
        self.provider.create_repository(self.config, self.organization)

        repos = Repository.objects.all()
        assert len(repos) == 1

        assert repos[0].name == self.repo_name
        assert repos[0].provider == "integrations:github"

    def test_create_repository__repo_exists(self, get_jwt: MagicMock) -> None:
        existing = self._create_repo(external_id=self.config["external_id"])

        with pytest.raises(RepoExistsError) as exc_info:
            self.provider.create_repository(self.config, self.organization)

        assert exc_info.value.existing_repo is not None
        assert exc_info.value.existing_repo.id == existing.id
        assert Repository.objects.count() == 1

    def test_create_repository__transfer_repo_in_org(self, get_jwt: MagicMock) -> None:
        # can transfer a disabled repo from one integration to another in a single org
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="123456"
        )
        self._create_repo(
            external_id=self.config["external_id"],
            name="getsentry/santry",
            status=ObjectStatus.DISABLED,
            integration_id=integration.id,
        )

        _, repo = self.provider.create_repository(self.config, self.organization)

        assert repo.name == self.config["identifier"]
        assert repo.url == self.config["url"]

    def test_create_repository__repo_exists_update_name(self, get_jwt: MagicMock) -> None:
        repo = self._create_repo(external_id=self.config["external_id"], name="getsentry/santry")

        with pytest.raises(RepoExistsError) as exc_info:
            self.provider.create_repository(self.config, self.organization)

        existing = exc_info.value.existing_repo
        assert existing is not None
        assert existing.id == repo.id
        assert existing.name == self.repo_name
        repo.refresh_from_db()
        assert repo.name == self.repo_name

    @patch("sentry.models.Repository.objects.create")
    @patch("sentry.plugins.providers.IntegrationRepositoryProvider.on_delete_repository")
    def test_create_repository__delete_webhook(
        self, mock_on_delete: MagicMock, mock_repo: MagicMock, get_jwt: MagicMock
    ) -> None:
        self._create_repo()

        mock_repo.side_effect = IntegrityError
        mock_on_delete.side_effect = IntegrationError

        with pytest.raises(RepoExistsError) as exc_info:
            self.provider.create_repository(self.config, self.organization)

        # Pre-existing repo is under the default external_id=123456, not the
        # config's 654321 — the lookup by (integration_id, external_id) misses,
        # so the race fallback has nothing to surface.
        assert exc_info.value.existing_repo is None

    def test_create_repository__integrity_error_attaches_existing(self, get_jwt: MagicMock) -> None:
        existing = self._create_repo(external_id=self.config["external_id"])

        with (
            patch("sentry.models.Repository.objects.create", side_effect=IntegrityError),
            pytest.raises(RepoExistsError) as exc_info,
        ):
            self.provider.create_repository(self.config, self.organization)

        assert exc_info.value.existing_repo is not None
        assert exc_info.value.existing_repo.id == existing.id

    @patch("sentry.plugins.providers.integration_repository.metrics")
    def test_create_repository__activates_existing_hidden_repo(
        self, mock_metrics: MagicMock, get_jwt: MagicMock
    ) -> None:
        repo = self._create_repo(external_id=self.config["external_id"])
        repo.status = ObjectStatus.HIDDEN
        repo.save()

        self.provider.create_repository(self.config, self.organization)
        repo.refresh_from_db()
        assert repo.status == ObjectStatus.ACTIVE
        mock_metrics.incr.assert_called_with("sentry.integration_repo_provider.repo_relink")

    def test_create_repository__ignores_hidden_repo_of_other_provider(
        self, get_jwt: MagicMock
    ) -> None:
        # External ids are only unique per provider.
        other = self.create_repo(
            project=self.project,
            name="group/project",
            provider="integrations:gitlab",
            external_id=self.config["external_id"],
        )
        other.update(status=ObjectStatus.HIDDEN)

        _, repo = self.provider.create_repository(self.config, self.organization)

        assert repo.id != other.id
        assert repo.provider == "integrations:github"
        other.refresh_from_db()
        assert other.status == ObjectStatus.HIDDEN

    def test_create_repository__activates_hidden_repo_without_provider(
        self, get_jwt: MagicMock
    ) -> None:
        orphan = self.create_repo(
            project=self.project, name=self.repo_name, external_id=self.config["external_id"]
        )
        orphan.update(status=ObjectStatus.HIDDEN)

        _, repo = self.provider.create_repository(self.config, self.organization)

        assert repo.id == orphan.id
        orphan.refresh_from_db()
        assert orphan.status == ObjectStatus.ACTIVE
        assert orphan.provider == "integrations:github"
        assert orphan.integration_id == self.integration.id

    def test_create_repositories__ignores_rows_of_other_provider(self, get_jwt: MagicMock) -> None:
        # The bulk path (link_all_repos, install-change sync) matches by external id too.
        hidden = self.create_repo(
            project=self.project,
            name="group/hidden",
            provider="integrations:gitlab",
            external_id=self.config["external_id"],
        )
        hidden.update(status=ObjectStatus.HIDDEN)
        unlinked = self.create_repo(
            project=self.project,
            name="group/unlinked",
            provider="gitlab",
            external_id="999",
        )
        other_config = {**self.config, "external_id": "999", "identifier": "getsentry/other"}

        created, reactivated, missing = self.provider.create_repositories(
            [self.config, other_config], self.organization
        )

        assert {repo.external_id for repo in created} == {self.config["external_id"], "999"}
        assert reactivated == []
        assert missing == []
        hidden.refresh_from_db()
        unlinked.refresh_from_db()
        assert (hidden.status, hidden.provider) == (ObjectStatus.HIDDEN, "integrations:gitlab")
        assert (unlinked.integration_id, unlinked.provider) == (None, "gitlab")

    def test_create_repositories__adopts_own_and_provider_less_rows(
        self, get_jwt: MagicMock
    ) -> None:
        hidden = self.create_repo(
            project=self.project,
            name=self.repo_name,
            provider="integrations:github",
            external_id=self.config["external_id"],
        )
        hidden.update(status=ObjectStatus.HIDDEN)
        orphan = self.create_repo(project=self.project, name="getsentry/other", external_id="999")
        other_config = {**self.config, "external_id": "999", "identifier": "getsentry/other"}

        created, reactivated, missing = self.provider.create_repositories(
            [self.config, other_config], self.organization
        )

        assert created == []
        assert {repo.id for repo in reactivated} == {hidden.id, orphan.id}
        assert missing == []
        for repo in (hidden, orphan):
            repo.refresh_from_db()
            assert repo.status == ObjectStatus.ACTIVE
            assert repo.provider == "integrations:github"
            assert repo.integration_id == self.integration.id

    def test_create_repository__ignores_unlinked_repo_of_other_provider(
        self, get_jwt: MagicMock
    ) -> None:
        other = self.create_repo(
            project=self.project,
            name="group/project",
            provider="gitlab",
            external_id=self.config["external_id"],
        )

        _, repo = self.provider.create_repository(self.config, self.organization)

        assert repo.id != other.id
        other.refresh_from_db()
        assert other.provider == "gitlab"
        assert other.integration_id is None

    def test_create_repository__adopts_plugin_era_repo(self, get_jwt: MagicMock) -> None:
        legacy = self.create_repo(
            project=self.project,
            name=self.repo_name,
            provider="github",
            external_id=self.config["external_id"],
        )

        _, repo = self.provider.create_repository(self.config, self.organization)

        assert repo.id == legacy.id
        legacy.refresh_from_db()
        assert legacy.provider == "integrations:github"
        assert legacy.integration_id == self.integration.id

    def test_create_repository__only_activates_hidden_repo(self, get_jwt: MagicMock) -> None:
        repo = self._create_repo(external_id=self.config["external_id"])
        repo.status = ObjectStatus.PENDING_DELETION
        repo.save()

        with pytest.raises(RepoExistsError) as exc_info:
            self.provider.create_repository(self.config, self.organization)

        assert exc_info.value.existing_repo is None
        repo.refresh_from_db()
        assert repo.status == ObjectStatus.PENDING_DELETION

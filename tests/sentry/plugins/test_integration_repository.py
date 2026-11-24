from dataclasses import dataclass
from functools import cached_property
from unittest.mock import MagicMock, patch

import pytest
import responses
from django.db import IntegrityError

from sentry.constants import ObjectStatus
from sentry.integrations.github.repository import GitHubRepositoryProvider
from sentry.integrations.services.repository import repository_service
from sentry.integrations.source_code_management.repository_reconciliation import (
    RepositoryConfig,
    RepositoryReconciliationPolicy,
    index_repository_configs,
    index_repository_snapshots,
    plan_repository_reconciliation,
    select_adoptable_repositories,
)
from sentry.models.repository import REPOSITORY_NAME_LENGTH, REPOSITORY_URL_LENGTH, Repository
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.plugins.providers.integration_repository import RepoExistsError
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import TestCase


@dataclass
class RepositorySnapshotFixture:
    id: int
    external_id: str | None
    integration_id: int | None
    provider: str | None
    status: int = ObjectStatus.ACTIVE


def repository_config(external_id: str, integration_id: int = 1) -> RepositoryConfig:
    return {
        "name": f"org/{external_id}",
        "external_id": external_id,
        "url": f"https://example.com/org/{external_id}",
        "config": {},
        "integration_id": integration_id,
    }


class TestRepositoryReconciliationPlanner:
    policy = RepositoryReconciliationPolicy(
        canonical_provider="integrations:github",
        adoptable_providers=frozenset({"github"}),
        can_transfer=True,
    )

    def test_duplicate_configs_use_the_last_value(self) -> None:
        first = repository_config("duplicate", integration_id=1)
        last = repository_config("duplicate", integration_id=2)

        configs = index_repository_configs([first, last])

        assert configs == {"duplicate": last}

    def test_selects_only_adoptable_provider_rows(self) -> None:
        canonical = RepositorySnapshotFixture(1, "taken", 1, "integrations:github")
        legacy_taken = RepositorySnapshotFixture(2, "taken", None, "github")
        legacy = RepositorySnapshotFixture(3, "legacy", None, "github")
        providerless = RepositorySnapshotFixture(4, "providerless", None, None)
        cross_provider = RepositorySnapshotFixture(5, "cross-provider", None, "gitlab")

        selected = select_adoptable_repositories(
            [canonical, legacy_taken, legacy, providerless, cross_provider],
            taken_external_ids={"taken"},
            policy=self.policy,
        )

        assert selected == [canonical, legacy, providerless]

    def test_indexes_first_usable_snapshot(self) -> None:
        canonical = RepositorySnapshotFixture(1, "same-id", 1, "integrations:github")
        duplicate = RepositorySnapshotFixture(2, "same-id", None, "github")
        pending = RepositorySnapshotFixture(
            3, "pending", 1, "integrations:github", ObjectStatus.PENDING_DELETION
        )
        active_after_pending = RepositorySnapshotFixture(4, "pending", 1, "integrations:github")
        deleting = RepositorySnapshotFixture(
            5, "deleting", 1, "integrations:github", ObjectStatus.DELETION_IN_PROGRESS
        )

        indexed = index_repository_snapshots(
            [canonical, duplicate, pending, active_after_pending, deleting],
            {"same-id", "pending", "deleting"},
        )

        assert indexed == {"same-id": canonical, "pending": active_after_pending}

    def test_plans_create_refresh_reactivation_adoption_and_transfer(self) -> None:
        configs = index_repository_configs(
            [
                repository_config("create"),
                repository_config("active"),
                repository_config("disabled"),
                repository_config("hidden"),
                repository_config("unlinked"),
                repository_config("transfer"),
            ]
        )
        active = RepositorySnapshotFixture(1, "active", 1, "integrations:github")
        disabled = RepositorySnapshotFixture(
            2, "disabled", 1, "integrations:github", ObjectStatus.DISABLED
        )
        hidden = RepositorySnapshotFixture(
            3, "hidden", 1, "integrations:github", ObjectStatus.HIDDEN
        )
        unlinked = RepositorySnapshotFixture(4, "unlinked", None, None)
        transfer = RepositorySnapshotFixture(5, "transfer", 2, "integrations:github")

        plan = plan_repository_reconciliation(
            configs,
            {
                "active": active,
                "disabled": disabled,
                "hidden": hidden,
                "unlinked": unlinked,
                "transfer": transfer,
            },
            policy=self.policy,
        )

        assert plan.to_create == (configs["create"],)
        assert plan.to_update == (
            (active, configs["active"]),
            (disabled, configs["disabled"]),
            (hidden, configs["hidden"]),
            (unlinked, configs["unlinked"]),
        )
        assert plan.to_transfer == ((transfer, configs["transfer"]),)
        assert plan.conflicts == ()
        assert plan.already_active_repository_ids == frozenset({active.id})
        assert plan.already_active_configs == (configs["active"],)

    def test_plans_untransferable_repository_as_conflict(self) -> None:
        config = repository_config("conflict")
        existing = RepositorySnapshotFixture(1, "conflict", 2, "integrations:github")
        policy = RepositoryReconciliationPolicy(
            canonical_provider="integrations:github",
            adoptable_providers=frozenset({"github"}),
            can_transfer=False,
        )

        plan = plan_repository_reconciliation(
            {"conflict": config}, {"conflict": existing}, policy=policy
        )

        assert plan.to_transfer == ()
        assert plan.conflicts == ((existing, config),)


@patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
class IntegrationRepositoryTestCase(TestCase):
    @responses.activate
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, provider="github", external_id="654321"
        )
        self.repo_name = "getsentry/sentry"
        self.repo_external_id = "654321"
        self.rpc_organization = serialize_rpc_organization(self.organization)
        self.config: dict[str, str | int] = {
            "identifier": self.repo_name,
            "external_id": self.repo_external_id,
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
        identifier = "a" * 510
        config = {**self.config, "identifier": identifier}
        self.provider.create_repository(config, self.rpc_organization)

        repos = Repository.objects.all()
        assert len(repos) == 1

        assert repos[0].name == identifier[:REPOSITORY_NAME_LENGTH]
        assert repos[0].url == f"https://github.com/{identifier}"[:REPOSITORY_URL_LENGTH]
        assert repos[0].provider == "integrations:github"

    def test_create_repository(self, get_jwt: MagicMock) -> None:
        self.provider.create_repository(self.config, self.rpc_organization)

        repos = Repository.objects.all()
        assert len(repos) == 1

        assert repos[0].name == self.repo_name
        assert repos[0].provider == "integrations:github"

    def test_create_repository__repo_exists(self, get_jwt: MagicMock) -> None:
        existing = self._create_repo(external_id=self.repo_external_id)

        with pytest.raises(RepoExistsError) as exc_info:
            self.provider.create_repository(self.config, self.rpc_organization)

        assert exc_info.value.existing_repo is not None
        assert exc_info.value.existing_repo.id == existing.id
        assert Repository.objects.count() == 1

    def test_create_repository__transfers_repo_from_other_integration_in_org(
        self, get_jwt: MagicMock
    ) -> None:
        # the repo moved between GitHub orgs: it exists on another integration of this org
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="123456"
        )
        existing = self._create_repo(
            external_id=self.repo_external_id,
            name="getsentry/santry",
            status=ObjectStatus.DISABLED,
            integration_id=integration.id,
        )

        _, repo = self.provider.create_repository(self.config, self.rpc_organization)

        assert repo.id == existing.id
        assert Repository.objects.count() == 1
        existing.refresh_from_db()
        assert existing.integration_id == self.integration.id
        assert existing.status == ObjectStatus.ACTIVE
        assert existing.name == self.repo_name
        assert existing.url == self.config["url"]

    def test_create_repository__does_not_transfer_when_provider_cannot(
        self, get_jwt: MagicMock
    ) -> None:
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="123456"
        )
        repo = self._create_repo(
            external_id=self.repo_external_id,
            name="getsentry/santry",
            status=ObjectStatus.DISABLED,
            integration_id=integration.id,
        )

        with (
            patch.object(GitHubRepositoryProvider, "can_transfer_repositories", False),
            pytest.raises(RepoExistsError) as exc_info,
        ):
            self.provider.create_repository(self.config, self.rpc_organization)

        assert exc_info.value.existing_repo is None
        repo.refresh_from_db()
        assert repo.integration_id == integration.id
        assert repo.status == ObjectStatus.DISABLED
        assert repo.name == "getsentry/santry"

    def test_create_repository__does_not_reuse_hidden_repo_from_other_provider(
        self, get_jwt: MagicMock
    ) -> None:
        ghe_integration = self.create_integration(
            organization=self.organization, provider="github_enterprise", external_id="ghe:1"
        )
        ghe_repo = self.create_repo(
            project=self.project,
            name="ghe-org/sentry",
            provider="integrations:github_enterprise",
            integration_id=ghe_integration.id,
            external_id=self.repo_external_id,
        )
        Repository.objects.filter(id=ghe_repo.id).update(status=ObjectStatus.DISABLED)

        _, repo = self.provider.create_repository(self.config, self.rpc_organization)

        assert repo.id != ghe_repo.id
        assert repo.provider == "integrations:github"
        assert repo.integration_id == self.integration.id
        ghe_repo.refresh_from_db()
        assert ghe_repo.provider == "integrations:github_enterprise"
        assert ghe_repo.integration_id == ghe_integration.id
        assert ghe_repo.status == ObjectStatus.DISABLED

    def test_create_repository__repo_exists_update_name(self, get_jwt: MagicMock) -> None:
        repo = self._create_repo(external_id=self.repo_external_id, name="getsentry/santry")

        with pytest.raises(RepoExistsError) as exc_info:
            self.provider.create_repository(self.config, self.rpc_organization)

        existing = exc_info.value.existing_repo
        assert existing is not None
        assert existing.id == repo.id
        assert existing.name == self.repo_name
        repo.refresh_from_db()
        assert repo.name == self.repo_name

    def test_create_repository__repo_exists_preserves_config(self, get_jwt: MagicMock) -> None:
        repo = self._create_repo(external_id=self.repo_external_id)
        repo.update(config={**repo.config, "webhook_id": "hook-1"})

        with pytest.raises(RepoExistsError):
            self.provider.create_repository(self.config, self.rpc_organization)

        repo.refresh_from_db()
        assert repo.config["webhook_id"] == "hook-1"

    @patch("sentry.models.Repository.objects.create")
    @patch("sentry.plugins.providers.IntegrationRepositoryProvider.on_delete_repository")
    def test_create_repository__delete_webhook(
        self, mock_on_delete: MagicMock, mock_repo: MagicMock, get_jwt: MagicMock
    ) -> None:
        self._create_repo()

        mock_repo.side_effect = IntegrityError
        mock_on_delete.side_effect = IntegrationError

        with pytest.raises(RepoExistsError) as exc_info:
            self.provider.create_repository(self.config, self.rpc_organization)

        # Pre-existing repo is under the default external_id=123456, not the
        # config's 654321 — the lookup by (integration_id, external_id) misses,
        # so the race fallback has nothing to surface.
        assert exc_info.value.existing_repo is None

    def test_create_repository__integrity_error_attaches_existing(self, get_jwt: MagicMock) -> None:
        existing = self._create_repo(external_id=self.repo_external_id)

        with (
            patch("sentry.models.Repository.objects.create", side_effect=IntegrityError),
            pytest.raises(RepoExistsError) as exc_info,
        ):
            self.provider.create_repository(self.config, self.rpc_organization)

        assert exc_info.value.existing_repo is not None
        assert exc_info.value.existing_repo.id == existing.id

    @patch("sentry.plugins.providers.integration_repository.metrics")
    def test_create_repository__activates_existing_hidden_repo(
        self, mock_metrics: MagicMock, get_jwt: MagicMock
    ) -> None:
        repo = self._create_repo(external_id=self.repo_external_id)
        repo.status = ObjectStatus.HIDDEN
        repo.save()

        self.provider.create_repository(self.config, self.rpc_organization)
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
            external_id=self.repo_external_id,
        )
        other.update(status=ObjectStatus.HIDDEN)

        _, repo = self.provider.create_repository(self.config, self.rpc_organization)

        assert repo.id != other.id
        assert repo.provider == "integrations:github"
        other.refresh_from_db()
        assert other.status == ObjectStatus.HIDDEN

    def test_create_repository__activates_hidden_repo_without_provider(
        self, get_jwt: MagicMock
    ) -> None:
        orphan = self.create_repo(
            project=self.project, name=self.repo_name, external_id=self.repo_external_id
        )
        orphan.update(status=ObjectStatus.HIDDEN)

        _, repo = self.provider.create_repository(self.config, self.rpc_organization)

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
            external_id=self.repo_external_id,
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
            [self.config, other_config], self.rpc_organization
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
            external_id=self.repo_external_id,
        )
        hidden.update(status=ObjectStatus.HIDDEN)
        orphan = self.create_repo(project=self.project, name="getsentry/other", external_id="999")
        other_config = {**self.config, "external_id": "999", "identifier": "getsentry/other"}

        created, reactivated, missing = self.provider.create_repositories(
            [self.config, other_config], self.rpc_organization
        )

        assert created == []
        assert {repo.id for repo in reactivated} == {hidden.id, orphan.id}
        assert missing == []
        for repo in (hidden, orphan):
            repo.refresh_from_db()
            assert repo.status == ObjectStatus.ACTIVE
            assert repo.provider == "integrations:github"
            assert repo.integration_id == self.integration.id

    def test_create_repositories__scopes_lookups_to_external_ids(self, get_jwt: MagicMock) -> None:
        other_config = {**self.config, "external_id": "999", "identifier": "getsentry/other"}

        with patch.object(
            repository_service,
            "get_repositories",
            wraps=repository_service.get_repositories,
        ) as get_repositories:
            self.provider.create_repositories([self.config, other_config], self.rpc_organization)

        assert get_repositories.call_count == 4
        for call in get_repositories.call_args_list:
            assert set(call.kwargs["external_ids"]) == {"654321", "999"}

    def test_create_repository__does_not_adopt_over_an_existing_row(
        self, get_jwt: MagicMock
    ) -> None:
        # A plugin-era row and the integration's own row for the same repo: adopting the
        # former would rewrite it onto the key the latter already holds.
        legacy = self.create_repo(
            project=self.project,
            name=self.repo_name,
            provider="github",
            external_id=self.repo_external_id,
        )
        existing = self._create_repo(external_id=self.repo_external_id)

        with pytest.raises(RepoExistsError) as exc_info:
            self.provider.create_repository(self.config, self.rpc_organization)

        assert exc_info.value.existing_repo is not None
        assert exc_info.value.existing_repo.id == existing.id
        legacy.refresh_from_db()
        assert (legacy.provider, legacy.integration_id) == ("github", None)

    def test_create_repositories__does_not_adopt_over_an_existing_row(
        self, get_jwt: MagicMock
    ) -> None:
        legacy = self.create_repo(
            project=self.project,
            name=self.repo_name,
            provider="github",
            external_id=self.repo_external_id,
        )
        legacy.update(status=ObjectStatus.HIDDEN)
        self._create_repo(external_id=self.repo_external_id)

        created, reactivated, missing = self.provider.create_repositories(
            [self.config], self.rpc_organization
        )

        assert created == []
        assert reactivated == []
        assert missing == [
            self.provider.build_repository_config(self.rpc_organization, self.config)
        ]
        legacy.refresh_from_db()
        assert (legacy.status, legacy.provider) == (ObjectStatus.HIDDEN, "github")

    def test_create_repository__ignores_unlinked_repo_of_other_provider(
        self, get_jwt: MagicMock
    ) -> None:
        other = self.create_repo(
            project=self.project,
            name="group/project",
            provider="gitlab",
            external_id=self.repo_external_id,
        )

        _, repo = self.provider.create_repository(self.config, self.rpc_organization)

        assert repo.id != other.id
        other.refresh_from_db()
        assert other.provider == "gitlab"
        assert other.integration_id is None

    def test_create_repository__adopts_plugin_era_repo(self, get_jwt: MagicMock) -> None:
        legacy = self.create_repo(
            project=self.project,
            name=self.repo_name,
            provider="github",
            external_id=self.repo_external_id,
        )

        _, repo = self.provider.create_repository(self.config, self.rpc_organization)

        assert repo.id == legacy.id
        legacy.refresh_from_db()
        assert legacy.provider == "integrations:github"
        assert legacy.integration_id == self.integration.id

    def test_create_repository__only_activates_hidden_repo(self, get_jwt: MagicMock) -> None:
        repo = self._create_repo(external_id=self.repo_external_id)
        repo.status = ObjectStatus.PENDING_DELETION
        repo.save()

        with pytest.raises(RepoExistsError) as exc_info:
            self.provider.create_repository(self.config, self.rpc_organization)

        assert exc_info.value.existing_repo is None
        repo.refresh_from_db()
        assert repo.status == ObjectStatus.PENDING_DELETION

    def test_create_repositories__adopts_unlinked_active_repo(self, get_jwt: MagicMock) -> None:
        # ACTIVE unlinked rows are adopted, not reported as already-active/not-created
        repo = self._create_repo(external_id=self.repo_external_id)
        Repository.objects.filter(id=repo.id).update(integration_id=None)

        created, updated, not_created = self.provider.create_repositories(
            [self.config], self.rpc_organization
        )

        assert created == []
        assert [r.id for r in updated] == [repo.id]
        assert not_created == []
        repo.refresh_from_db()
        assert repo.integration_id == self.integration.id
        assert repo.status == ObjectStatus.ACTIVE

    def test_create_repositories__adopts_legacy_plugin_repo(self, get_jwt: MagicMock) -> None:
        # legacy plugin repos use the bare provider slug and no integration_id
        repo = self.create_repo(
            project=self.project,
            name=self.repo_name,
            provider="github",
            integration_id=None,
            external_id=self.repo_external_id,
            url="https://github.com/" + self.repo_name,
        )

        created, updated, not_created = self.provider.create_repositories(
            [self.config], self.rpc_organization
        )

        assert created == []
        assert [r.id for r in updated] == [repo.id]
        assert not_created == []
        repo.refresh_from_db()
        assert repo.provider == "integrations:github"
        assert repo.integration_id == self.integration.id
        assert repo.status == ObjectStatus.ACTIVE

    def test_create_repositories__already_active_on_integration_is_not_created(
        self, get_jwt: MagicMock
    ) -> None:
        self._create_repo(external_id=self.repo_external_id)

        created, updated, not_created = self.provider.create_repositories(
            [self.config], self.rpc_organization
        )

        assert created == []
        assert updated == []
        assert len(not_created) == 1
        assert not_created[0]["external_id"] == self.config["external_id"]

    def test_create_repositories__reactivating_hidden_is_not_already_active(
        self, get_jwt: MagicMock
    ) -> None:
        repo = self._create_repo(external_id=self.repo_external_id, status=ObjectStatus.HIDDEN)

        created, updated, not_created = self.provider.create_repositories(
            [self.config], self.rpc_organization
        )

        assert created == []
        assert [r.id for r in updated] == [repo.id]
        assert not_created == []
        repo.refresh_from_db()
        assert repo.status == ObjectStatus.ACTIVE


class CreateRepositoriesTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, provider="github", external_id="654321"
        )
        self.repo_external_id = "654321"
        self.rpc_organization = serialize_rpc_organization(self.organization)
        self.config: dict[str, str | int] = {
            "identifier": "getsentry/sentry",
            "external_id": self.repo_external_id,
            "integration_id": self.integration.id,
        }

    @cached_property
    def provider(self) -> GitHubRepositoryProvider:
        return GitHubRepositoryProvider("integrations:github")

    def _existing(self, status: int) -> Repository:
        return Repository.objects.create(
            name="getsentry/old-name",
            provider="integrations:github",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_id=self.repo_external_id,
            status=status,
        )

    def test_an_active_repository_is_refreshed_but_not_reactivated(self) -> None:
        repo = self._existing(ObjectStatus.ACTIVE)

        created, reactivated, _ = self.provider.create_repositories(
            configs=[self.config], organization=self.rpc_organization
        )

        assert (created, reactivated) == ([], [])
        repo.refresh_from_db()
        assert repo.name == "getsentry/sentry"

    def test_a_disabled_repository_is_reactivated(self) -> None:
        repo = self._existing(ObjectStatus.DISABLED)

        created, reactivated, _ = self.provider.create_repositories(
            configs=[self.config], organization=self.rpc_organization
        )

        assert created == []
        assert [r.id for r in reactivated] == [repo.id]
        repo.refresh_from_db()
        assert repo.status == ObjectStatus.ACTIVE

from unittest.mock import MagicMock, patch

import pytest

from sentry import audit_log
from sentry.constants import ObjectStatus
from sentry.integrations.github.tasks.reconcile_repos_on_install_change import (
    reconcile_repos_on_install_change,
)
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode_of, cell_silo_test

PROVIDER = "integrations:github"


def _item(external_id: str, full_name: str, host: str = "github.com") -> dict[str, str]:
    return {
        "external_id": external_id,
        "full_name": full_name,
        "url": f"https://{host}/{full_name}",
    }


@cell_silo_test
class ReconcileReposOnInstallChangeTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization, external_id="1", provider="github"
        )
        self.org_integration = self.integration.organizationintegration_set.get()

    def _run(
        self,
        repos_added: list[dict[str, str]] | None = None,
        repos_removed: list[dict[str, str]] | None = None,
        organization_id: int | None = None,
        provider: str = "github",
    ) -> None:
        with outbox_runner():
            reconcile_repos_on_install_change(
                organization_id=organization_id or self.organization.id,
                integration_id=self.integration.id,
                organization_integration_id=self.org_integration.id,
                provider=provider,
                repos_added=repos_added or [],
                repos_removed=repos_removed or [],
            )

    def _audit_targets(self, event_name: str) -> list[int | None]:
        with assume_test_silo_mode_of(AuditLogEntry):
            return list(
                AuditLogEntry.objects.filter(
                    organization_id=self.organization.id,
                    event=audit_log.get_event_id(event_name),
                )
                .order_by("target_object")
                .values_list("target_object", flat=True)
            )

    def _repo(
        self,
        external_id: str,
        name: str,
        integration_id: int | None = None,
        status: int = ObjectStatus.ACTIVE,
        provider: str = PROVIDER,
    ) -> Repository:
        repo = self.create_repo(
            project=self.project,
            name=name,
            external_id=external_id,
            provider=provider,
            integration_id=integration_id or self.integration.id,
        )
        # The factory always creates active repos.
        repo.update(status=status)
        return repo

    def test_creates_new_repos(self) -> None:
        self._run(repos_added=[_item("1", "example-org/api"), _item("2", "example-org/web")])

        repos = Repository.objects.filter(organization_id=self.organization.id).order_by("name")
        assert [(r.name, r.external_id, r.provider, r.integration_id, r.status) for r in repos] == [
            ("example-org/api", "1", PROVIDER, self.integration.id, ObjectStatus.ACTIVE),
            ("example-org/web", "2", PROVIDER, self.integration.id, ObjectStatus.ACTIVE),
        ]
        assert repos[0].url == "https://github.com/example-org/api"
        assert repos[0].config == {"name": "example-org/api"}
        assert self._audit_targets("REPO_ADDED") == sorted(r.id for r in repos)

    def test_running_the_same_change_twice_audits_once(self) -> None:
        old = self._repo("3", "example-org/old")
        added = [_item("1", "example-org/api")]
        removed = [_item("3", "example-org/old")]

        self._run(repos_added=added, repos_removed=removed)
        self._run(repos_added=added, repos_removed=removed)

        new = Repository.objects.get(organization_id=self.organization.id, external_id="1")
        assert self._audit_targets("REPO_ADDED") == [new.id]
        assert self._audit_targets("REPO_DISABLED") == [old.id]
        assert self._audit_targets("REPO_ENABLED") == []

    def test_reactivates_disabled_repo(self) -> None:
        repo = self._repo("1", "example-org/old-name", status=ObjectStatus.DISABLED)

        self._run(repos_added=[_item("1", "example-org/api")])

        repo.refresh_from_db()
        assert repo.status == ObjectStatus.ACTIVE
        assert repo.name == "example-org/api"
        assert Repository.objects.filter(organization_id=self.organization.id).count() == 1
        assert self._audit_targets("REPO_ENABLED") == [repo.id]
        assert self._audit_targets("REPO_ADDED") == []

    @patch(
        "sentry.plugins.providers.integration_repository.integration_service.get_organization_integration"
    )
    def test_transfers_repo_from_other_integration(self, get_org_integration: MagicMock) -> None:
        other_integration = self.create_integration(
            organization=self.organization, external_id="2", provider="github"
        )
        other_org_integration = other_integration.organizationintegration_set.get()
        repo = self._repo("1", "old-org/api", integration_id=other_integration.id)
        code_mapping = self.create_code_mapping(
            project=self.project, repo=repo, organization_integration=other_org_integration
        )

        self._run(repos_added=[_item("1", "example-org/api")])

        repo.refresh_from_db()
        assert repo.integration_id == self.integration.id
        assert repo.name == "example-org/api"
        code_mapping.refresh_from_db()
        assert code_mapping.organization_integration_id == self.org_integration.id
        assert self._audit_targets("REPO_ENABLED") == [repo.id]
        # The payload's organization integration is used instead of asking control.
        get_org_integration.assert_not_called()

    def test_repo_pending_deletion_on_other_integration_is_left_alone(self) -> None:
        other_integration = self.create_integration(
            organization=self.organization, external_id="2", provider="github"
        )
        repo = self._repo(
            "1",
            "old-org/api",
            integration_id=other_integration.id,
            status=ObjectStatus.PENDING_DELETION,
        )

        self._run(repos_added=[_item("1", "example-org/api")])

        repo.refresh_from_db()
        assert repo.integration_id == other_integration.id
        assert repo.status == ObjectStatus.PENDING_DELETION
        assert Repository.objects.filter(organization_id=self.organization.id).count() == 1
        assert self._audit_targets("REPO_ADDED") == []
        assert self._audit_targets("REPO_ENABLED") == []

    @patch("sentry.integrations.github_enterprise.repository.integration_service.get_integration")
    def test_github_enterprise_uses_its_provider_and_payload_url(
        self, get_integration: MagicMock
    ) -> None:
        self._run(
            repos_added=[_item("1", "example-org/api", host="ghe.example.com")],
            provider="github_enterprise",
        )

        repo = Repository.objects.get(organization_id=self.organization.id, external_id="1")
        assert repo.provider == "integrations:github_enterprise"
        assert repo.url == "https://ghe.example.com/example-org/api"
        with assume_test_silo_mode_of(AuditLogEntry):
            entry = AuditLogEntry.objects.get(
                organization_id=self.organization.id,
                event=audit_log.get_event_id("REPO_ADDED"),
            )
        assert entry.data["provider"] == "github_enterprise"
        # The URL comes from the payload, so the host isn't looked up in control.
        get_integration.assert_not_called()

    def test_github_enterprise_does_not_transfer(self) -> None:
        other_integration = self.create_integration(
            organization=self.organization, external_id="2", provider="github_enterprise"
        )
        repo = self._repo(
            "1",
            "old-org/api",
            integration_id=other_integration.id,
            provider="integrations:github_enterprise",
        )

        self._run(
            repos_added=[_item("1", "example-org/api", host="ghe.example.com")],
            provider="github_enterprise",
        )

        repo.refresh_from_db()
        assert repo.integration_id == other_integration.id
        assert repo.name == "old-org/api"
        assert self._audit_targets("REPO_ENABLED") == []

    def test_unsupported_provider_is_noop(self) -> None:
        self._run(repos_added=[_item("1", "example-org/api")], provider="gitlab")

        assert not Repository.objects.filter(organization_id=self.organization.id).exists()

    def test_failed_audit_rolls_back_repo_changes(self) -> None:
        with (
            patch(
                "sentry.integrations.github.tasks.sync_repos_on_install_change.log_repo_change",
                side_effect=RuntimeError("boom"),
            ),
            pytest.raises(RuntimeError),
        ):
            self._run(repos_added=[_item("1", "example-org/api")])

        assert not Repository.objects.filter(organization_id=self.organization.id).exists()

    def test_disables_removed_repos(self) -> None:
        active = self._repo("3", "example-org/old")
        already_disabled = self._repo("4", "example-org/older", status=ObjectStatus.DISABLED)

        self._run(repos_removed=[_item("3", "example-org/old"), _item("4", "example-org/older")])

        active.refresh_from_db()
        already_disabled.refresh_from_db()
        assert active.status == ObjectStatus.DISABLED
        assert already_disabled.status == ObjectStatus.DISABLED
        assert self._audit_targets("REPO_DISABLED") == [active.id]

    def test_skips_disable_for_recently_active_repo(self) -> None:
        busy = self._repo("3", "example-org/busy")
        self.create_commit(repo=busy)
        idle = self._repo("4", "example-org/idle")

        self._run(repos_removed=[_item("3", "example-org/busy"), _item("4", "example-org/idle")])

        busy.refresh_from_db()
        idle.refresh_from_db()
        assert busy.status == ObjectStatus.ACTIVE
        assert idle.status == ObjectStatus.DISABLED
        assert self._audit_targets("REPO_DISABLED") == [idle.id]

    def test_missing_organization_is_noop(self) -> None:
        self._run(
            repos_added=[_item("1", "example-org/api")],
            organization_id=self.organization.id + 1000,
        )

        assert not Repository.objects.filter(external_id="1").exists()

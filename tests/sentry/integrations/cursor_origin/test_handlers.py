from __future__ import annotations

from typing import Any
from unittest import mock

from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.handlers import HANDLERS
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode_of, control_silo_test

SYNC_TASK = "sentry.integrations.source_code_management.sync_repos.sync_repos_for_org"
INSTALLATION_ID = "i_01example"
DELIVERY_ID = "whd_01example"
WEB = "https://cursor.com/codebase"


def _installation(**overrides: Any) -> dict[str, Any]:
    """The snapshot every installation event carries."""
    payload: dict[str, Any] = {
        "id": INSTALLATION_ID,
        "appId": "app_01example",
        "target": {"slug": "acme", "id": "ns_01example", "type": "team"},
        "repoSelectionMode": "selected",
        "scopes": ["repository:contents:read"],
    }
    payload.update(overrides)
    return {"installation": payload}


@control_silo_test
class InstallationEventHandlerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            metadata={
                "installation_id": INSTALLATION_ID,
                "scopes": ["repository:contents:read"],
                "repo_selection_mode": "selected",
                "domain_name": f"{WEB}/acme",
            },
        )
        with assume_test_silo_mode_of(Repository):
            self.repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="acme/rocket",
                provider="integrations:cursor_origin",
                external_id="r_01example",
                integration_id=self.integration.id,
            )

    def _handle(self, event_type: str, payload: dict[str, Any] | None = None) -> None:
        HANDLERS[event_type]()(payload if payload is not None else _installation(), DELIVERY_ID)

    def _integration(self) -> Integration:
        return Integration.objects.get(id=self.integration.id)

    def _org_integration_id(self) -> int:
        return OrganizationIntegration.objects.get(
            integration_id=self.integration.id, organization_id=self.organization.id
        ).id

    def test_an_uninstall_disables_the_integration_and_its_repositories(self) -> None:
        self._handle("installation.deleted")

        assert self._integration().status == ObjectStatus.DISABLED
        with assume_test_silo_mode_of(Repository):
            assert Repository.objects.get(id=self.repo.id).status == ObjectStatus.DISABLED

    def test_a_suspension_disables_the_integration(self) -> None:
        """A suspended installation mints no tokens, so nothing can be read."""
        self._handle("installation.suspended")

        assert self._integration().status == ObjectStatus.DISABLED

    def test_being_unsuspended_restores_the_integration(self) -> None:
        self._handle("installation.suspended")

        self._handle("installation.unsuspended")

        assert self._integration().status == ObjectStatus.ACTIVE

    def test_an_update_refreshes_the_stored_grant(self) -> None:
        self._handle(
            "installation.updated",
            _installation(
                scopes=["repository:contents:read", "repository:checks:write"],
                repoSelectionMode="all",
            ),
        )

        metadata = self._integration().metadata
        assert metadata["scopes"] == [
            "repository:contents:read",
            "repository:checks:write",
        ]
        assert metadata["repo_selection_mode"] == "all"

    def test_an_update_keeps_metadata_it_does_not_carry(self) -> None:
        """The stored access token must survive an update; metadata is replaced, not merged."""
        self.integration.metadata["access_token"] = "oit_stored"
        self.integration.metadata["expires_at"] = "2026-09-16T23:00:00Z"
        self.integration.save()

        self._handle("installation.updated", _installation(repoSelectionMode="all"))

        metadata = self._integration().metadata
        assert metadata["access_token"] == "oit_stored"
        assert metadata["expires_at"] == "2026-09-16T23:00:00Z"
        assert metadata["repo_selection_mode"] == "all"

    def test_an_update_without_a_slug_keeps_the_domain(self) -> None:
        """`source_url_matches` reads `domain_name` directly, so it must not be dropped."""
        self._handle("installation.updated", _installation(target={"id": "ns_01example"}))

        integration = self._integration()
        assert integration.metadata["domain_name"] == f"{WEB}/acme"
        assert integration.name == "acme"

    def test_a_renamed_codebase_updates_the_name_and_urls(self) -> None:
        """Origin sends this when the owner namespace slug changes."""
        self._handle(
            "installation.updated",
            _installation(target={"slug": "acme-corp", "id": "ns_01example", "type": "team"}),
        )

        integration = self._integration()
        assert integration.name == "acme-corp"
        assert integration.metadata["domain_name"] == f"{WEB}/acme-corp"

    def test_being_unsuspended_syncs_repositories_rather_than_waiting_a_day(self) -> None:
        self._handle("installation.suspended")

        with mock.patch(f"{SYNC_TASK}.apply_async") as mock_sync:
            self._handle("installation.unsuspended")

        assert mock_sync.call_args.kwargs["kwargs"] == {
            "organization_integration_id": self._org_integration_id()
        }

    def test_an_update_syncs_repositories(self) -> None:
        """Origin folds a change of repository selection into this event."""
        with mock.patch(f"{SYNC_TASK}.apply_async") as mock_sync:
            self._handle("installation.updated", _installation(repoSelectionMode="all"))

        assert mock_sync.call_args.kwargs["kwargs"] == {
            "organization_integration_id": self._org_integration_id()
        }

    def test_an_uninstall_does_not_sync_repositories(self) -> None:
        """Nothing to read any more, and the repositories are disabled outright."""
        with mock.patch(f"{SYNC_TASK}.apply_async") as mock_sync:
            self._handle("installation.deleted")

        assert not mock_sync.called

    def test_an_installation_sentry_does_not_have_is_ignored(self) -> None:
        """A half-finished install, or one already removed from this side."""
        self._handle("installation.deleted", _installation(id="i_01someone_else"))

        assert self._integration().status == ObjectStatus.ACTIVE

    def test_a_payload_with_no_installation_is_ignored(self) -> None:
        self._handle("installation.deleted", {})

        assert self._integration().status == ObjectStatus.ACTIVE

    def test_another_organizations_repositories_are_left_alone(self) -> None:
        """Repositories are disabled per organization on the shared installation."""
        other_org = self.create_organization()
        with assume_test_silo_mode_of(OrganizationIntegration):
            self.create_organization_integration(
                organization_id=other_org.id, integration_id=self.integration.id
            )
        with assume_test_silo_mode_of(Repository):
            other_repo = Repository.objects.create(
                organization_id=other_org.id,
                name="acme/widget",
                provider="integrations:github",
                external_id="gh_1",
                integration_id=self.integration.id,
            )

        self._handle("installation.deleted")

        with assume_test_silo_mode_of(Repository):
            assert Repository.objects.get(id=other_repo.id).status == ObjectStatus.ACTIVE

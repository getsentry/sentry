from __future__ import annotations

from typing import Any
from unittest import mock

import pytest

from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.repository_events import (
    RepositoryCreatedHandler,
    RepositoryDeletedHandler,
    RepositoryMetadataUpdatedHandler,
    refresh_repository_name,
)
from sentry.integrations.cursor_origin.webhook_types import (
    OriginPayloadError,
    RepositoryMetadataEvent,
)
from sentry.integrations.services.integration import integration_service
from sentry.models.commit import Commit
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test

INSTALLATION_ID = "i_01example"
REPO = "acme/rocket"
REPO_EXTERNAL_ID = "r_01example"
WEB = "https://cursor.com/codebase"
DELIVERY_ID = "whd_01example"


def _payload(**overrides: Any) -> dict[str, Any]:
    repository: dict[str, Any] = {
        "id": REPO_EXTERNAL_ID,
        "name": "rocket",
        "fullName": REPO,
        "owner": {"slug": "acme", "id": "ns_01example", "type": "team"},
        "defaultBranch": "main",
    }
    repository.update(overrides)
    return {"repository": repository}


@cell_silo_test
class RepositoryMetadataUpdatedHandlerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            status=ObjectStatus.ACTIVE,
        )
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name=REPO,
            url=f"{WEB}/{REPO}",
            provider="integrations:cursor_origin",
            integration_id=self.integration.id,
            external_id=REPO_EXTERNAL_ID,
            config={"name": REPO, "default_branch": "main"},
        )
        context = integration_service.organization_contexts(
            provider="cursor_origin", external_id=INSTALLATION_ID
        )
        assert context.integration is not None
        self.rpc_integration = context.integration
        self.org_integrations = context.organization_integrations

    def _handle(self, payload: dict[str, Any]) -> None:
        RepositoryMetadataUpdatedHandler()(
            payload, DELIVERY_ID, self.rpc_integration, self.org_integrations
        )

    def _reloaded(self) -> Repository:
        return Repository.objects.get(id=self.repo.id)

    def test_a_new_default_branch_is_stored(self) -> None:
        self._handle(_payload(defaultBranch="trunk"))

        assert self._reloaded().config["default_branch"] == "trunk"

    def test_an_unchanged_snapshot_writes_nothing(self) -> None:
        before = self._reloaded().date_added

        self._handle(_payload())

        assert self._reloaded().date_added == before

    def test_a_repository_sentry_does_not_have_is_ignored(self) -> None:
        self._handle(_payload(id="r_01nope", defaultBranch="trunk"))

        assert self._reloaded().config["default_branch"] == "main"

    def test_another_organizations_repository_is_left_alone(self) -> None:
        other_org = self.create_organization()
        other_repo = Repository.objects.create(
            organization_id=other_org.id,
            name=REPO,
            provider="integrations:cursor_origin",
            external_id=REPO_EXTERNAL_ID,
            config={"name": REPO, "default_branch": "main"},
        )

        self._handle(_payload(defaultBranch="trunk"))

        assert Repository.objects.get(id=other_repo.id).config["default_branch"] == "main"


class RepositoryMetadataEventTest(TestCase):
    def test_a_missing_repository_id_is_refused(self) -> None:
        payload = _payload()
        del payload["repository"]["id"]

        with pytest.raises(OriginPayloadError, match="repository -> id"):
            RepositoryMetadataEvent.from_payload(payload)

    def test_a_missing_full_name_is_refused(self) -> None:
        payload = _payload()
        del payload["repository"]["fullName"]

        with pytest.raises(OriginPayloadError, match="repository -> fullName"):
            RepositoryMetadataEvent.from_payload(payload)

    def test_a_missing_default_branch_is_refused(self) -> None:
        """Origin documents it as always set."""
        payload = _payload()
        del payload["repository"]["defaultBranch"]

        with pytest.raises(OriginPayloadError, match="repository -> defaultBranch"):
            RepositoryMetadataEvent.from_payload(payload)

    def test_unknown_fields_are_ignored(self) -> None:
        """Origin asks receivers to ignore fields they do not know."""
        payload = _payload(cloneUrl="https://git.example.com/acme/rocket.git")
        payload["pushedAt"] = "2026-09-16T12:00:05Z"

        assert RepositoryMetadataEvent.from_payload(payload).repository.full_name == REPO


@cell_silo_test
class RefreshRepositoryNameTest(TestCase):
    """Any event that names the repository repairs a name that drifted."""

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            status=ObjectStatus.ACTIVE,
        )
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name=REPO,
            url=f"{WEB}/{REPO}",
            provider="integrations:cursor_origin",
            integration_id=self.integration.id,
            external_id=REPO_EXTERNAL_ID,
            config={"name": REPO, "default_branch": "main"},
        )
        context = integration_service.organization_contexts(
            provider="cursor_origin", external_id=INSTALLATION_ID
        )
        self.org_integrations = context.organization_integrations

    def _refresh(self, payload: dict[str, Any]) -> None:
        refresh_repository_name(payload, self.org_integrations, DELIVERY_ID)

    def _reloaded(self) -> Repository:
        return Repository.objects.get(id=self.repo.id)

    def _reference(self, owner: str = "acme", name: str = "rocket") -> dict[str, Any]:
        return {"repository": {"id": REPO_EXTERNAL_ID, "name": name, "owner": {"slug": owner}}}

    def test_a_drifted_name_is_repaired(self) -> None:
        self._refresh(self._reference(owner="rocketry", name="booster"))

        repo = self._reloaded()
        assert repo.name == "rocketry/booster"
        assert repo.url == f"{WEB}/rocketry/booster"
        assert repo.config["name"] == "rocketry/booster"
        assert repo.config["default_branch"] == "main"

    def test_a_name_that_agrees_is_left_alone(self) -> None:
        with mock.patch.object(Repository, "update") as update:
            self._refresh(self._reference())

        assert update.call_count == 0

    def test_an_event_that_names_no_repository_is_ignored(self) -> None:
        self._refresh({"installation": {"id": INSTALLATION_ID}})

        assert self._reloaded().name == REPO

    def test_another_repository_is_left_alone(self) -> None:
        payload = self._reference(owner="rocketry")
        payload["repository"]["id"] = "r_02example"

        self._refresh(payload)

        assert self._reloaded().name == REPO


@cell_silo_test
class RepositoryDeletedHandlerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            status=ObjectStatus.ACTIVE,
        )
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name=REPO,
            provider="integrations:cursor_origin",
            integration_id=self.integration.id,
            external_id=REPO_EXTERNAL_ID,
            config={"name": REPO},
        )
        context = integration_service.organization_contexts(
            provider="cursor_origin", external_id=INSTALLATION_ID
        )
        assert context.integration is not None
        self.rpc_integration = context.integration
        self.org_integrations = context.organization_integrations

    def _handle(self, payload: dict[str, Any]) -> None:
        RepositoryDeletedHandler()(
            payload, DELIVERY_ID, self.rpc_integration, self.org_integrations
        )

    def test_a_deleted_repository_is_disabled(self) -> None:
        self._handle({"repository": {"id": REPO_EXTERNAL_ID, "name": "rocket"}})

        assert Repository.objects.get(id=self.repo.id).status == ObjectStatus.DISABLED

    def test_a_recently_active_repository_is_left_active(self) -> None:
        """GitHub skips disabling a repository with activity in the last 30 days."""
        Commit.objects.create(
            organization_id=self.organization.id, repository_id=self.repo.id, key="abc"
        )

        self._handle({"repository": {"id": REPO_EXTERNAL_ID, "name": "rocket"}})

        assert Repository.objects.get(id=self.repo.id).status == ObjectStatus.ACTIVE

    def test_another_repository_is_left_active(self) -> None:
        self._handle({"repository": {"id": "r_01other", "name": "other"}})

        assert Repository.objects.get(id=self.repo.id).status == ObjectStatus.ACTIVE

    def test_a_payload_with_no_repository_id_is_refused(self) -> None:
        with pytest.raises(OriginPayloadError, match="repository -> id"):
            self._handle({"repository": {"name": "rocket"}})

    def test_an_inactive_installation_disables_nothing(self) -> None:
        """After a suspension, a late delivery must not act on the repositories."""
        self.rpc_integration = self.rpc_integration.copy(update={"status": ObjectStatus.DISABLED})

        self._handle({"repository": {"id": REPO_EXTERNAL_ID, "name": "rocket"}})

        assert Repository.objects.get(id=self.repo.id).status == ObjectStatus.ACTIVE

    def test_an_organization_being_uninstalled_is_skipped(self) -> None:
        self.org_integrations = [
            oi.copy(update={"status": ObjectStatus.PENDING_DELETION})
            for oi in self.org_integrations
        ]

        self._handle({"repository": {"id": REPO_EXTERNAL_ID, "name": "rocket"}})

        assert Repository.objects.get(id=self.repo.id).status == ObjectStatus.ACTIVE


@cell_silo_test
class RepositoryCreatedHandlerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            status=ObjectStatus.ACTIVE,
        )
        context = integration_service.organization_contexts(
            provider="cursor_origin", external_id=INSTALLATION_ID
        )
        assert context.integration is not None
        self.rpc_integration = context.integration
        self.org_integrations = context.organization_integrations

    def _handle(self) -> None:
        RepositoryCreatedHandler()(
            _payload(), DELIVERY_ID, self.rpc_integration, self.org_integrations
        )

    def _repositories(self) -> list[Repository]:
        return list(
            Repository.objects.filter(
                organization_id=self.organization.id, external_id=REPO_EXTERNAL_ID
            )
        )

    def test_a_new_repository_is_added(self) -> None:
        self._handle()

        [repo] = self._repositories()
        assert repo.name == REPO
        assert repo.url == f"{WEB}/{REPO}"
        assert repo.integration_id == self.integration.id
        assert repo.config == {"name": REPO, "default_branch": "main"}

    def test_a_repository_left_by_an_earlier_installation_is_reactivated(self) -> None:
        """GitHub audits a reactivated repository as `REPO_ENABLED` rather than added."""
        unlinked = Repository.objects.create(
            organization_id=self.organization.id,
            name=REPO,
            provider="integrations:cursor_origin",
            external_id=REPO_EXTERNAL_ID,
            integration_id=None,
            status=ObjectStatus.DISABLED,
            config={"name": REPO},
        )

        with mock.patch(
            "sentry.integrations.cursor_origin.repository_events.log_repo_change"
        ) as mock_log:
            self._handle()

        repo = Repository.objects.get(id=unlinked.id)
        assert repo.status == ObjectStatus.ACTIVE
        assert repo.integration_id == self.integration.id
        assert [call.kwargs["event_name"] for call in mock_log.call_args_list] == ["REPO_ENABLED"]

    def test_a_redelivery_adds_and_audits_nothing(self) -> None:
        with mock.patch(
            "sentry.integrations.cursor_origin.repository_events.log_repo_change"
        ) as mock_log:
            self._handle()
            self._handle()

        assert len(self._repositories()) == 1
        assert [call.kwargs["event_name"] for call in mock_log.call_args_list] == ["REPO_ADDED"]

    def test_a_repository_the_sync_already_added_is_not_audited(self) -> None:
        Repository.objects.create(
            organization_id=self.organization.id,
            name=REPO,
            provider="integrations:cursor_origin",
            external_id=REPO_EXTERNAL_ID,
            integration_id=self.integration.id,
            config={"name": REPO, "default_branch": "main"},
        )

        with mock.patch(
            "sentry.integrations.cursor_origin.repository_events.log_repo_change"
        ) as mock_log:
            self._handle()

        assert len(self._repositories()) == 1
        assert mock_log.call_count == 0

    def test_an_inactive_installation_adds_nothing(self) -> None:
        self.rpc_integration = self.rpc_integration.copy(update={"status": ObjectStatus.DISABLED})

        self._handle()

        assert self._repositories() == []

    def test_an_organization_being_uninstalled_is_skipped(self) -> None:
        self.org_integrations = [
            oi.copy(update={"status": ObjectStatus.PENDING_DELETION})
            for oi in self.org_integrations
        ]

        self._handle()

        assert self._repositories() == []

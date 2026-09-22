from __future__ import annotations

from typing import Any

import pytest

from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.repository_events import RepositoryMetadataUpdatedHandler
from sentry.integrations.cursor_origin.webhook_types import (
    OriginPayloadError,
    RepositoryMetadataEvent,
)
from sentry.integrations.services.integration import integration_service
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

    def test_a_rename_rewrites_the_name_url_and_config(self) -> None:
        """A code mapping made from the new url fails until the row carries it."""
        self._handle(_payload(name="booster", fullName="acme/booster"))

        repo = self._reloaded()
        assert repo.name == "acme/booster"
        assert repo.url == f"{WEB}/acme/booster"
        assert repo.config["name"] == "acme/booster"

    def test_an_owner_rename_is_followed_too(self) -> None:
        self._handle(_payload(fullName="rocketry/rocket", owner={"slug": "rocketry"}))

        assert self._reloaded().name == "rocketry/rocket"

    def test_a_new_default_branch_is_stored(self) -> None:
        self._handle(_payload(defaultBranch="trunk"))

        assert self._reloaded().config["default_branch"] == "trunk"

    def test_an_unchanged_snapshot_writes_nothing(self) -> None:
        before = self._reloaded().date_added

        self._handle(_payload())

        repo = self._reloaded()
        assert repo.name == REPO
        assert repo.date_added == before

    def test_a_repository_sentry_does_not_have_is_ignored(self) -> None:
        self._handle(_payload(id="r_01nope"))

        assert self._reloaded().name == REPO

    def test_another_organizations_repository_is_left_alone(self) -> None:
        other_org = self.create_organization()
        other_repo = Repository.objects.create(
            organization_id=other_org.id,
            name=REPO,
            provider="integrations:cursor_origin",
            external_id=REPO_EXTERNAL_ID,
            config={"name": REPO},
        )

        self._handle(_payload(name="booster", fullName="acme/booster"))

        assert Repository.objects.get(id=other_repo.id).name == REPO


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

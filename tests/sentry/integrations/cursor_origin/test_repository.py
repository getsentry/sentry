from __future__ import annotations

from typing import Any
from unittest import mock

import pytest

from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.client import CursorOriginApiClient
from sentry.integrations.cursor_origin.repository import CursorOriginRepositoryProvider
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.plugins.base import bindings
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test

INSTALLATION_ID = "i_01example"
REPO = "acme/rocket"
WEB = "https://cursor.com/codebase"

ORIGIN_REPO: dict[str, Any] = {
    "id": "r_01example",
    "name": "rocket",
    "fullName": REPO,
    "owner": {"slug": "acme", "id": "ns_01example"},
    "defaultBranch": "main",
}


@control_silo_test
class CursorOriginRepositoryProviderTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            status=ObjectStatus.ACTIVE,
        )
        self.provider = CursorOriginRepositoryProvider("integrations:cursor_origin")

    def _repository_data(self, identifier: str = REPO) -> dict[str, Any]:
        config: dict[str, Any] = {"installation": self.integration.id, "identifier": identifier}
        with mock.patch.object(CursorOriginApiClient, "get_repo", return_value=ORIGIN_REPO):
            return dict(self.provider.get_repository_data(self.organization, config))

    def test_registered_for_the_repository_picker(self) -> None:
        provider = bindings.get("integration-repository.provider").get("integrations:cursor_origin")

        assert provider is CursorOriginRepositoryProvider

    def test_reads_the_repository_from_origin(self) -> None:
        data = self._repository_data()

        assert data["external_id"] == "r_01example"
        assert data["name"] == REPO
        assert data["default_branch"] == "main"

    def test_carries_the_integration_id_to_the_config(self) -> None:
        """build_repository_config reads this, so leaving it out fails after the API calls."""
        assert self._repository_data()["integration_id"] == self.integration.id

    def test_the_config_is_built_from_what_the_picker_produced(self) -> None:
        config = self.provider.build_repository_config(self.organization, self._repository_data())

        assert config == {
            "name": REPO,
            "external_id": "r_01example",
            "url": f"{WEB}/{REPO}",
            "config": {"name": REPO, "default_branch": "main"},
            "integration_id": self.integration.id,
        }

    def test_an_unreadable_repository_is_an_integration_error(self) -> None:
        config = {"installation": self.integration.id, "identifier": "acme/nope"}
        with mock.patch.object(
            CursorOriginApiClient, "get_repo", side_effect=ApiError("nope", code=404)
        ):
            with pytest.raises(IntegrationError):
                self.provider.get_repository_data(self.organization, config)

    def test_the_external_slug_is_the_full_name(self) -> None:
        assert self.provider.repository_external_slug(Repository(name=REPO)) == REPO

    def test_pull_request_url(self) -> None:
        url = self.provider.pull_request_url(Repository(name=REPO), PullRequest(key="7"))

        assert url == f"{WEB}/{REPO}/pull/7"

    def test_commit_tracking_is_not_implemented_yet(self) -> None:
        with pytest.raises(NotImplementedError):
            self.provider.compare_commits(Repository(name=REPO), "abc", "def")

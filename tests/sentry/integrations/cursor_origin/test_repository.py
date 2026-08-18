from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

from sentry.integrations.cursor_origin.repository import CursorOriginRepositoryProvider
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.testutils.cases import TestCase

REPO_PAYLOAD: dict[str, Any] = {
    "id": "r_01example000000000000repo",
    "name": "nuget-trends",
    "fullName": "sentry/nuget-trends",
    "owner": {"slug": "sentry", "id": "ns_01example00000000000000ns"},
    "defaultBranch": "main",
    "cloneUrl": "https://origin.cursor.com/sentry/nuget-trends.git",
}


class CursorOriginRepositoryProviderTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="sentry",
            external_id="i_01example00000000000inst",
        )
        self.provider = CursorOriginRepositoryProvider("integrations:cursor_origin")

    def _get_repository_data(self) -> dict[str, Any]:
        config: dict[str, Any] = {
            "installation": self.integration.id,
            "identifier": "sentry/nuget-trends",
        }
        with patch(
            "sentry.integrations.cursor_origin.client.CursorOriginSetupApiClient.get_repo",
            return_value=REPO_PAYLOAD,
        ):
            return dict(self.provider.get_repository_data(self.organization, config))

    def test_get_repository_data_maps_origin_fields(self) -> None:
        data = self._get_repository_data()
        assert data["external_id"] == "r_01example000000000000repo"
        assert data["name"] == "sentry/nuget-trends"
        assert data["default_branch"] == "main"

    def test_get_repository_data_sets_integration_id(self) -> None:
        # build_repository_config reads this key. Omitting it made repository
        # creation 500 with a bare KeyError *after* both Origin calls had
        # already succeeded, which read like an API failure rather than a
        # missing field.
        assert self._get_repository_data()["integration_id"] == self.integration.id

    def test_build_repository_config_consumes_what_get_repository_data_produces(self) -> None:
        # The pairing is the point: these two ran fine in isolation while the
        # handoff between them was broken.
        data = self._get_repository_data()
        config = self.provider.build_repository_config(self.organization, data)
        assert config["name"] == "sentry/nuget-trends"
        assert config["external_id"] == "r_01example000000000000repo"
        assert config["url"] == "https://cursor.com/codebase/sentry/nuget-trends"
        assert config["integration_id"] == self.integration.id
        assert config["config"]["default_branch"] == "main"

    def test_unreadable_repo_raises_integration_error(self) -> None:
        config = {"installation": self.integration.id, "identifier": "sentry/nope"}
        with patch(
            "sentry.integrations.cursor_origin.client.CursorOriginSetupApiClient.get_repo",
            side_effect=ApiError("not found"),
        ):
            with pytest.raises(IntegrationError):
                self.provider.get_repository_data(self.organization, config)

from __future__ import annotations

import orjson
import pytest
import responses

from sentry.auth.exceptions import IdentityNotValid
from sentry.identity.datadog.provider import DatadogIdentityProvider
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test

MCP_URL = "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp"


@control_silo_test
class DatadogIdentityProviderTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = DatadogIdentityProvider()

    def _mock_whoami(self, whoami: dict) -> None:
        responses.add(
            responses.POST,
            MCP_URL,
            json={"jsonrpc": "2.0", "id": 1, "result": {}},
            headers={"mcp-session-id": "session-id"},
        )
        responses.add(
            responses.POST,
            MCP_URL,
            json={"result": {"contents": [{"text": orjson.dumps(whoami).decode()}]}},
        )

    def test_no_pipeline_views(self) -> None:
        assert self.provider.get_pipeline_views() == []

    @responses.activate
    def test_build_identity_success(self) -> None:
        self._mock_whoami(
            {
                "user_uuid": "dd-user-123",
                "org_uuid": "dd-org-456",
                "user_email": "user@example.com",
                "user_name": "Test User",
            }
        )

        result = self.provider.build_identity({"access_token": "pat-abc", "site": "datadoghq.com"})

        assert result["type"] == "datadog"
        assert result["id"] == "dd-user-123"
        assert result["idp_external_id"] == "dd-org-456"
        assert result["idp_config"] == {"site": "datadoghq.com"}
        assert result["email"] == "user@example.com"
        assert result["name"] == "Test User"
        assert result["scopes"] == []
        assert result["data"] == {"access_token": "pat-abc", "site": "datadoghq.com"}
        # whoami hits https://mcp.<site>/... with the submitted token as Bearer.
        assert responses.calls[0].request.url == MCP_URL
        assert responses.calls[0].request.headers["Authorization"] == "Bearer pat-abc"

    def test_build_identity_missing_access_token(self) -> None:
        with pytest.raises(ValueError, match="Missing access token"):
            self.provider.build_identity({"site": "datadoghq.com"})

    def test_build_identity_missing_site(self) -> None:
        with pytest.raises(ValueError, match="Missing site"):
            self.provider.build_identity({"access_token": "pat-abc"})

    def test_build_identity_invalid_site(self) -> None:
        with pytest.raises(ValueError, match="Invalid site"):
            self.provider.build_identity({"access_token": "pat-abc", "site": "evil.example.com"})

    @responses.activate
    def test_build_identity_optional_user_attributes(self) -> None:
        self._mock_whoami({"user_uuid": "dd-user-123", "org_uuid": "dd-org-456"})

        result = self.provider.build_identity({"access_token": "pat-abc", "site": "datadoghq.com"})

        assert result["id"] == "dd-user-123"
        assert result["idp_external_id"] == "dd-org-456"
        assert result["email"] is None
        assert result["name"] is None

    @responses.activate
    def test_build_identity_missing_user_uuid(self) -> None:
        self._mock_whoami({"org_uuid": "dd-org-456"})

        with pytest.raises(IdentityNotValid, match="missing required fields"):
            self.provider.build_identity({"access_token": "pat-abc", "site": "datadoghq.com"})

    @responses.activate
    def test_build_identity_missing_org_uuid(self) -> None:
        self._mock_whoami({"user_uuid": "dd-user-123"})

        with pytest.raises(IdentityNotValid, match="missing required fields"):
            self.provider.build_identity({"access_token": "pat-abc", "site": "datadoghq.com"})

    @responses.activate
    def test_build_identity_malformed_whoami(self) -> None:
        responses.add(
            responses.POST,
            MCP_URL,
            json={"jsonrpc": "2.0", "id": 1, "result": {}},
            headers={"mcp-session-id": "session-id"},
        )
        responses.add(responses.POST, MCP_URL, body="not json", status=200)

        with pytest.raises(IdentityNotValid, match="unexpected response"):
            self.provider.build_identity({"access_token": "pat-abc", "site": "datadoghq.com"})

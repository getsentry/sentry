from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest import mock

import pytest
import responses
from requests import PreparedRequest, Request

from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.client import (
    CursorOriginApiClient,
    CursorOriginSetupApiClient,
)
from sentry.integrations.cursor_origin.constants import CURSOR_ORIGIN_API_BASE_URL
from sentry.shared_integrations.exceptions import ApiError, ApiPaginationTruncated
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test

INSTALLATION_ID = "i_01example"
JWT = "my_cool_jwt"
TOKEN_URL = f"{CURSOR_ORIGIN_API_BASE_URL}/app/installations/{INSTALLATION_ID}/access_tokens"


def _prepared(path: str) -> PreparedRequest:
    return Request("GET", f"https://api.cursor.com{path}").prepare()


def _iso(offset: timedelta) -> str:
    return (datetime.now(UTC) + offset).isoformat().replace("+00:00", "Z")


@control_silo_test
@mock.patch("sentry.integrations.cursor_origin.client.get_jwt", return_value=JWT)
class SetupApiClientTest(TestCase):
    def test_authorizes_with_an_app_jwt(self, mock_jwt: mock.MagicMock) -> None:
        request = CursorOriginSetupApiClient().authorize_request(_prepared("/v1/origin/app"))

        assert request.headers["Authorization"] == f"Bearer {JWT}"
        assert request.headers["Accept"] == "application/json"

    def test_mints_a_fresh_jwt_per_request(self, mock_jwt: mock.MagicMock) -> None:
        """Origin caps app JWTs at ~5 minutes, so one per client would go stale."""
        client = CursorOriginSetupApiClient()

        client.authorize_request(_prepared("/v1/origin/app"))
        client.authorize_request(_prepared("/v1/origin/app"))

        assert mock_jwt.call_count == 2

    @responses.activate
    def test_get_installation(self, mock_jwt: mock.MagicMock) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/app/installations/{INSTALLATION_ID}",
            json={"target": {"slug": "acme"}},
        )

        result = CursorOriginSetupApiClient().get_installation(INSTALLATION_ID)

        assert result == {"target": {"slug": "acme"}}


@control_silo_test
@mock.patch("sentry.integrations.cursor_origin.client.get_jwt", return_value=JWT)
class AccessTokenTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            metadata={},
            status=ObjectStatus.ACTIVE,
        )

    def _mint(self, token: str = "oit_abc", expires_in: timedelta = timedelta(minutes=15)) -> None:
        responses.add(
            responses.POST, TOKEN_URL, json={"token": token, "expiresAt": _iso(expires_in)}
        )

    @responses.activate
    def test_mints_and_persists_the_token(self, mock_jwt: mock.MagicMock) -> None:
        self._mint()

        data = CursorOriginApiClient(integration=self.integration).get_access_token()

        assert data is not None
        assert data["access_token"] == "oit_abc"
        self.integration.refresh_from_db()
        assert self.integration.metadata["access_token"] == "oit_abc"
        assert self.integration.metadata["expires_at"] == data["expires_at"]

    @responses.activate
    def test_reuses_a_valid_stored_token(self, mock_jwt: mock.MagicMock) -> None:
        self.integration.update(
            metadata={"access_token": "oit_stored", "expires_at": _iso(timedelta(minutes=14))}
        )

        data = CursorOriginApiClient(integration=self.integration).get_access_token()

        assert data is not None
        assert data["access_token"] == "oit_stored"
        assert len(responses.calls) == 0

    @responses.activate
    def test_refreshes_a_token_close_to_expiry(self, mock_jwt: mock.MagicMock) -> None:
        """Origin's tokens last under 15 minutes, so the refresh margin matters."""
        self.integration.update(
            metadata={"access_token": "oit_stale", "expires_at": _iso(timedelta(seconds=60))}
        )
        self._mint(token="oit_fresh")

        data = CursorOriginApiClient(integration=self.integration).get_access_token()

        assert data is not None
        assert data["access_token"] == "oit_fresh"

    @responses.activate
    def test_refreshes_an_unparseable_expiry(self, mock_jwt: mock.MagicMock) -> None:
        self.integration.update(
            metadata={"access_token": "oit_stored", "expires_at": "not-a-timestamp"}
        )
        self._mint(token="oit_fresh")

        data = CursorOriginApiClient(integration=self.integration).get_access_token()

        assert data is not None
        assert data["access_token"] == "oit_fresh"

    @responses.activate
    def test_mints_with_the_app_jwt(self, mock_jwt: mock.MagicMock) -> None:
        """The mint endpoint is an /app route, so it cannot use the token it produces."""
        self.integration.update(
            metadata={"access_token": "oit_stale", "expires_at": _iso(timedelta(seconds=60))}
        )
        self._mint(token="oit_fresh")

        CursorOriginApiClient(integration=self.integration).get_access_token()

        assert responses.calls[0].request.headers["Authorization"] == f"Bearer {JWT}"

    @responses.activate
    def test_rejects_an_unparseable_expiry(self, mock_jwt: mock.MagicMock) -> None:
        """Storing it would refresh on every later request, quietly and forever."""
        responses.add(
            responses.POST,
            TOKEN_URL,
            json={"token": "oit_abc", "expiresAt": "Fri, 01 Aug 2026 10:30:00 GMT"},
        )

        with pytest.raises(ApiError):
            CursorOriginApiClient(integration=self.integration).get_access_token()


@control_silo_test
class AuthorizeRequestTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            metadata={"access_token": "oit_stored", "expires_at": _iso(timedelta(minutes=14))},
            status=ObjectStatus.ACTIVE,
        )
        self.origin_client = CursorOriginApiClient(integration=self.integration)

    @mock.patch("sentry.integrations.cursor_origin.client.get_jwt", return_value=JWT)
    def test_app_routes_use_the_app_jwt(self, mock_jwt: mock.MagicMock) -> None:
        request = self.origin_client.authorize_request(
            _prepared(f"/v1/origin/app/installations/{INSTALLATION_ID}/access_tokens")
        )

        assert request.headers["Authorization"] == f"Bearer {JWT}"

    def test_repository_routes_use_the_installation_token(self) -> None:
        request = self.origin_client.authorize_request(_prepared("/v1/origin/repos/acme/rocket"))

        assert request.headers["Authorization"] == "Bearer oit_stored"

    def test_installation_repos_uses_the_installation_token(self) -> None:
        request = self.origin_client.authorize_request(_prepared("/v1/origin/installation/repos"))

        assert request.headers["Authorization"] == "Bearer oit_stored"

    def test_query_string_does_not_confuse_route_matching(self) -> None:
        request = self.origin_client.authorize_request(
            _prepared("/v1/origin/repos/acme/rocket/contents?path=app")
        )

        assert request.headers["Authorization"] == "Bearer oit_stored"


@control_silo_test
class PaginateTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            metadata={"access_token": "oit_stored", "expires_at": _iso(timedelta(minutes=14))},
            status=ObjectStatus.ACTIVE,
        )
        self.origin_client = CursorOriginApiClient(integration=self.integration)

    def test_follows_page_tokens(self) -> None:
        pages = [
            {"repositories": [{"id": "1"}], "nextPageToken": "cursor-2"},
            {"repositories": [{"id": "2"}], "nextPageToken": ""},
        ]
        with mock.patch.object(self.origin_client, "get", side_effect=pages) as mock_get:
            result = self.origin_client._paginate("/installation/repos", "repositories")

        assert result == [{"id": "1"}, {"id": "2"}]
        assert mock_get.call_args_list[0].kwargs["params"] == {"pageSize": 100}
        assert mock_get.call_args_list[1].kwargs["params"] == {
            "pageSize": 100,
            "pageToken": "cursor-2",
        }

    def test_stops_on_a_single_page(self) -> None:
        with mock.patch.object(
            self.origin_client,
            "get",
            return_value={"repositories": [{"id": "1"}], "nextPageToken": ""},
        ) as mock_get:
            result = self.origin_client._paginate("/installation/repos", "repositories")

        assert result == [{"id": "1"}]
        assert mock_get.call_count == 1

    def test_raises_when_the_page_limit_is_hit(self) -> None:
        """A short list reads as removed repositories to the sync, so never truncate silently."""
        endless = {"repositories": [{"id": "1"}], "nextPageToken": "always-more"}
        with mock.patch.object(self.origin_client, "get", return_value=endless) as mock_get:
            with pytest.raises(ApiPaginationTruncated) as excinfo:
                self.origin_client._paginate("/installation/repos", "repositories")

        assert mock_get.call_count == self.origin_client.page_number_limit
        assert len(excinfo.value.partial_data) == self.origin_client.page_number_limit

from unittest import mock
from unittest.mock import MagicMock

import pytest
import responses

from sentry.auth.providers.fly.client import FlyClient
from sentry.auth.providers.fly.constants import ACCESS_TOKEN_URL


@pytest.fixture
def client() -> FlyClient:
    return FlyClient("accessToken")


@responses.activate
def test_request_sends_access_token(client: FlyClient) -> None:
    responses.add(responses.GET, f"{ACCESS_TOKEN_URL}/", json={"status": "SUCCESS"}, status=200)
    client._request("/")

    assert len(responses.calls) == 1
    assert responses.calls[0].request.headers["Authorization"] == "Bearer accessToken"


@mock.patch.object(FlyClient, "_request")
def test_get_info(mock_request: MagicMock, client: FlyClient) -> None:
    client.get_info()
    mock_request.assert_called_once_with("/info")

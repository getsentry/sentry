from unittest import mock

import pytest
import responses

from sentry.auth.providers.fly.client import FlyClient
from sentry.auth.providers.fly.constants import ACCESS_TOKEN_URL


@pytest.fixture
def client():
    return FlyClient("accessToken")


@responses.activate
def test_request_sends_access_token(client):
    responses.add(responses.GET, f"{ACCESS_TOKEN_URL}/", json={"status": "SUCCESS"}, status=200)
    client._request("/")

    assert len(responses.calls) == 1
    assert responses.calls[0].request.headers["Authorization"] == "Bearer accessToken"


@mock.patch.object(FlyClient, "_request")
def test_get_info(mock_request, client):
    client.get_info()
    mock_request.assert_called_once_with("/info")

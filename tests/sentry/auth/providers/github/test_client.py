from unittest import mock

import pytest
import responses

from sentry.auth.providers.github.client import GitHubClient
from sentry.auth.providers.github.constants import API_DOMAIN


@pytest.fixture
def client():
    return GitHubClient("accessToken")


@responses.activate
def test_request_sends_access_token(client) -> None:
    responses.add(responses.GET, f"https://{API_DOMAIN}/", json={"status": "SUCCESS"}, status=200)
    client._request("/")

    assert len(responses.calls) == 1
    assert responses.calls[0].request.headers["Authorization"] == "token accessToken"


@responses.activate
def test_get_org_list_single_page(client) -> None:
    orgs = [{"id": i, "login": f"org{i}"} for i in range(5)]
    responses.add(
        responses.GET,
        f"https://{API_DOMAIN}/user/orgs",
        json=orgs,
        status=200,
    )
    result = client.get_org_list()
    assert result == orgs
    assert len(responses.calls) == 1
    assert responses.calls[0].request.params["per_page"] == "100"
    assert responses.calls[0].request.params["page"] == "1"


@responses.activate
def test_get_org_list_multiple_pages(client) -> None:
    page1 = [{"id": i, "login": f"org{i}"} for i in range(100)]
    page2 = [{"id": i + 100, "login": f"org{i + 100}"} for i in range(3)]
    responses.add(
        responses.GET,
        f"https://{API_DOMAIN}/user/orgs",
        json=page1,
        status=200,
    )
    responses.add(
        responses.GET,
        f"https://{API_DOMAIN}/user/orgs",
        json=page2,
        status=200,
    )
    result = client.get_org_list()
    assert result == page1 + page2
    assert len(responses.calls) == 2


@responses.activate
def test_get_org_list_empty(client) -> None:
    responses.add(
        responses.GET,
        f"https://{API_DOMAIN}/user/orgs",
        json=[],
        status=200,
    )
    result = client.get_org_list()
    assert result == []


@mock.patch.object(GitHubClient, "_request")
def test_get_user(mock_request, client) -> None:
    client.get_user()
    mock_request.assert_called_once_with("/user")


@mock.patch.object(GitHubClient, "_request")
def test_get_user_emails(mock_request, client) -> None:
    client.get_user_emails()
    mock_request.assert_called_once_with("/user/emails")


@mock.patch.object(GitHubClient, "_request", return_value=[{"id": 1396951}])
def test_is_org_member(mock_request, client) -> None:
    got = client.is_org_member(1396951)
    assert got is True

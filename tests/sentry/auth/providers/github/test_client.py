import pytest
import responses

from sentry.auth.providers.github.client import GitHubApiError, GitHubClient
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
    """get_org_list returns all orgs from a single page."""
    responses.add(
        responses.GET,
        f"https://{API_DOMAIN}/user/orgs?per_page=100",
        json=[{"id": 1, "login": "org-a"}, {"id": 2, "login": "org-b"}],
        status=200,
    )
    orgs = client.get_org_list()

    assert len(orgs) == 2
    assert orgs[0]["login"] == "org-a"
    assert orgs[1]["login"] == "org-b"


@responses.activate
def test_get_org_list_paginates(client) -> None:
    """RTC-1298: get_org_list follows Link headers to fetch all pages."""
    page2_url = f"https://{API_DOMAIN}/user/orgs?per_page=100&page=2"
    responses.add(
        responses.GET,
        f"https://{API_DOMAIN}/user/orgs?per_page=100",
        json=[{"id": 1, "login": "org-a"}],
        status=200,
        headers={"Link": f'<{page2_url}>; rel="next"'},
    )
    responses.add(
        responses.GET,
        page2_url,
        json=[{"id": 2, "login": "org-b"}],
        status=200,
    )

    orgs = client.get_org_list()

    assert len(responses.calls) == 2
    assert len(orgs) == 2
    assert orgs[0]["login"] == "org-a"
    assert orgs[1]["login"] == "org-b"


@responses.activate
def test_get_org_list_empty(client) -> None:
    """get_org_list returns empty list when user has no orgs."""
    responses.add(
        responses.GET,
        f"https://{API_DOMAIN}/user/orgs?per_page=100",
        json=[],
        status=200,
    )
    orgs = client.get_org_list()
    assert orgs == []


@responses.activate
def test_get_org_list_api_error(client) -> None:
    """get_org_list raises GitHubApiError on HTTP errors."""
    responses.add(
        responses.GET,
        f"https://{API_DOMAIN}/user/orgs?per_page=100",
        json={"message": "Bad credentials"},
        status=401,
    )
    with pytest.raises(GitHubApiError):
        client.get_org_list()


@responses.activate
def test_get_user(client) -> None:
    responses.add(
        responses.GET,
        f"https://{API_DOMAIN}/user",
        json={"id": 1, "login": "testuser"},
        status=200,
    )
    user = client.get_user()
    assert user["login"] == "testuser"


@responses.activate
def test_get_user_emails(client) -> None:
    responses.add(
        responses.GET,
        f"https://{API_DOMAIN}/user/emails",
        json=[{"email": "test@example.com", "primary": True, "verified": True}],
        status=200,
    )
    emails = client.get_user_emails()
    assert len(emails) == 1
    assert emails[0]["email"] == "test@example.com"


@responses.activate
def test_is_org_member(client) -> None:
    responses.add(
        responses.GET,
        f"https://{API_DOMAIN}/user/orgs?per_page=100",
        json=[{"id": 1396951, "login": "test-org"}],
        status=200,
    )
    got = client.is_org_member(1396951)
    assert got is True


@responses.activate
def test_is_not_org_member(client) -> None:
    responses.add(
        responses.GET,
        f"https://{API_DOMAIN}/user/orgs?per_page=100",
        json=[{"id": 999, "login": "other-org"}],
        status=200,
    )
    got = client.is_org_member(1396951)
    assert got is False

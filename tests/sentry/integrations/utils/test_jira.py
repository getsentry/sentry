import pytest

from sentry.integrations.utils.jira import parse_jira_issue_key

CLOUD = "https://example.atlassian.net"
SERVER = "https://jira.example.com"


@pytest.mark.parametrize(
    "query,base_url,expected",
    [
        # bare keys, the pre-existing behavior
        ("ABC-123", CLOUD, "ABC-123"),
        ("abc-123", CLOUD, "abc-123"),
        ("A1B2-9", CLOUD, "A1B2-9"),
        ("  ABC-123  ", CLOUD, "ABC-123"),
        # the links Jira's copy-link shortcuts produce
        (f"{CLOUD}/browse/ABC-123", CLOUD, "ABC-123"),
        (f"{CLOUD}/browse/ABC-123?filter=456", CLOUD, "ABC-123"),
        (f"{CLOUD}/browse/ABC-123#comment-1", CLOUD, "ABC-123"),
        (f"{CLOUD}/browse/ABC-123/", CLOUD, "ABC-123"),
        (f"{SERVER}/projects/ABC/issues/ABC-123", SERVER, "ABC-123"),
        (f"{CLOUD}/jira/software/projects/ABC/boards/1?selectedIssue=ABC-123", CLOUD, "ABC-123"),
        (
            f"{CLOUD}/jira/software/c/projects/ABC/boards/1/backlog?selectedIssue=ABC-123",
            CLOUD,
            "ABC-123",
        ),
        # host comparison is case-insensitive, and base_url may carry a path
        ("https://EXAMPLE.atlassian.net/browse/ABC-123", CLOUD, "ABC-123"),
        (f"{CLOUD}/browse/ABC-123", f"{CLOUD}/", "ABC-123"),
        # not issue keys - these must stay full-text searches
        ("", CLOUD, None),
        ("some free text", CLOUD, None),
        ("fix ABC-123 regression", CLOUD, None),
        ("ABC-123-456", CLOUD, None),
        ("123-ABC", CLOUD, None),
        ("-123", CLOUD, None),
        (f"{CLOUD}/browse/", CLOUD, None),
        (f"{CLOUD}/jira/software/projects/ABC/boards/1", CLOUD, None),
        # a key-shaped path segment in a URL that is not a Jira issue link
        (f"{CLOUD}/docs/ABC-123/archive", CLOUD, None),
        ("https://example.com/docs/ABC-123/archive", CLOUD, None),
        # another tenant's Jira: the same key names a different issue there
        ("https://other-tenant.atlassian.net/browse/ABC-123", CLOUD, None),
        (f"{CLOUD}/browse/ABC-123", SERVER, None),
        # only http(s) URLs are unwrapped
        ("ftp://example.atlassian.net/browse/ABC-123", CLOUD, None),
        ("javascript:alert(1)//browse/ABC-123", CLOUD, None),
        ("/browse/ABC-123", CLOUD, None),
        # a different install behind the same hostname
        ("https://jira.example.com:8443/browse/ABC-123", SERVER, None),
        ("https://jira.example.com/browse/ABC-123", "https://jira.example.com:8443", None),
        ("http://jira.example.com/browse/ABC-123", SERVER, None),
        # ...but an explicit default port is the same origin
        ("https://jira.example.com:443/browse/ABC-123", SERVER, "ABC-123"),
        (f"{CLOUD}/browse/ABC-123", "https://example.atlassian.net:443", "ABC-123"),
        # context paths, as Jira Server is commonly mounted under one
        ("https://jira.example.com/jira/browse/ABC-123", f"{SERVER}/jira", "ABC-123"),
        (
            "https://jira.example.com/jira/projects/ABC/issues/ABC-123",
            f"{SERVER}/jira",
            "ABC-123",
        ),
        ("https://jira.example.com/browse/ABC-123", f"{SERVER}/jira", None),
        ("https://jira.example.com/jira-archive/browse/ABC-123", f"{SERVER}/jira", None),
        ("https://jira.example.com/jira/browse/ABC-123", f"{SERVER}/other", None),
        # a port we cannot read is not an origin we can match
        ("https://jira.example.com:port/browse/ABC-123", SERVER, None),
        # malformed URLs must not raise out of a search request
        ("http://[", CLOUD, None),
        ("http://[::1/browse/ABC-123", CLOUD, None),
        ("https://", CLOUD, None),
    ],
)
def test_parse_jira_issue_key(query: str, base_url: str, expected: str | None) -> None:
    assert parse_jira_issue_key(query, base_url) == expected


def test_unparseable_base_url_does_not_raise() -> None:
    """A base_url we cannot read means we cannot vouch for the host, so don't unwrap."""
    assert parse_jira_issue_key(f"{CLOUD}/browse/ABC-123", "http://[") is None
    # a bare key still resolves, since it needs no host to validate against
    assert parse_jira_issue_key("ABC-123", "http://[") == "ABC-123"

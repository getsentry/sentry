from __future__ import annotations

import re
from urllib.parse import ParseResult, parse_qs, urlparse

ISSUE_KEY_RE = re.compile(r"^[A-Za-z][A-Za-z0-9]*-\d+$")

# The segment preceding the issue key in the link shapes Jira itself produces:
#   /browse/ABC-123
#   /projects/ABC/issues/ABC-123
_ISSUE_PATH_PARENTS = frozenset({"browse", "issues"})


_DEFAULT_PORTS = {"http": 80, "https": 443}


def _origin(url: ParseResult) -> tuple[str, str, int] | None:
    """Scheme, host and port, with the port defaulted so ``:443`` == implicit."""
    if url.scheme not in _DEFAULT_PORTS or not url.hostname:
        return None
    try:
        port = url.port
    except ValueError:  # a non-numeric port
        return None
    return (url.scheme, url.hostname.lower(), port or _DEFAULT_PORTS[url.scheme])


def _path_segments(path: str) -> list[str]:
    return [segment for segment in path.split("/") if segment]


def parse_jira_issue_key(query: str, base_url: str) -> str | None:
    """
    Resolve ``query`` to a Jira issue key, or None if it does not name one.

    Accepts a bare key (``ABC-123``) and the links Jira's own "copy link"
    shortcuts produce, so pasting one resolves to the issue instead of falling
    through to a full-text search that can never match it:

    - ``https://example.atlassian.net/browse/ABC-123``
    - ``https://example.atlassian.net/jira/software/projects/ABC/boards/1?selectedIssue=ABC-123``
    - ``https://jira.example.com/projects/ABC/issues/ABC-123``

    A URL is unwrapped only when its origin and context path match ``base_url``
    *and* it matches one of those shapes. Everything else returns None and stays a full-text
    search, which matters in both directions: an arbitrary link that happens to
    contain a key-shaped path segment is not an issue reference, and the same key
    names a different issue in someone else's Jira.
    """
    query = query.strip()

    if ISSUE_KEY_RE.match(query):
        return query

    try:
        url = urlparse(query)
        base = urlparse(base_url)
    except ValueError:
        # e.g. an unterminated IPv6 literal. Not something we can read as a URL,
        # so leave it alone rather than raising out of a search request.
        return None

    origin = _origin(url)
    if origin is None or origin != _origin(base):
        return None

    # Jira Server can be mounted under a context path, so the link has to sit
    # beneath the configured one. Compared segment-wise so /jira does not match
    # a sibling install at /jira-archive.
    base_segments = _path_segments(base.path)
    segments = _path_segments(url.path)
    if segments[: len(base_segments)] != base_segments:
        return None
    segments = segments[len(base_segments) :]

    # Board and backlog links carry the issue in a query param rather than the path.
    for selected in parse_qs(url.query).get("selectedIssue", []):
        if ISSUE_KEY_RE.match(selected):
            return selected

    if (
        len(segments) >= 2
        and segments[-2] in _ISSUE_PATH_PARENTS
        and ISSUE_KEY_RE.match(segments[-1])
    ):
        return segments[-1]

    return None

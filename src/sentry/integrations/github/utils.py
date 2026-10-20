from __future__ import annotations

import calendar
import datetime
import time
from urllib.parse import parse_qs, urlparse

from rest_framework.response import Response

from sentry import options
from sentry.utils import jwt

# Copilot acts as a bot but has no ``[bot]`` suffix or ``Bot`` user type.
GITHUB_COPILOT_LOGIN = "Copilot"


def is_github_bot_login(login: str | None) -> bool:
    """Whether a GitHub login belongs to a bot, inferred from the login alone.

    Use this when the webhook ``user.type`` field is unavailable or unreliable:
    it is only ``"Bot"`` for GitHub App identities, so Copilot and user-typed
    automation slip through.
    """
    if not login:
        return False
    return login.endswith("[bot]") or login == GITHUB_COPILOT_LOGIN


def get_jwt(github_id: str | None = None, github_private_key: str | None = None) -> str:
    if github_id is None:
        github_id = str(options.get("github-app.id"))
    if github_private_key is None:
        github_private_key = options.get("github-app.private-key")
    exp_ = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
    exp = calendar.timegm(exp_.timetuple())
    # Generate the JWT
    payload = {
        # issued at time
        "iat": int(time.time()),
        # JWT expiration time (10 minute maximum)
        "exp": exp,
        # Integration's GitHub identifier
        "iss": github_id,
    }
    return jwt.encode(payload, github_private_key, algorithm="RS256")


def get_next_link(response: Response) -> str | None:
    """Github uses a `link` header to inform pagination.
    The relation parameter can be prev, next, first or last

    Read more here:
    https://docs.github.com/en/rest/guides/using-pagination-in-the-rest-api?apiVersion=2022-11-28#using-link-headers
    """
    link_option: str | None = response.headers.get("link")
    if link_option is None:
        return None

    # Should be a comma separated string of links
    links = link_option.split(",")

    for link in links:
        # If there is a 'next' link return the URL between the angle brackets, or None
        if 'rel="next"' in link:
            start = link.find("<") + 1
            end = link.find(">")
            return link[start:end]

    return None


def get_last_page_number(response: Response) -> int | None:
    """Return the page number advertised by Github's `rel="last"` link.

    For offset-paginated endpoints Github includes a `rel="last"` relation in
    the `link` header, so the total number of pages is known from the first
    response. This lets us fetch the remaining pages in parallel instead of
    walking the `next` links one round-trip at a time.

    Returns None when the header is absent (a single page) or does not
    advertise a last page (for example, cursor-based pagination), in which
    case the caller should fall back to following the `next` links serially.
    """
    link_option: str | None = response.headers.get("link")
    if link_option is None:
        return None

    for link in link_option.split(","):
        if 'rel="last"' in link:
            start = link.find("<") + 1
            end = link.find(">")
            page = parse_qs(urlparse(link[start:end]).query).get("page")
            if page:
                try:
                    return int(page[0])
                except ValueError:
                    return None

    return None


def parse_github_blob_url(repo_url: str, source_url: str) -> tuple[str, str]:
    """
    Parse a GitHub blob URL relative to a repository URL and return
    a tuple of (branch, source_path).

    Handles minor differences (for example, trailing slashes) by
    normalizing paths and stripping the repo path prefix before
    splitting on '/blob/'. If parsing fails, returns ("", "").
    """
    repo_path = urlparse(repo_url).path.rstrip("/")
    parsed = urlparse(source_url)
    path = parsed.path
    if repo_path and path.startswith(repo_path):
        path = path[len(repo_path) :]

    _, _, after_blob = path.partition("/blob/")
    if not after_blob:
        return "", ""

    branch, _, remainder = after_blob.partition("/")
    return branch, remainder.lstrip("/")


def is_github_rate_limit_sensitive(organization_slug: str) -> bool:
    """Check if an organization is in the list of GitHub rate-limit sensitive organizations."""
    return organization_slug in options.get("github-app.rate-limit-sensitive-orgs")

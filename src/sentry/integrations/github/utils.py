from __future__ import annotations
from typing import int

import calendar
import datetime
import logging
import time
from urllib.parse import urlparse

from rest_framework.response import Response

from sentry import options
from sentry.utils import jwt

logger = logging.getLogger(__name__)


def get_jwt(github_id: str | None = None, github_private_key: str | None = None) -> str:
    if github_id is None:
        github_id = options.get("github-app.id")
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

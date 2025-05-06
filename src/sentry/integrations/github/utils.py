from __future__ import annotations

import calendar
import datetime
import logging
import time
from typing import Any

from rest_framework.response import Response

from sentry import http, options
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


def get_user_info(access_token):
    with http.build_session() as session:
        resp = session.get(
            "https://api.github.com/user",
            headers={
                "Accept": "application/vnd.github.machine-man-preview+json",
                "Authorization": f"token {access_token}",
            },
        )
        resp.raise_for_status()
    return resp.json()


# For use prior to making the Integration object
def get_pre_integration_installation_info(installation_id: str) -> dict[str, Any]:
    """
    https://docs.github.com/en/rest/apps/apps?apiVersion=2022-11-28#get-an-installation-for-the-authenticated-app
    """
    from sentry.integrations.github.utils import get_jwt

    token = get_jwt()

    with http.build_session() as session:
        resp = session.get(
            f"https://api.github.com/app/installations/{installation_id}",
            headers={
                "Accept": "application/vnd.github.machine-man-preview+json",
                "Authorization": f"Bearer {token}",
            },
        )
        resp.raise_for_status()
    return resp.json()

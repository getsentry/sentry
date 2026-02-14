from __future__ import annotations

import re
from types import TracebackType
from typing import Any

import orjson
from requests.exceptions import RequestException

from sentry import http

from .constants import API_DOMAIN

MAX_PAGES = 10


class GitHubApiError(Exception):
    def __init__(self, message: str | bytes = "", status: int = 0) -> None:
        super().__init__(message)
        self.status = status


class GitHubClient:
    def __init__(self, access_token: str) -> None:
        self.http = http.build_session()
        self.access_token = access_token

    def __enter__(self) -> GitHubClient:
        return self

    def __exit__(
        self, exc_type: type | None, exc_value: Exception | None, traceback: TracebackType | None
    ) -> None:
        self.http.close()

    def _request(self, path: str) -> dict[str, Any] | list[dict[str, Any]]:
        headers = {"Authorization": f"token {self.access_token}"}

        try:
            req = self.http.get(
                f"https://{API_DOMAIN}/{path.lstrip('/')}",
                headers=headers,
            )
        except RequestException as e:
            raise GitHubApiError(f"{e}", status=getattr(e, "status_code", 0))
        if req.status_code < 200 or req.status_code >= 300:
            raise GitHubApiError(req.content, status=req.status_code)
        return orjson.loads(req.content)

    def _get_next_url(self, link_header: str) -> str | None:
        """Extract the 'next' URL from a GitHub Link header."""
        match = re.search(r'<([^>]+)>;\s*rel="next"', link_header)
        return match.group(1) if match else None

    def _request_paginated(self, path: str) -> list[dict[str, Any]]:
        """Fetch all pages of a paginated GitHub API endpoint."""
        headers = {"Authorization": f"token {self.access_token}"}
        url = f"https://{API_DOMAIN}/{path.lstrip('/')}"

        results: list[dict[str, Any]] = []
        for _ in range(MAX_PAGES):
            try:
                req = self.http.get(url, headers=headers)
            except RequestException as e:
                raise GitHubApiError(f"{e}", status=getattr(e, "status_code", 0))
            if req.status_code < 200 or req.status_code >= 300:
                raise GitHubApiError(req.content, status=req.status_code)

            page_data = orjson.loads(req.content)
            if isinstance(page_data, list):
                results.extend(page_data)
            else:
                results.append(page_data)

            next_url = self._get_next_url(req.headers.get("Link", ""))
            if not next_url:
                break
            url = next_url

        return results

    def get_org_list(self) -> list[dict[str, Any]]:
        return self._request_paginated("/user/orgs?per_page=100")

    def get_user(self) -> dict[str, Any] | list[dict[str, Any]]:
        return self._request("/user")

    def get_user_emails(self) -> list[dict[str, Any]]:
        res = self._request("/user/emails")
        if not isinstance(res, list):
            return [res]
        return res

    def is_org_member(self, org_id: int) -> bool:
        org_id_str = str(org_id)
        for o in self.get_org_list():
            if str(o["id"]) == org_id_str:
                return True
        return False

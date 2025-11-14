from __future__ import annotations

from types import TracebackType
from typing import int, Any

import orjson
from requests.exceptions import RequestException

from sentry import http

from .constants import API_DOMAIN


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

    def get_org_list(self) -> list[dict[str, Any]]:
        res = self._request("/user/orgs")
        if not isinstance(res, list):
            return [res]
        return res

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

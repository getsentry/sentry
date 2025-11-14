from __future__ import annotations

from types import TracebackType
from typing import int, Any

import orjson
from requests.exceptions import RequestException

from sentry import http

from .constants import ACCESS_TOKEN_URL


class FlyApiError(Exception):
    def __init__(self, message: str | bytes = "", status: int = 0) -> None:
        super().__init__(message)
        self.status = status


class FlyClient:
    def __init__(self, access_token: str) -> None:
        self.http = http.build_session()
        self.access_token = access_token

    def __enter__(self) -> FlyClient:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.http.close()

    def _request(self, path: str) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.access_token}"}
        req_url = f"{ACCESS_TOKEN_URL}/{path.lstrip('/')}"
        try:
            req = self.http.get(
                req_url,
                headers=headers,
            )
        except RequestException as e:
            raise FlyApiError(f"{e}", status=getattr(e, "status_code", 0))
        if req.status_code < 200 or req.status_code >= 300:
            raise FlyApiError(req.content, status=req.status_code)
        return orjson.loads(req.content)

    def get_info(self) -> dict[str, Any]:
        """
        Use access token to issue an inline request to the token introspection endpoint.
        The response gives you enough information, for example, to authorize the user
        if they belong the correct parent organization in your system, or to provision
        the user and add them to these organizations.

        GET https://api.fly.io/oauth/token/info
        Authorization: Bearer abc_123456
        """
        return self._request("/info")

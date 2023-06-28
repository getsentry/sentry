from requests.exceptions import RequestException

from sentry import http
from sentry.utils import json

from .constants import ACCESS_TOKEN_URL


class FlyApiError(Exception):
    def __init__(self, message="", status=0):
        super().__init__(message)
        self.status = status


class FlyClient:
    def __init__(self, access_token):
        self.http = http.build_session()
        self.access_token = access_token

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.http.close()

    def _request(self, path):
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
        return json.loads(req.content)

    def get_info(self):
        """
        Use access token to issue an inline request to the token introspection endpoint.
        The response gives you enough information, for example, to authorize the user
        if they belong the correct parent organization in your system, or to provision
        the user and add them to these organizations.

        GET https://api.fly.io/oauth/token/info
        Authorization: Bearer abc_123456
        """
        return self._request("/info")

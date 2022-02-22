from typing import Optional

import google.auth.transport.requests
import google.oauth2.id_token
from django.conf import settings
from django.http import HttpResponse
from requests import Response

from sentry.http import safe_urlopen


def get_from_profiling_service(method: str, path: str, params: Optional[dict] = None) -> Response:
    kwargs = {"method": method}
    if params:
        kwargs["params"] = params
    if settings.ENVIRONMENT == "production":
        id_token = fetch_id_token_for_service(settings.SENTRY_PROFILING_SERVICE_URL)
        kwargs["headers"] = {"Authorization": f"Bearer {id_token}"}
    return safe_urlopen(
        f"{settings.SENTRY_PROFILING_SERVICE_URL}{path}",
        **kwargs,
    )


def proxy_profiling_service(method: str, path: str, params: Optional[dict] = None) -> HttpResponse:
    response = get_from_profiling_service(method, path, params=params)
    return HttpResponse(
        content=response.content, status=response.status_code, headers=response.headers
    )


def fetch_id_token_for_service(service_url: str) -> str:
    auth_req = google.auth.transport.requests.Request()
    return google.oauth2.id_token.fetch_id_token(auth_req, service_url)

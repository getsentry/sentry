from __future__ import annotations

from collections.abc import Callable
from contextlib import contextmanager
from typing import Any
from unittest.mock import patch
from urllib.parse import parse_qs

import httpx
from django.conf import settings
from django.http import HttpResponseRedirect
from django.test import override_settings
from django.urls import re_path
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.request import Request
from rest_framework.response import Response

import sentry.api.urls as api_urls
from sentry.api.base import Endpoint, cell_silo_endpoint, control_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint, OrganizationEndpoint
from sentry.testutils.cases import APITestCase
from sentry.types.cell import Cell, RegionCategory
from sentry.utils import json


@control_silo_endpoint
class ControlEndpoint(ControlSiloOrganizationEndpoint):
    permission_classes: tuple[type[BasePermission], ...] = (AllowAny,)

    def get(self, request, organization, **kwargs):
        return Response({"proxy": False})


@cell_silo_endpoint
class RegionEndpoint(OrganizationEndpoint):
    permission_classes: tuple[type[BasePermission], ...] = (AllowAny,)

    def get(self, request, organization):
        return Response({"proxy": False})

    def post(self, request, organization):
        return HttpResponseRedirect("https://zombo.com")


@cell_silo_endpoint
class NoOrgRegionEndpoint(Endpoint):
    permission_classes: tuple[type[BasePermission], ...] = (AllowAny,)

    def get(self, request: Request) -> Response:
        return Response({"proxy": False})


urlpatterns = [
    re_path(
        r"^organizations/(?P<organization_slug>[^/]+)/control/$",
        ControlEndpoint.as_view(),
        name="control-endpoint",
    ),
    re_path(
        r"^organizations/(?P<organization_slug>[^/]+)/region/$",
        RegionEndpoint.as_view(),
        name="region-endpoint",
    ),
    re_path(
        r"^organizations/(?P<organization_id_or_slug>[^/]+)/control/$",
        ControlEndpoint.as_view(),
        name="control-endpoint-id-or-slug",
    ),
    re_path(
        r"^organizations/(?P<organization_id_or_slug>[^/]+)/region/$",
        RegionEndpoint.as_view(),
        name="region-endpoint-id-or-slug",
    ),
    re_path(
        r"^api/embed/error-page/$",
        RegionEndpoint.as_view(),
        name="sentry-error-page-embed",
    ),
] + api_urls.urlpatterns


# Type for httpx mock callback: receives httpx.Request, returns (status, headers, body)
HttpxCallback = Callable[[httpx.Request], tuple[int, dict[str, str], str | bytes]]


class HttpxMockRouter:
    """Mock HTTP router for httpx, replacing the `responses` library for async proxy tests."""

    def __init__(self) -> None:
        self._routes: list[dict[str, Any]] = []

    def add(
        self,
        method: str,
        url: str,
        body: str | bytes = b"",
        status_code: int = 200,
        headers: dict[str, str] | None = None,
        json_data: Any | None = None,
        content_type: str | None = None,
    ) -> None:
        if json_data is not None:
            body = json.dumps(json_data).encode()
            content_type = content_type or "application/json"
        elif isinstance(body, str):
            body = body.encode()
        resp_headers = dict(headers or {})
        if content_type:
            resp_headers["Content-Type"] = content_type
        self._routes.append(
            {
                "method": method.upper(),
                "url": url,
                "body": body,
                "status_code": status_code,
                "headers": resp_headers,
            }
        )

    def add_callback(self, method: str, url: str, callback: HttpxCallback) -> None:
        self._routes.append(
            {
                "method": method.upper(),
                "url": url,
                "callback": callback,
            }
        )

    def handler(self, request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        # Strip query params for matching
        url_path = url_str.split("?")[0]
        for route in self._routes:
            if request.method != route["method"]:
                continue
            route_url = route["url"].split("?")[0]
            if url_path != route_url:
                continue

            if "callback" in route:
                status_code, headers, body = route["callback"](request)
                if isinstance(body, str):
                    body = body.encode()
                return httpx.Response(
                    status_code, headers=dict(headers), content=body, request=request
                )
            else:
                return httpx.Response(
                    route["status_code"],
                    headers=route["headers"],
                    content=route["body"],
                    request=request,
                )

        raise ValueError(f"No mock route matched: {request.method} {url_str}")


@contextmanager
def mock_proxy_client(router: HttpxMockRouter):
    """Patch the proxy_client with a mock httpx.AsyncClient using the given router."""
    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(router.handler))
    with patch("sentry.hybridcloud.apigateway.proxy.proxy_client", mock_client):
        yield mock_client


def verify_request_body(body, headers):
    """Wrapper for a callback function for HttpxMockRouter.add_callback."""

    def request_callback(request: httpx.Request):
        if request.headers.get("content-type") == "application/json":
            assert json.loads(request.content) == body
        else:
            assert request.content == (body if isinstance(body, bytes) else body.encode())
        assert (request.headers[key] == headers[key] for key in headers)
        return 200, {}, json.dumps({"proxy": True})

    return request_callback


def verify_request_headers(headers):
    """Wrapper for a callback function for HttpxMockRouter.add_callback."""

    def request_callback(request: httpx.Request):
        assert (request.headers[key] == headers[key] for key in headers)
        return 200, {}, json.dumps({"proxy": True})

    return request_callback


def verify_request_params(params, headers):
    """Wrapper for a callback function for HttpxMockRouter.add_callback."""

    def request_callback(request: httpx.Request):
        request_params = parse_qs(str(request.url).split("?")[1])
        assert (request.headers[key] == headers[key] for key in headers)
        for key in params:
            assert key in request_params
            if len(request_params[key]) > 1:
                assert request_params[key] == params[key]
            else:
                assert request_params[key][0] == params[key]
        return 200, {}, json.dumps({"proxy": True})

    return request_callback


def verify_file_body(file_body, headers):
    """Wrapper for a callback function for HttpxMockRouter.add_callback."""

    def request_callback(request: httpx.Request):
        assert file_body in request.content
        assert (request.headers[key] == headers[key] for key in headers)
        return 200, {}, json.dumps({"proxy": True})

    return request_callback


def provision_middleware():
    middleware = list(settings.MIDDLEWARE)
    if "sentry.hybridcloud.apigateway.middleware.ApiGatewayMiddleware" not in middleware:
        middleware = ["sentry.hybridcloud.apigateway.middleware.ApiGatewayMiddleware"] + middleware
    return middleware


@override_settings(ROOT_URLCONF=__name__)
class ApiGatewayTestCase(APITestCase):
    # Subclasses will generally need to be decorated with
    #     @*_silo_test(cells=[ApiGatewayTestCase.CELL])

    CELL = Cell(
        name="us",
        snowflake_id=1,
        address="http://us.internal.sentry.io",
        category=RegionCategory.MULTI_TENANT,
    )

    def setUp(self):
        super().setUp()
        self.httpx_router = HttpxMockRouter()
        self.httpx_router.add(
            "GET",
            f"{self.CELL.address}/get",
            body=json.dumps({"proxy": True}),
            content_type="application/json",
            headers={"test": "header"},
        )
        self.httpx_router.add(
            "GET",
            f"{self.CELL.address}/error",
            body=json.dumps({"proxy": True}),
            status_code=400,
            content_type="application/json",
            headers={"test": "header"},
        )

        self.organization = self.create_organization(region=self.CELL)

        # Echos the request body and header back for verification
        def return_request_body(request: httpx.Request):
            return (200, dict(request.headers), request.content)

        # Echos the query params and header back for verification
        def return_request_params(request: httpx.Request):
            params = parse_qs(str(request.url).split("?")[1])
            return (200, dict(request.headers), json.dumps(params).encode())

        self.httpx_router.add_callback("GET", f"{self.CELL.address}/echo", return_request_params)
        self.httpx_router.add_callback("POST", f"{self.CELL.address}/echo", return_request_body)

        self.middleware = provision_middleware()
        # Enter the mock proxy client context for the duration of the test
        self._mock_proxy_ctx = mock_proxy_client(self.httpx_router)
        self._mock_proxy_ctx.__enter__()

    def tearDown(self):
        self._mock_proxy_ctx.__exit__(None, None, None)
        super().tearDown()

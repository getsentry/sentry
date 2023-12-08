from __future__ import annotations

from urllib.parse import parse_qs

import responses
from django.conf import settings
from django.test import override_settings
from django.urls import re_path
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

import sentry.api.urls as api_urls
from sentry.api.base import Endpoint, control_silo_endpoint, region_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint, OrganizationEndpoint
from sentry.testutils.cases import APITestCase
from sentry.types.region import Region, RegionCategory
from sentry.utils import json


@control_silo_endpoint
class ControlEndpoint(ControlSiloOrganizationEndpoint):
    permission_classes = (AllowAny,)  # type: ignore

    def get(self, request, organization, **kwargs):
        return Response({"proxy": False})


@region_silo_endpoint
class RegionEndpoint(OrganizationEndpoint):
    permission_classes = (AllowAny,)

    def get(self, request, organization):
        return Response({"proxy": False})


@region_silo_endpoint
class NoOrgRegionEndpoint(Endpoint):
    permission_classes = (AllowAny,)

    def get(self, request):
        return Response({"proxy": False})


urlpatterns = [
    re_path(
        r"^organizations/(?P<organization_slug>[^\/]+)/control/$",
        ControlEndpoint.as_view(),
        name="control-endpoint",
    ),
    re_path(
        r"^organizations/(?P<organization_slug>[^\/]+)/region/$",
        RegionEndpoint.as_view(),
        name="region-endpoint",
    ),
] + api_urls.urlpatterns


def verify_request_body(body, headers):
    """Wrapper for a callback function for responses.add_callback"""

    def request_callback(request):
        if request.headers.get("content-type") == "application/json":
            assert json.load(request.body) == body
        else:
            assert request.body.read() == body
        assert (request.headers[key] == headers[key] for key in headers)
        return 200, {}, json.dumps({"proxy": True})

    return request_callback


def verify_request_headers(headers):
    """Wrapper for a callback function for responses.add_callback"""

    def request_callback(request):
        assert (request.headers[key] == headers[key] for key in headers)
        return 200, {}, json.dumps({"proxy": True})

    return request_callback


def verify_request_params(params, headers):
    """Wrapper for a callback function for responses.add_callback"""

    def request_callback(request):
        request_params = parse_qs(request.url.split("?")[1])
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
    """Wrapper for a callback function for responses.add_callback"""

    def request_callback(request):
        assert file_body in request.body.read()
        assert (request.headers[key] == headers[key] for key in headers)
        return 200, {}, json.dumps({"proxy": True})

    return request_callback


def provision_middleware():
    middleware = list(settings.MIDDLEWARE)
    if "sentry.middleware.api_gateway.ApiGatewayMiddleware" not in middleware:
        middleware = ["sentry.middleware.api_gateway.ApiGatewayMiddleware"] + middleware
    return middleware


@override_settings(ROOT_URLCONF=__name__)
class ApiGatewayTestCase(APITestCase):
    # Subclasses will generally need to be decorated with
    #     @*_silo_test(regions=[ApiGatewayTestCase.REGION])

    REGION = Region(
        name="us",
        snowflake_id=1,
        address="http://us.internal.sentry.io",
        category=RegionCategory.MULTI_TENANT,
    )

    def setUp(self):
        super().setUp()
        responses.add(
            responses.GET,
            f"{self.REGION.address}/get",
            body=json.dumps({"proxy": True}),
            content_type="application/json",
            adding_headers={"test": "header"},
        )
        responses.add(
            responses.GET,
            f"{self.REGION.address}/error",
            body=json.dumps({"proxy": True}),
            status=400,
            content_type="application/json",
            adding_headers={"test": "header"},
        )

        self.organization = self.create_organization(region=self.REGION)

        # Echos the request body and header back for verification
        def return_request_body(request):
            return (200, request.headers, request.body)

        # Echos the query params and header back for verification
        def return_request_params(request):
            params = parse_qs(request.url.split("?")[1])
            return (200, request.headers, json.dumps(params).encode())

        responses.add_callback(responses.GET, f"{self.REGION.address}/echo", return_request_params)
        responses.add_callback(responses.POST, f"{self.REGION.address}/echo", return_request_body)

        self.middleware = provision_middleware()

from urllib.parse import parse_qs

import requests
import responses
from django.conf.urls import url
from django.test import override_settings
from rest_framework.response import Response

from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.testutils import TestCase
from sentry.types.region import Region, RegionCategory
from sentry.utils import json

SENTRY_REGION_CONFIG = [
    Region(name="region1", id=1, address="region1", category=RegionCategory.MULTI_TENANT),
]


@control_silo_endpoint
class ControlEndpoint(Endpoint):
    def get(self, request):
        return Response({"ok": True})


urlpatterns = url(r"^/control-endpoint", ControlEndpoint.as_view(), name="control-endpoint")


def verify_request_body(body, headers):
    """Wrapper for a callback function for responses.add_callback"""

    def request_callback(request):
        assert json.loads(request.body) == body
        assert (request.headers[key] == headers[key] for key in headers)
        return 200, {}, b"{}"

    return request_callback


def verify_request_params(params, headers):
    """Wrapper for a callback function for responses.add_callback"""

    def request_callback(request):
        request_params = parse_qs(request.url.split("?")[1])
        assert request_params == params
        assert (request.headers[key] == headers[key] for key in headers)
        return 200, {}, b"{}"

    return request_callback


def verify_file_body(file_body, headers):
    """Wrapper for a callback function for responses.add_callback"""

    def request_callback(request):
        assert request.body == file_body
        assert (request.headers[key] == headers[key] for key in headers)
        return 200, {}, b"{}"

    return request_callback


@override_settings(SENTRY_REGION_CONFIG=SENTRY_REGION_CONFIG, ROOT_URLCONF=__name__)
class ApiGatewayTestCase(TestCase):
    def setUp(self):
        responses.add(responses.GET, "http://region1.sentry.io/get", body={"ok": True})
        responses.add(
            responses.GET,
            "http://region1.sentry.io/error",
            body={"ok": False},
            status=400,
        )

        # Echos the request body and header back for verification
        def return_request_body(request):
            return (200, request.headers, request.body)

        # Echos the query params and header back for verification
        def return_request_params(request):
            params = parse_qs(request.url.split("?")[1])
            return (200, request.headers, json.dumps(params).encode())

        responses.add_callback(
            responses.GET, "http://region1.sentry.io/echo", return_request_params
        )

        responses.add_callback(responses.POST, "http://region1.sentry.io/echo", return_request_body)


class VerifyRequestBodyTest(ApiGatewayTestCase):
    @responses.activate
    def test_verify_request_body(self):
        body = {"ab": "cd"}
        headers = {"header": "nope"}
        responses.add_callback(
            responses.POST, "http://ab.cd.e/test", verify_request_body(body, headers)
        )
        resp = requests.post("http://ab.cd.e/test", json=body, headers=headers)
        assert resp.status_code == 200

from unittest.mock import patch

import responses
from django.test.client import RequestFactory
from pytest import raises
from rest_framework.exceptions import NotFound

from sentry.api_gateway.proxy import proxy_request
from sentry.testutils.helpers.api_gateway import SENTRY_REGION_CONFIG, ApiGatewayTestCase


class ProxyTestCase(ApiGatewayTestCase):
    @responses.activate
    @patch("sentry.types.region.get_region_for_organization")
    def test_simple(self, region_fnc_patch):
        request = RequestFactory().get("http://sentry.io/get")
        region_fnc_patch.return_value = SENTRY_REGION_CONFIG[0]
        resp = proxy_request(request, self.organization.slug)
        assert resp.status_code == 200
        assert resp.data["proxy"]
        assert resp.has_header("test")
        assert resp["test"] == "header"

        request = RequestFactory().get("http://sentry.io/error")
        resp = proxy_request(request, self.organization.slug)
        assert resp.status_code == 400
        assert resp.data["proxy"]
        assert resp.has_header("test")
        assert resp["test"] == "header"

    @responses.activate
    @patch("sentry.types.region.get_region_for_organization")
    def test_bad_org(self, region_fnc_patch):
        request = RequestFactory().get("http://sentry.io/get")
        region_fnc_patch.return_value = SENTRY_REGION_CONFIG[0]
        with raises(NotFound):
            proxy_request(request, "doesnotexist")

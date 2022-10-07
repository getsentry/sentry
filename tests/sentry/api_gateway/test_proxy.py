from unittest.mock import patch
from urllib.parse import urlencode

import pytest
import responses
from django.test.client import RequestFactory
from rest_framework.exceptions import NotFound

from sentry.api_gateway.proxy import proxy_request
from sentry.testutils.helpers.api_gateway import SENTRY_REGION_CONFIG, ApiGatewayTestCase
from sentry.utils import json


class ProxyTestCase(ApiGatewayTestCase):
    @responses.activate
    @patch("sentry.types.region.get_region_for_organization")
    def test_simple(self, region_fnc_patch):
        request = RequestFactory().get("http://sentry.io/get")
        region_fnc_patch.return_value = SENTRY_REGION_CONFIG[0]
        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(b"".join(resp.streaming_content))
        assert resp.status_code == 200
        assert resp_json["proxy"]
        assert resp.has_header("test")
        assert resp["test"] == "header"

        request = RequestFactory().get("http://sentry.io/error")
        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(b"".join(resp.streaming_content))
        assert resp.status_code == 400
        assert resp_json["proxy"]
        assert resp.has_header("test")
        assert resp["test"] == "header"

    @responses.activate
    @patch("sentry.types.region.get_region_for_organization")
    def test_query_params(self, region_fnc_patch):

        query_param_dict = dict(foo="bar", numlist=["1", "2", "3"])
        query_param_str = urlencode(query_param_dict, doseq=True)
        request = RequestFactory().get(f"http://sentry.io/echo?{query_param_str}")
        region_fnc_patch.return_value = SENTRY_REGION_CONFIG[0]

        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(b"".join(resp.streaming_content))

        assert resp.status_code == 200
        # parse_qs returns everything in a list, including single arguments
        assert query_param_dict["foo"] == resp_json["foo"][0]
        assert query_param_dict["numlist"] == resp_json["numlist"]

    @pytest.mark.xfail(reason="Uncommitted to Organization Table Location")
    @responses.activate
    @patch("sentry.types.region.get_region_for_organization")
    def test_bad_org(self, region_fnc_patch):
        request = RequestFactory().get("http://sentry.io/get")
        region_fnc_patch.return_value = SENTRY_REGION_CONFIG[0]
        with pytest.raises(NotFound):
            proxy_request(request, "doesnotexist")

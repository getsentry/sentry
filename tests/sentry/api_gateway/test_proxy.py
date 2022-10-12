from unittest.mock import patch
from urllib.parse import urlencode

import pytest
import responses
from django.test.client import RequestFactory
from rest_framework.exceptions import NotFound

from sentry.api_gateway.proxy import proxy_request
from sentry.testutils.helpers.api_gateway import (
    SENTRY_REGION_CONFIG,
    ApiGatewayTestCase,
    verify_request_body,
    verify_request_headers,
)
from sentry.utils import json


@patch("sentry.types.region.get_region_for_organization", return_value=SENTRY_REGION_CONFIG[0])
class ProxyTestCase(ApiGatewayTestCase):
    @responses.activate
    def test_simple(self, _):
        request = RequestFactory().get("http://sentry.io/get")
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
    def test_query_params(self, _):

        query_param_dict = dict(foo="bar", numlist=["1", "2", "3"])
        query_param_str = urlencode(query_param_dict, doseq=True)
        request = RequestFactory().get(f"http://sentry.io/echo?{query_param_str}")

        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(b"".join(resp.streaming_content))

        assert resp.status_code == 200
        # parse_qs returns everything in a list, including single arguments
        assert query_param_dict["foo"] == resp_json["foo"][0]
        assert query_param_dict["numlist"] == resp_json["numlist"]

    @pytest.mark.xfail(reason="Uncommitted to Organization Table Location")
    @responses.activate
    def test_bad_org(self, _):
        request = RequestFactory().get("http://sentry.io/get")
        with pytest.raises(NotFound):
            proxy_request(request, "doesnotexist")

    @responses.activate
    def test_post(self, _):
        request_body = {"foo": "bar", "nested": {"int_list": [1, 2, 3]}}
        responses.add_callback(
            responses.POST,
            "http://region1.testserver/post",
            verify_request_body(request_body, {"test": "header"}),
        )

        request = RequestFactory().post(
            "http://sentry.io/post", data=request_body, content_type="application/json"
        )
        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(b"".join(resp.streaming_content))

        assert resp.status_code == 200
        assert resp_json["proxy"]

    @responses.activate
    def test_put(self, _):
        request_body = {"foo": "bar", "nested": {"int_list": [1, 2, 3]}}
        responses.add_callback(
            responses.PUT,
            "http://region1.testserver/put",
            verify_request_body(request_body, {"test": "header"}),
        )

        request = RequestFactory().put(
            "http://sentry.io/put", data=request_body, content_type="application/json"
        )
        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(b"".join(resp.streaming_content))

        assert resp.status_code == 200
        assert resp_json["proxy"]

    @responses.activate
    def test_patch(self, _):
        request_body = {"foo": "bar", "nested": {"int_list": [1, 2, 3]}}
        responses.add_callback(
            responses.PATCH,
            "http://region1.testserver/patch",
            verify_request_body(request_body, {"test": "header"}),
        )

        request = RequestFactory().patch(
            "http://sentry.io/patch", data=request_body, content_type="application/json"
        )
        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(b"".join(resp.streaming_content))

        assert resp.status_code == 200
        assert resp_json["proxy"]

    @responses.activate
    def test_head(self, _):
        request_body = {"foo": "bar", "nested": {"int_list": [1, 2, 3]}}
        responses.add_callback(
            responses.HEAD,
            "http://region1.testserver/head",
            verify_request_headers({"test": "header"}),
        )

        request = RequestFactory().head(
            "http://sentry.io/head", data=request_body, content_type="application/json"
        )
        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(b"".join(resp.streaming_content))

        assert resp.status_code == 200
        assert resp_json["proxy"]

    @responses.activate
    def test_delete(self, _):
        request_body = {"foo": "bar", "nested": {"int_list": [1, 2, 3]}}
        responses.add_callback(
            responses.DELETE,
            "http://region1.testserver/delete",
            verify_request_body(request_body, {"test": "header"}),
        )

        request = RequestFactory().delete(
            "http://sentry.io/delete", data=request_body, content_type="application/json"
        )
        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(b"".join(resp.streaming_content))

        assert resp.status_code == 200
        assert resp_json["proxy"]

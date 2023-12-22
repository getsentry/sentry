from urllib.parse import urlencode

import responses
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test.client import RequestFactory

from sentry.hybridcloud.apigateway.proxy import proxy_request
from sentry.silo.util import INVALID_OUTBOUND_HEADERS, PROXY_DIRECT_LOCATION_HEADER
from sentry.testutils.helpers.apigateway import (
    ApiGatewayTestCase,
    verify_file_body,
    verify_request_body,
    verify_request_headers,
)
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


@control_silo_test(regions=[ApiGatewayTestCase.REGION], include_monolith_run=True)
class ProxyTestCase(ApiGatewayTestCase):
    @responses.activate
    def test_simple(self):
        request = RequestFactory().get("http://sentry.io/get")
        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(close_streaming_response(resp))
        assert resp.status_code == 200
        assert resp_json["proxy"]
        assert resp.has_header("test")
        assert resp["test"] == "header"
        assert resp.has_header(PROXY_DIRECT_LOCATION_HEADER)
        assert resp[PROXY_DIRECT_LOCATION_HEADER] == "http://us.internal.sentry.io/get"

        request = RequestFactory().get("http://sentry.io/error")
        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(close_streaming_response(resp))
        assert resp.status_code == 400
        assert resp_json["proxy"]
        assert resp.has_header("test")
        assert resp["test"] == "header"
        assert resp.has_header(PROXY_DIRECT_LOCATION_HEADER)
        assert resp[PROXY_DIRECT_LOCATION_HEADER] == "http://us.internal.sentry.io/error"

    @responses.activate
    def test_query_params(self):

        query_param_dict = dict(foo="bar", numlist=["1", "2", "3"])
        query_param_str = urlencode(query_param_dict, doseq=True)
        request = RequestFactory().get(f"http://sentry.io/echo?{query_param_str}")

        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        # parse_qs returns everything in a list, including single arguments
        assert query_param_dict["foo"] == resp_json["foo"][0]
        assert query_param_dict["numlist"] == resp_json["numlist"]

    @responses.activate
    def test_bad_org(self):
        request = RequestFactory().get("http://sentry.io/get")
        resp = proxy_request(request, "doesnotexist")
        assert resp.status_code == 404

    @responses.activate
    def test_post(self):
        request_body = {"foo": "bar", "nested": {"int_list": [1, 2, 3]}}
        responses.add_callback(
            responses.POST,
            "http://us.internal.sentry.io/post",
            verify_request_body(request_body, {"test": "header"}),
        )

        request = RequestFactory().post(
            "http://sentry.io/post", data=request_body, content_type="application/json"
        )
        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        assert resp_json["proxy"]
        assert resp.has_header(PROXY_DIRECT_LOCATION_HEADER)
        assert resp[PROXY_DIRECT_LOCATION_HEADER] == "http://us.internal.sentry.io/post"

    @responses.activate
    def test_put(self):
        request_body = {"foo": "bar", "nested": {"int_list": [1, 2, 3]}}
        responses.add_callback(
            responses.PUT,
            "http://us.internal.sentry.io/put",
            verify_request_body(request_body, {"test": "header"}),
        )

        request = RequestFactory().put(
            "http://sentry.io/put", data=request_body, content_type="application/json"
        )
        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        assert resp_json["proxy"]
        assert resp.has_header(PROXY_DIRECT_LOCATION_HEADER)
        assert resp[PROXY_DIRECT_LOCATION_HEADER] == "http://us.internal.sentry.io/put"

    @responses.activate
    def test_patch(self):
        request_body = {"foo": "bar", "nested": {"int_list": [1, 2, 3]}}
        responses.add_callback(
            responses.PATCH,
            "http://us.internal.sentry.io/patch",
            verify_request_body(request_body, {"test": "header"}),
        )

        request = RequestFactory().patch(
            "http://sentry.io/patch", data=request_body, content_type="application/json"
        )
        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        assert resp_json["proxy"]
        assert resp.has_header(PROXY_DIRECT_LOCATION_HEADER)
        assert resp[PROXY_DIRECT_LOCATION_HEADER] == "http://us.internal.sentry.io/patch"

    @responses.activate
    def test_head(self):
        request_body = {"foo": "bar", "nested": {"int_list": [1, 2, 3]}}
        responses.add_callback(
            responses.HEAD,
            "http://us.internal.sentry.io/head",
            verify_request_headers({"test": "header"}),
        )

        request = RequestFactory().head(
            "http://sentry.io/head", data=request_body, content_type="application/json"
        )
        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        assert resp_json["proxy"]
        assert resp.has_header(PROXY_DIRECT_LOCATION_HEADER)
        assert resp[PROXY_DIRECT_LOCATION_HEADER] == "http://us.internal.sentry.io/head"

    @responses.activate
    def test_delete(self):
        request_body = {"foo": "bar", "nested": {"int_list": [1, 2, 3]}}
        responses.add_callback(
            responses.DELETE,
            "http://us.internal.sentry.io/delete",
            verify_request_body(request_body, {"test": "header"}),
        )

        request = RequestFactory().delete(
            "http://sentry.io/delete", data=request_body, content_type="application/json"
        )
        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        assert resp_json["proxy"]
        assert resp.has_header(PROXY_DIRECT_LOCATION_HEADER)
        assert resp[PROXY_DIRECT_LOCATION_HEADER] == "http://us.internal.sentry.io/delete"

    @responses.activate
    def test_file_upload(self):
        foo = dict(test="a", file="b", what="c")
        contents = json.dumps(foo).encode()
        request_body = {
            "test.js": SimpleUploadedFile("test.js", contents, content_type="application/json"),
            "foo": "bar",
        }

        responses.add_callback(
            responses.POST,
            "http://us.internal.sentry.io/post",
            verify_file_body(contents, {"test": "header"}),
        )
        request = RequestFactory().post(
            "http://sentry.io/post", data=request_body, format="multipart"
        )
        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        assert resp_json["proxy"]

    @responses.activate
    def test_alternate_content_type(self):
        # Check form encoded files also work
        foo = dict(test="a", file="b", what="c")
        contents = urlencode(foo, doseq=True).encode("utf-8")
        request_body = contents
        responses.add_callback(
            responses.POST,
            "http://us.internal.sentry.io/post",
            verify_request_body(contents, {"test": "header"}),
        )
        request = RequestFactory().post(
            "http://sentry.io/post",
            data=request_body,
            content_type="application/x-www-form-urlencoded",
        )
        resp = proxy_request(request, self.organization.slug)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        assert resp_json["proxy"]

    @responses.activate
    def test_strip_request_headers(self):
        request_body = {"foo": "bar", "nested": {"int_list": [1, 2, 3]}}
        responses.add_callback(
            responses.POST,
            "http://us.internal.sentry.io/post",
            verify_request_body(request_body, {"test": "header"}),
        )

        request = RequestFactory().post(
            "http://sentry.io/post",
            data=request_body,
            content_type="application/json",
            headers={
                header: "1"
                for header in INVALID_OUTBOUND_HEADERS
                # can't test `content-length` -- django 4 respects this when
                # reading the json body and gets just `'{'`
                if header != "Content-Length"
            },
        )

        resp = proxy_request(request, self.organization.slug)
        assert not any([header in resp for header in INVALID_OUTBOUND_HEADERS])

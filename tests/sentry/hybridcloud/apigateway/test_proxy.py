from collections.abc import Generator
from unittest.mock import Mock, patch
from urllib.parse import urlencode

import pytest
import responses
from django.core.files.uploadedfile import SimpleUploadedFile
from django.http import JsonResponse
from django.test.client import RequestFactory
from requests import PreparedRequest
from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import ConnectTimeout

from sentry.hybridcloud.apigateway import proxy as apigateway_proxy
from sentry.hybridcloud.apigateway.proxy import proxy_request
from sentry.silo.util import (
    INVALID_OUTBOUND_HEADERS,
    PROXY_APIGATEWAY_HEADER,
    PROXY_DIRECT_LOCATION_HEADER,
)
from sentry.testutils.helpers.apigateway import (
    ApiGatewayTestCase,
    verify_file_body,
    verify_request_body,
    verify_request_headers,
)
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.silo import control_silo_test
from sentry.types.cell import Cell
from sentry.utils import json

url_name = "sentry-api-0-projets"


@pytest.fixture(autouse=True)
def close_proxy_connection() -> Generator[None]:
    # The proxy reuses a thread-local requests.Session for connection pooling.
    # Reset it between tests so pooled connections and cookie state don't leak.
    yield
    connection = apigateway_proxy._connection
    if hasattr(connection, "session"):
        connection.session.close()
        del connection.session


def test_response_closes_upstream_after_streaming() -> None:
    response = Mock()
    response.headers = {"Content-Type": "application/json"}
    response.iter_content.return_value = iter([b'{"proxy": true}'])
    response.status_code = 200

    streaming_response = apigateway_proxy._parse_response(
        response, "http://us.internal.sentry.io/test"
    )
    assert close_streaming_response(streaming_response) == b'{"proxy": true}'
    response.close.assert_called_once_with()


@control_silo_test(cells=[ApiGatewayTestCase.CELL], include_monolith_run=True)
class ProxyTestCase(ApiGatewayTestCase):
    @responses.activate
    def test_pooling_does_not_persist_response_cookies(self) -> None:
        responses.add(
            responses.GET,
            "http://us.internal.sentry.io/sets-cookie",
            body=json.dumps({"proxy": True}),
            content_type="application/json",
            headers={"Set-Cookie": "cell_session=leaked; Path=/"},
        )

        def request_callback(request: PreparedRequest) -> tuple[int, dict[str, str], str]:
            assert "cell_session=leaked" not in request.headers.get("Cookie", "")
            return 200, {"Content-Type": "application/json"}, json.dumps({"proxy": True})

        responses.add_callback(
            responses.GET,
            "http://us.internal.sentry.io/without-cookie",
            callback=request_callback,
        )

        with override_options({"hybridcloud.apigateway.use_pooling.rate": 1.0}):
            first_request = RequestFactory().get("http://sentry.io/sets-cookie")
            first_response = proxy_request(first_request, self.organization.slug, url_name)
            assert first_response.status_code == 200
            assert first_response["Set-Cookie"] == "cell_session=leaked; Path=/"
            close_streaming_response(first_response)

            second_request = RequestFactory().get("http://sentry.io/without-cookie")
            second_response = proxy_request(second_request, self.organization.slug, url_name)
            assert second_response.status_code == 200
            close_streaming_response(second_response)

    @responses.activate
    def test_pooling_preserves_incoming_request_cookies(self) -> None:
        def request_callback(request: PreparedRequest) -> tuple[int, dict[str, str], str]:
            assert request.headers.get("Cookie") == "original=1"
            return 200, {"Content-Type": "application/json"}, json.dumps({"proxy": True})

        responses.add_callback(
            responses.GET,
            "http://us.internal.sentry.io/with-cookie",
            callback=request_callback,
        )

        with override_options({"hybridcloud.apigateway.use_pooling.rate": 1.0}):
            request = RequestFactory().get(
                "http://sentry.io/with-cookie", headers={"Cookie": "original=1"}
            )
            response = proxy_request(request, self.organization.slug, url_name)
            assert response.status_code == 200
            close_streaming_response(response)

    @responses.activate
    def test_simple(self) -> None:
        request = RequestFactory().get("http://sentry.io/get")
        resp = proxy_request(request, self.organization.slug, url_name)
        resp_json = json.loads(close_streaming_response(resp))
        assert resp.status_code == 200
        assert resp_json["proxy"]
        assert resp.has_header("test")
        assert resp["test"] == "header"
        assert resp.has_header(PROXY_DIRECT_LOCATION_HEADER)
        assert resp[PROXY_DIRECT_LOCATION_HEADER] == "http://us.internal.sentry.io/get"

        request = RequestFactory().get("http://sentry.io/error")
        resp = proxy_request(request, self.organization.slug, url_name)
        resp_json = json.loads(close_streaming_response(resp))
        assert resp.status_code == 400
        assert resp_json["proxy"]
        assert resp.has_header("test")
        assert resp["test"] == "header"
        assert resp.has_header(PROXY_DIRECT_LOCATION_HEADER)
        assert resp[PROXY_DIRECT_LOCATION_HEADER] == "http://us.internal.sentry.io/error"

    @responses.activate
    def test_query_params(self) -> None:
        query_param_dict = dict(foo="bar", numlist=["1", "2", "3"])
        query_param_str = urlencode(query_param_dict, doseq=True)
        request = RequestFactory().get(f"http://sentry.io/echo?{query_param_str}")

        resp = proxy_request(request, self.organization.slug, url_name)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        # parse_qs returns everything in a list, including single arguments
        assert query_param_dict["foo"] == resp_json["foo"][0]
        assert query_param_dict["numlist"] == resp_json["numlist"]

    @responses.activate
    def test_query_string_forwarded_verbatim(self) -> None:
        captured: dict[str, str] = {}

        def request_callback(request: PreparedRequest) -> tuple[int, dict[str, str], str]:
            assert request.url is not None
            captured["url"] = request.url
            return 200, {"Content-Type": "application/json"}, json.dumps({"proxy": True})

        responses.add_callback(
            responses.GET,
            "http://us.internal.sentry.io/echo-verbatim",
            callback=request_callback,
        )

        # The ``:`` and ``+`` would be percent-encoded by ``dict(request.GET)``.
        query = (
            "os_kid=sentry&os_timestamp=2026-07-13T13:19:24+00:00&os_duration=300&os_sig=ab_c-D9z"
        )
        request = RequestFactory().get(f"http://sentry.io/echo-verbatim?{query}")

        resp = proxy_request(request, self.organization.slug, url_name)
        close_streaming_response(resp)

        assert captured["url"].split("?", 1)[1] == query

    @responses.activate
    def test_bad_org(self) -> None:
        request = RequestFactory().get("http://sentry.io/get")
        resp = proxy_request(request, "doesnotexist", url_name)
        assert resp.status_code == 404

    @responses.activate
    def test_post(self) -> None:
        request_body = {"foo": "bar", "nested": {"int_list": [1, 2, 3]}}
        responses.add_callback(
            responses.POST,
            "http://us.internal.sentry.io/post",
            verify_request_body(request_body, {"test": "header"}),
        )

        request = RequestFactory().post(
            "http://sentry.io/post", data=request_body, content_type="application/json"
        )
        resp = proxy_request(request, self.organization.slug, url_name)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        assert resp_json["proxy"]
        assert resp.has_header(PROXY_DIRECT_LOCATION_HEADER)
        assert resp[PROXY_DIRECT_LOCATION_HEADER] == "http://us.internal.sentry.io/post"

    @responses.activate
    def test_put(self) -> None:
        request_body = {"foo": "bar", "nested": {"int_list": [1, 2, 3]}}
        responses.add_callback(
            responses.PUT,
            "http://us.internal.sentry.io/put",
            verify_request_body(request_body, {"test": "header"}),
        )

        request = RequestFactory().put(
            "http://sentry.io/put", data=request_body, content_type="application/json"
        )
        resp = proxy_request(request, self.organization.slug, url_name)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        assert resp_json["proxy"]
        assert resp.has_header(PROXY_DIRECT_LOCATION_HEADER)
        assert resp[PROXY_DIRECT_LOCATION_HEADER] == "http://us.internal.sentry.io/put"

    @responses.activate
    def test_patch(self) -> None:
        request_body = {"foo": "bar", "nested": {"int_list": [1, 2, 3]}}
        responses.add_callback(
            responses.PATCH,
            "http://us.internal.sentry.io/patch",
            verify_request_body(request_body, {"test": "header"}),
        )

        request = RequestFactory().patch(
            "http://sentry.io/patch", data=request_body, content_type="application/json"
        )
        resp = proxy_request(request, self.organization.slug, url_name)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        assert resp_json["proxy"]
        assert resp.has_header(PROXY_DIRECT_LOCATION_HEADER)
        assert resp[PROXY_DIRECT_LOCATION_HEADER] == "http://us.internal.sentry.io/patch"

    @responses.activate
    def test_head(self) -> None:
        request_body = {"foo": "bar", "nested": {"int_list": [1, 2, 3]}}
        responses.add_callback(
            responses.HEAD,
            "http://us.internal.sentry.io/head",
            verify_request_headers({"test": "header"}),
        )

        request = RequestFactory().head(
            "http://sentry.io/head", data=request_body, content_type="application/json"
        )
        resp = proxy_request(request, self.organization.slug, url_name)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        assert resp_json["proxy"]
        assert resp.has_header(PROXY_DIRECT_LOCATION_HEADER)
        assert resp[PROXY_DIRECT_LOCATION_HEADER] == "http://us.internal.sentry.io/head"

    @responses.activate
    def test_delete(self) -> None:
        request_body = {"foo": "bar", "nested": {"int_list": [1, 2, 3]}}
        responses.add_callback(
            responses.DELETE,
            "http://us.internal.sentry.io/delete",
            verify_request_body(request_body, {"test": "header"}),
        )

        request = RequestFactory().delete(
            "http://sentry.io/delete", data=request_body, content_type="application/json"
        )
        resp = proxy_request(request, self.organization.slug, url_name)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        assert resp_json["proxy"]
        assert resp.has_header(PROXY_DIRECT_LOCATION_HEADER)
        assert resp[PROXY_DIRECT_LOCATION_HEADER] == "http://us.internal.sentry.io/delete"

    @responses.activate
    def test_file_upload(self) -> None:
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
        resp = proxy_request(request, self.organization.slug, url_name)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        assert resp_json["proxy"]

    @responses.activate
    def test_alternate_content_type(self) -> None:
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
        resp = proxy_request(request, self.organization.slug, url_name)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        assert resp_json["proxy"]

    @responses.activate
    def test_apply_apigateway_proxy_header(self) -> None:
        def request_callback(request: PreparedRequest) -> tuple[int, dict[str, str], str]:
            assert request.headers.get(PROXY_APIGATEWAY_HEADER), (
                "Proxied requests should have a header added"
            )
            return 200, {"proxied": "yes"}, json.dumps({"success": True})

        responses.add_callback(
            responses.POST,
            "http://us.internal.sentry.io/post",
            callback=request_callback,
        )

        request = RequestFactory().post(
            "http://sentry.io/post",
            data="",
            content_type="application/json",
        )

        resp = proxy_request(request, self.organization.slug, url_name)
        assert resp.status_code == 200
        assert resp["proxied"] == "yes"

    @responses.activate
    def test_strip_request_headers(self) -> None:
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

        resp = proxy_request(request, self.organization.slug, url_name)
        assert not any([header in resp for header in INVALID_OUTBOUND_HEADERS])

    @responses.activate
    def test_connect_timeout_returns_500(self) -> None:
        responses.add(
            responses.GET,
            "http://us.internal.sentry.io/unreachable",
            body=ConnectTimeout("connection timed out"),
        )
        request = RequestFactory().get("http://sentry.io/unreachable")
        resp = proxy_request(request, self.organization.slug, url_name)
        assert resp.status_code == 500
        assert isinstance(resp, JsonResponse)
        assert json.loads(resp.content)["detail"] == "Proxied request timed out"

    @responses.activate
    def test_connection_error_returns_500(self) -> None:
        responses.add(
            responses.GET,
            "http://us.internal.sentry.io/unreachable",
            body=RequestsConnectionError("connection refused"),
        )
        request = RequestFactory().get("http://sentry.io/unreachable")
        resp = proxy_request(request, self.organization.slug, url_name)
        assert resp.status_code == 500
        assert isinstance(resp, JsonResponse)
        assert json.loads(resp.content)["detail"] == "Downstream service unavailable"

    @responses.activate
    def test_preserves_content_encoding_for_snapshot_create(self) -> None:
        captured: dict[str, str | None] = {}

        def request_callback(request: PreparedRequest) -> tuple[int, dict[str, str], str]:
            captured["content_encoding"] = request.headers.get("Content-Encoding")
            return 200, {"Content-Type": "application/json"}, json.dumps({"proxy": True})

        responses.add_callback(
            responses.POST, "http://us.internal.sentry.io/post", callback=request_callback
        )

        request = RequestFactory().post(
            "http://sentry.io/post",
            data={"foo": "bar"},
            content_type="application/json",
            headers={"Content-Encoding": "zstd"},
        )
        resp = proxy_request(
            request, self.organization.slug, "sentry-api-0-project-preprod-snapshots-create"
        )
        close_streaming_response(resp)
        assert captured["content_encoding"] == "zstd"

    @responses.activate
    def test_strips_content_encoding_for_other_routes(self) -> None:
        captured: dict[str, str | None] = {}

        def request_callback(request: PreparedRequest) -> tuple[int, dict[str, str], str]:
            captured["content_encoding"] = request.headers.get("Content-Encoding")
            return 200, {"Content-Type": "application/json"}, json.dumps({"proxy": True})

        responses.add_callback(
            responses.POST, "http://us.internal.sentry.io/post", callback=request_callback
        )

        request = RequestFactory().post(
            "http://sentry.io/post",
            data={"foo": "bar"},
            content_type="application/json",
            headers={"Content-Encoding": "zstd"},
        )
        resp = proxy_request(request, self.organization.slug, url_name)
        close_streaming_response(resp)
        assert captured["content_encoding"] is None

    @responses.activate
    @patch("sentry.hybridcloud.apigateway.proxy.metrics")
    def test_orgslug_metrics_emitted_on_success(self, mock_metrics: Mock) -> None:
        request = RequestFactory().get("http://sentry.io/get")
        resp = proxy_request(request, self.organization.slug, url_name)
        close_streaming_response(resp)
        assert resp.status_code == 200

        mock_metrics.incr.assert_any_call(
            "apigateway.proxy_request",
            tags={
                "url_name": url_name,
                "kind": "orgslug",
                "target": "us",
                "request_method": "GET",
            },
        )

    @responses.activate
    @patch("sentry.hybridcloud.apigateway.proxy.metrics")
    def test_unresolved_org_does_not_emit_proxy_request(self, mock_metrics: Mock) -> None:
        request = RequestFactory().get("http://sentry.io/get")
        resp = proxy_request(request, "doesnotexist", url_name)
        assert resp.status_code == 404

        emitted = [c.args[0] for c in mock_metrics.incr.mock_calls]
        assert "apigateway.proxy_request" not in emitted

    @responses.activate
    @patch("sentry.hybridcloud.apigateway.proxy.metrics")
    def test_upstream_failure_emits_request_failed(self, mock_metrics: Mock) -> None:
        responses.add(
            responses.GET,
            "http://us.internal.sentry.io/bad-gateway",
            body=json.dumps({}),
            status=503,
            content_type="application/json",
        )

        request = RequestFactory().get("http://sentry.io/bad-gateway")
        resp = proxy_request(request, self.organization.slug, url_name)
        close_streaming_response(resp)
        assert resp.status_code == 503

        emitted = [c.args[0] for c in mock_metrics.incr.mock_calls]
        assert "apigateway.proxy.request_failed" in emitted


api_gateway_address_cell = Cell(
    name="us",
    snowflake_id=1,
    address="http://sentry-rpc:8999",
    api_gateway_address="http://sentry-api-gateway-rpc:8999",
)


@control_silo_test(cells=[api_gateway_address_cell], include_monolith_run=True)
class ApiGatewayAddressProxyTestCase(ApiGatewayTestCase):
    @responses.activate
    def test_post(self) -> None:
        responses.add(
            responses.POST,
            "http://sentry-api-gateway-rpc:8999/post",
            body=json.dumps({"test": "header"}),
        )
        request = RequestFactory().post(
            "http://sentry.io/post", data={"test": "header"}, content_type="application/json"
        )
        resp = proxy_request(request, self.organization.slug, url_name)
        resp_json = json.loads(close_streaming_response(resp))

        assert resp.status_code == 200
        assert resp_json["test"]
        assert resp.has_header(PROXY_DIRECT_LOCATION_HEADER)

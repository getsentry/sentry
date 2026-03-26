from unittest.mock import MagicMock, patch
from urllib.parse import urlencode

import pytest
import requests
import responses
from django.core.files.uploadedfile import SimpleUploadedFile
from django.http import HttpResponse
from django.test.client import RequestFactory
from requests.exceptions import Timeout

from sentry.api.exceptions import RequestTimeout
from sentry.hybridcloud.apigateway.proxy import proxy_request
from sentry.silo.util import (
    INVALID_OUTBOUND_HEADERS,
    PROXY_APIGATEWAY_HEADER,
    PROXY_DIRECT_LOCATION_HEADER,
)
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.apigateway import (
    ApiGatewayTestCase,
    verify_file_body,
    verify_request_body,
    verify_request_headers,
)
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.silo import control_silo_test
from sentry.utils import json

url_name = "sentry-api-0-projets"


@control_silo_test(cells=[ApiGatewayTestCase.CELL], include_monolith_run=True)
class ProxyTestCase(ApiGatewayTestCase):
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
        def request_callback(request: requests.PreparedRequest) -> tuple[int, dict[str, str], str]:
            assert request.headers.get(PROXY_APIGATEWAY_HEADER), (
                "Proxied requests should have a header added"
            )
            return 200, {"proxied": "yes"}, json.dumps({"success": True})

        responses.add_callback(
            responses.POST,
            "http://us.internal.sentry.io/post",
            request_callback,
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


CB_ENABLED = {
    "apigateway.proxy.circuit-breaker.enabled": True,
    "apigateway.proxy.circuit-breaker.enforce": True,
}


@control_silo_test(cells=[ApiGatewayTestCase.CELL])
class ProxyCircuitBreakerTestCase(ApiGatewayTestCase):
    def _make_breaker_mock(self, *, allow_request: bool) -> MagicMock:
        mock_breaker = MagicMock()
        mock_breaker.should_allow_request.return_value = allow_request
        return mock_breaker

    @responses.activate
    @override_options(CB_ENABLED)
    def test_open_circuit_returns_503(self) -> None:
        with patch("sentry.hybridcloud.apigateway.proxy.CircuitBreaker") as mock_breaker_class:
            mock_breaker_class.return_value = self._make_breaker_mock(allow_request=False)
            request = RequestFactory().get("http://sentry.io/get")
            resp = proxy_request(request, self.organization.slug, url_name)
        assert isinstance(resp, HttpResponse)
        assert resp.status_code == 503
        assert json.loads(resp.content) == {
            "error": "apigateway",
            "detail": "Downstream service temporarily unavailable",
        }

    @responses.activate
    @override_options(CB_ENABLED)
    def test_circuit_breaker_keyed_per_cell(self) -> None:
        with patch("sentry.hybridcloud.apigateway.proxy.CircuitBreaker") as mock_breaker_class:
            mock_breaker_class.return_value = self._make_breaker_mock(allow_request=False)
            request = RequestFactory().get("http://sentry.io/get")
            proxy_request(request, self.organization.slug, url_name)
        key_used = mock_breaker_class.call_args[0][0]
        assert key_used == f"apigateway.proxy.{self.CELL.name}"

    @responses.activate
    def test_circuit_breaker_disabled_by_default(self) -> None:
        with patch("sentry.hybridcloud.apigateway.proxy.CircuitBreaker") as mock_breaker_class:
            request = RequestFactory().get("http://sentry.io/get")
            proxy_request(request, self.organization.slug, url_name)
        mock_breaker_class.assert_not_called()

    @responses.activate
    @override_options(
        {
            "apigateway.proxy.circuit-breaker.enabled": True,
            "apigateway.proxy.circuit-breaker.enforce": False,
        }
    )
    def test_open_circuit_not_enforced(self) -> None:
        with patch("sentry.hybridcloud.apigateway.proxy.CircuitBreaker") as mock_breaker_class:
            mock_breaker_class.return_value = self._make_breaker_mock(allow_request=False)
            request = RequestFactory().get("http://sentry.io/get")
            resp = proxy_request(request, self.organization.slug, url_name)
        assert resp.status_code == 200

    @responses.activate
    @override_options({"apigateway.proxy.circuit-breaker.config": "invalid-lol", **CB_ENABLED})
    def test_handles_invalid_config(self) -> None:
        request = RequestFactory().get("http://sentry.io/get")
        res = proxy_request(request, self.organization.slug, url_name)
        assert res.status_code == 200

    @responses.activate
    @override_options(CB_ENABLED)
    def test_timeout_records_error(self) -> None:
        responses.add(
            responses.GET,
            f"{self.CELL.address}/timeout",
            body=Timeout(),
        )
        with patch("sentry.hybridcloud.apigateway.proxy.CircuitBreaker") as mock_breaker_class:
            mock_breaker = self._make_breaker_mock(allow_request=True)
            mock_breaker_class.return_value = mock_breaker
            request = RequestFactory().get("http://sentry.io/timeout")
            with pytest.raises(RequestTimeout):
                proxy_request(request, self.organization.slug, url_name)
        mock_breaker.record_error.assert_called_once()

    @responses.activate
    @override_options(CB_ENABLED)
    def test_5xx_response_records_error(self) -> None:
        responses.add(
            responses.GET,
            f"{self.CELL.address}/server-error",
            status=500,
            body=json.dumps({"detail": "internal server error"}),
            content_type="application/json",
        )
        with patch("sentry.hybridcloud.apigateway.proxy.CircuitBreaker") as mock_breaker_class:
            mock_breaker = self._make_breaker_mock(allow_request=True)
            mock_breaker_class.return_value = mock_breaker
            request = RequestFactory().get("http://sentry.io/server-error")
            resp = proxy_request(request, self.organization.slug, url_name)
        assert resp.status_code == 500
        mock_breaker.record_error.assert_called_once()

    @responses.activate
    @override_options(CB_ENABLED)
    def test_4xx_response_does_not_record_error(self) -> None:
        with patch("sentry.hybridcloud.apigateway.proxy.CircuitBreaker") as mock_breaker_class:
            mock_breaker = self._make_breaker_mock(allow_request=True)
            mock_breaker_class.return_value = mock_breaker
            request = RequestFactory().get("http://sentry.io/error")
            resp = proxy_request(request, self.organization.slug, url_name)
        assert resp.status_code == 400
        mock_breaker.record_error.assert_not_called()

    @responses.activate
    @override_options(CB_ENABLED)
    def test_2xx_response_does_not_record_error(self) -> None:
        with patch("sentry.hybridcloud.apigateway.proxy.CircuitBreaker") as mock_breaker_class:
            mock_breaker = self._make_breaker_mock(allow_request=True)
            mock_breaker_class.return_value = mock_breaker
            request = RequestFactory().get("http://sentry.io/get")
            resp = proxy_request(request, self.organization.slug, url_name)
        assert resp.status_code == 200
        mock_breaker.record_error.assert_not_called()

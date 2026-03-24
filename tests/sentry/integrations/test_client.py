import errno
import os
from unittest import TestCase, mock

import pytest
import responses
from requests import Response
from requests.exceptions import ConnectionError, HTTPError, Timeout
from requests.sessions import Session
from urllib3.exceptions import InvalidChunkLength
from urllib3.response import HTTPResponse

from sentry.integrations.client import ApiClient
from sentry.shared_integrations.exceptions import (
    ApiConnectionResetError,
    ApiError,
    ApiHostError,
    ApiTimeoutError,
)
from sentry.shared_integrations.response.base import BaseApiResponse


class ApiClientTest(TestCase):
    @responses.activate
    def test_get(self) -> None:
        responses.add(responses.GET, "http://example.com", json={})

        resp = ApiClient().get("http://example.com")
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

    @responses.activate
    def test_post(self) -> None:
        responses.add(responses.POST, "http://example.com", json={})

        resp = ApiClient().post("http://example.com")
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

    @responses.activate
    def test_delete(self) -> None:
        responses.add(responses.DELETE, "http://example.com", json={})

        resp = ApiClient().delete("http://example.com")
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

    @responses.activate
    def test_put(self) -> None:
        responses.add(responses.PUT, "http://example.com", json={})

        resp = ApiClient().put("http://example.com")
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

    @responses.activate
    def test_patch(self) -> None:
        responses.add(responses.PATCH, "http://example.com", json={})

        resp = ApiClient().patch("http://example.com")
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

    @mock.patch("sentry.shared_integrations.client.base.cache")
    @responses.activate
    def test_cache_mocked(self, cache: mock.MagicMock) -> None:
        cache.get.return_value = None
        responses.add(responses.GET, "http://example.com", json={"key": "value1"})
        resp = ApiClient().get_cached("http://example.com")
        assert resp == {"key": "value1"}

        key = "integration.undefined.client:41c2952996340270af611f0d7fad7286"
        cache.get.assert_called_with(key)
        cache.set.assert_called_with(key, {"key": "value1"}, 900)

    @responses.activate
    def test_get_cached_basic(self) -> None:
        responses.add(responses.GET, "http://example.com", json={"key": "value1"})

        resp = ApiClient().get_cached("http://example.com")
        assert resp == {"key": "value1"}
        assert len(responses.calls) == 1

        # should still return old value
        responses.replace(responses.GET, "http://example.com", json={"key": "value2"})
        resp = ApiClient().get_cached("http://example.com")
        assert resp == {"key": "value1"}
        assert len(responses.calls) == 1

        # make sure normal get isn't impacted
        resp = ApiClient().get("http://example.com")
        assert resp == {"key": "value2"}
        assert len(responses.calls) == 2

    @responses.activate
    def test_get_cached_query_param(self) -> None:
        responses.add(responses.GET, "http://example.com?param=val", json={})
        responses.add(responses.GET, "http://example.com?param=different", json={})

        ApiClient().get_cached("http://example.com", params={"param": "val"})
        assert len(responses.calls) == 1

        ApiClient().get_cached("http://example.com", params={"param": "val"})
        assert len(responses.calls) == 1

        ApiClient().get_cached("http://example.com", params={"param": "different"})
        assert len(responses.calls) == 2

    @responses.activate
    def test_head_cached_query_param(self) -> None:
        responses.add(responses.HEAD, "http://example.com?param=val", json={})
        responses.add(responses.HEAD, "http://example.com?param=different", json={})

        ApiClient().head_cached("http://example.com", params={"param": "val"})
        assert len(responses.calls) == 1

        ApiClient().head_cached("http://example.com", params={"param": "val"})
        assert len(responses.calls) == 1

        ApiClient().head_cached("http://example.com", params={"param": "different"})
        assert len(responses.calls) == 2

    @responses.activate
    def test_get_and_head_cached(self) -> None:
        # Same URL, different HTTP method
        url = "http://example.com"
        responses.add(
            responses.GET,
            url,
            json={"key": "response-for-get"},
            adding_headers={"x-method": "GET"},
        )
        responses.add(
            responses.HEAD,
            url,
            json={},
            adding_headers={"x-method": "HEAD"},
        )

        resp = ApiClient().head_cached(url)
        assert resp.headers["x-method"] == "HEAD"
        assert len(responses.calls) == 1

        resp = ApiClient().head_cached(url)
        assert resp.headers["x-method"] == "HEAD"
        assert len(responses.calls) == 1

        resp = ApiClient().get_cached(url, raw_response=True)
        assert resp.headers["x-method"] == "GET"
        assert resp.json() == {"key": "response-for-get"}
        assert len(responses.calls) == 2

        resp = ApiClient().get_cached(url, raw_response=True)
        assert resp.headers["x-method"] == "GET"
        assert resp.json() == {"key": "response-for-get"}
        assert len(responses.calls) == 2

    @responses.activate
    def test_default_redirect_behaviour(self) -> None:
        destination_url = "http://example.com/destination"
        destination_status = 202
        destination_headers = {"Location": destination_url}

        responses.add(responses.GET, destination_url, status=destination_status, json={})
        responses.add(responses.DELETE, destination_url, status=destination_status, json={})

        responses.add(
            responses.GET, "http://example.com/1", status=301, headers=destination_headers
        )
        resp = ApiClient().get("http://example.com/1")
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == destination_status

        # By default, non GET requests are not allowed to redirect
        responses.add(
            responses.DELETE,
            "http://example.com/2",
            status=301,
            headers=destination_headers,
            json={},
        )
        resp = ApiClient().delete("http://example.com/2")
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 301

        responses.add(
            responses.DELETE,
            "http://example.com/3",
            status=301,
            headers=destination_headers,
            json={},
        )
        resp = ApiClient().delete("http://example.com/3", allow_redirects=True)
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == destination_status

    def test_connection_error_handling(self) -> None:
        """
        Test handling of `ConnectionError`s raised by the `requests` library. (It's worth specifying
        because we also handle built-in `ConnectionError`s (specifically, `ConnectionResetError`s`).)
        """
        client = ApiClient()

        with mock.patch.object(
            client, "track_response_data", wraps=client.track_response_data
        ) as track_response_data_spy:
            with mock.patch(
                "requests.sessions.Session.send",
                side_effect=ConnectionError("foo"),
            ):
                with pytest.raises(ApiHostError):
                    client.get("http://example.com")
                    assert track_response_data_spy.call_args.args[0] == "connection_error"

    def test_timeout_handling(self) -> None:
        """Test handling of `Timeout` errors"""
        client = ApiClient()

        with mock.patch.object(
            client, "track_response_data", wraps=client.track_response_data
        ) as track_response_data_spy:
            with mock.patch(
                "requests.sessions.Session.send",
                side_effect=Timeout("foo"),
            ):
                with pytest.raises(ApiTimeoutError):
                    client.get("http://example.com")
                    assert track_response_data_spy.call_args.args[0] == "timeout"

    def test_http_error_handling_with_response(self) -> None:
        """
        Test handling of `HTTPError`s raised by the `requests` library. (It's worth specifying
        because we also handle `HTTPError`s (specifically, `InvalidChunkLength` errors) from `urllib3`.)
        """
        client = ApiClient()
        mock_error_response = Response()
        mock_error_response.status_code = 500

        with mock.patch.object(
            client, "track_response_data", wraps=client.track_response_data
        ) as track_response_data_spy:
            with mock.patch(
                "requests.sessions.Session.send",
                side_effect=HTTPError("foo", response=mock_error_response),
            ):
                with pytest.raises(ApiError):
                    client.get("http://example.com")
                    assert track_response_data_spy.call_args.args[0] == 500

    def test_http_error_handling_without_response(self) -> None:
        """
        Test handling of `HTTPError`s raised by the `requests` library. (It's worth specifying
        because we also handle `HTTPError`s (specifically, `InvalidChunkLength` errors) from `urllib3`.)
        """
        client = ApiClient()

        with mock.patch.object(
            client, "track_response_data", wraps=client.track_response_data
        ) as track_response_data_spy:
            with mock.patch(
                "requests.sessions.Session.send",
                side_effect=HTTPError("foo", response=None),
            ):
                with pytest.raises(ApiError):
                    client.get("http://example.com")
                    assert track_response_data_spy.call_args.args[0] == "unknown"

    def test_chained_connection_reset_error_handling(self) -> None:
        """Test handling of errors caused by `ConnectionResetError` errors"""
        client = ApiClient()

        with mock.patch.object(
            client, "track_response_data", wraps=client.track_response_data
        ) as track_response_data_spy:
            chained_error = ConnectionResetError(errno.ECONNRESET, "Connection reset by peer")
            caught_error = Exception(
                errno.ECONNRESET, 'ConnectionResetError(104, "Connection reset by peer")'
            )
            caught_error.__cause__ = chained_error

            with mock.patch(
                "requests.sessions.Session.send",
                side_effect=caught_error,
            ):
                with pytest.raises(ApiConnectionResetError):
                    client.get("http://example.com")
                    assert track_response_data_spy.call_args.args[0] == "connection_reset_error"

    def test_chained_invalid_chunk_length_error_handling(self) -> None:
        """Test handling of errors caused by `InvalidChunkLength` errors"""
        client = ApiClient()
        mock_error_response = HTTPResponse()

        with mock.patch.object(
            client, "track_response_data", wraps=client.track_response_data
        ) as track_response_data_spy:
            chained_error = InvalidChunkLength(mock_error_response, b"")
            caught_error = Exception(
                "Connection broken: InvalidChunkLength(got length b'', 0 bytes read)"
            )
            caught_error.__cause__ = chained_error

            with mock.patch(
                "requests.sessions.Session.send",
                side_effect=caught_error,
            ):
                with pytest.raises(ApiError):
                    client.get("http://example.com")
                    assert (
                        track_response_data_spy.call_args.args[0]
                        == "Connection broken: invalid chunk length"
                    )

    @responses.activate
    def test_verify_ssl_handling(self) -> None:
        """
        Test handling of `verify_ssl` parameter when setting REQUESTS_CA_BUNDLE.
        """
        responses.add(responses.GET, "https://example.com", json={})

        requests_ca_bundle = "/some/path/to/certs"

        with mock.patch.dict(os.environ, {"REQUESTS_CA_BUNDLE": requests_ca_bundle}):
            client = ApiClient()
            with mock.patch(
                "requests.sessions.Session.send", wraps=Session().send
            ) as session_send_mock:
                client.get("https://example.com")
                session_send_mock.assert_called_once_with(
                    mock.ANY,
                    timeout=30,
                    allow_redirects=True,
                    proxies={},
                    stream=False,
                    verify=requests_ca_bundle,
                    cert=None,
                )

    @responses.activate
    def test_track_response_data_logs_github_request_id(self) -> None:
        responses.add(
            responses.GET,
            "http://example.com",
            json={},
            headers={"X-GitHub-Request-Id": "abc-123"},
        )

        client = ApiClient()
        with mock.patch.object(client, "logger") as mock_logger:
            client.get("http://example.com")
            mock_logger.info.assert_called_once()
            extra = mock_logger.info.call_args.kwargs["extra"]
            assert extra["github_request_id"] == "abc-123"

    @responses.activate
    def test_track_response_data_logs_rate_limit_remaining(self) -> None:
        responses.add(
            responses.GET,
            "http://example.com",
            json={},
            headers={"X-RateLimit-Remaining": "42"},
        )

        client = ApiClient()
        with mock.patch.object(client, "logger") as mock_logger:
            client.get("http://example.com")
            extra = mock_logger.info.call_args.kwargs["extra"]
            assert extra["rate_limit_remaining"] == "42"

    @responses.activate
    def test_track_response_data_logs_retry_after(self) -> None:
        responses.add(
            responses.GET,
            "http://example.com",
            json={},
            status=429,
            headers={"Retry-After": "60"},
        )

        client = ApiClient()
        with mock.patch.object(client, "logger") as mock_logger:
            with pytest.raises(ApiError):
                client.get("http://example.com")
            extra = mock_logger.info.call_args.kwargs["extra"]
            assert extra["retry_after"] == "60"

    @responses.activate
    def test_track_response_data_logs_all_response_headers(self) -> None:
        responses.add(
            responses.GET,
            "http://example.com",
            json={},
            headers={
                "X-GitHub-Request-Id": "req-456",
                "X-RateLimit-Remaining": "10",
                "Retry-After": "30",
            },
        )

        client = ApiClient()
        with mock.patch.object(client, "logger") as mock_logger:
            client.get("http://example.com")
            extra = mock_logger.info.call_args.kwargs["extra"]
            assert extra["github_request_id"] == "req-456"
            assert extra["rate_limit_remaining"] == "10"
            assert extra["retry_after"] == "30"

    @responses.activate
    def test_track_response_data_omits_missing_headers(self) -> None:
        responses.add(responses.GET, "http://example.com", json={})

        client = ApiClient()
        with mock.patch.object(client, "logger") as mock_logger:
            client.get("http://example.com")
            extra = mock_logger.info.call_args.kwargs["extra"]
            assert "github_request_id" not in extra
            assert "rate_limit_remaining" not in extra
            assert "retry_after" not in extra

    @responses.activate
    def test_track_response_data_logs_headers_on_error_response(self) -> None:
        responses.add(
            responses.GET,
            "http://example.com",
            json={},
            status=403,
            headers={"X-GitHub-Request-Id": "err-789"},
        )

        client = ApiClient()
        with mock.patch.object(client, "logger") as mock_logger:
            with pytest.raises(ApiError):
                client.get("http://example.com")
            extra = mock_logger.info.call_args.kwargs["extra"]
            assert extra["github_request_id"] == "err-789"

    @responses.activate
    def test_parameters_passed_correctly(self) -> None:
        responses.add(responses.GET, "https://example.com", json={})
        client = ApiClient(verify_ssl=False)
        with mock.patch(
            "requests.sessions.Session.send", wraps=Session().send
        ) as session_send_mock:
            client.get("https://example.com", timeout=50, allow_redirects=False)
            session_send_mock.assert_called_once_with(
                mock.ANY,
                timeout=50,
                allow_redirects=False,
                proxies={},
                stream=False,
                verify=False,
                cert=None,
            )

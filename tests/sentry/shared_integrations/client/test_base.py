from unittest.mock import MagicMock, patch

import responses
from pytest import raises
from requests import PreparedRequest, Request

from sentry.exceptions import RestrictedIPAddress
from sentry.net.http import Session
from sentry.shared_integrations.client.base import BaseApiClient
from sentry.shared_integrations.exceptions import ApiHostError
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.socket import override_blocklist


class BaseApiClientTest(TestCase):
    """
    The BaseApiClient was created after ApiClient, so many tests can be found
    there instead (tests/sentry/integrations/test_client.py)
    """

    def setUp(self) -> None:
        class Client(BaseApiClient):
            integration_type = "integration"
            integration_name = "base"

        self.api_client = Client()

    @responses.activate
    @patch.object(BaseApiClient, "finalize_request", side_effect=lambda req: req)
    def test_finalize_request(self, mock_finalize_request) -> None:
        # Ensure finalize_request is called before all requests
        get_response = responses.add(responses.GET, "https://example.com/get", json={})
        assert not mock_finalize_request.called
        assert get_response.call_count == 0
        self.api_client.get("https://example.com/get")
        assert mock_finalize_request.called
        assert get_response.call_count == 1

        # Ensure finalize_request can modify the request prior to sending
        put_response = responses.add(responses.PUT, "https://example.com/put", json={})
        assert put_response.call_count == 0

        class TestClient(BaseApiClient):
            integration_type = "integration"
            integration_name = "test"

            def finalize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
                prepared_request.method = "PUT"
                prepared_request.url = "https://example.com/put"
                return prepared_request

        # Method and url are overridden in TestClient.finalize_request
        TestClient().get("https://example.com/get")
        assert get_response.call_count == 1
        assert put_response.call_count == 1

    @responses.activate
    def test__request_prepared_request(self) -> None:
        put_response = responses.add(responses.PUT, "https://example.com/put", json={})
        prepared_request = Request(method="PUT", url="https://example.com/put").prepare()
        # Client should use prepared request instead of using other params
        assert put_response.call_count == 0
        self.api_client.get("https://example.com/get", prepared_request=prepared_request)
        assert put_response.call_count == 1

    @responses.activate
    @patch.object(BaseApiClient, "finalize_request", side_effect=lambda req: req)
    @patch.object(Session, "send", side_effect=RestrictedIPAddress())
    @override_blocklist("172.16.0.0/12")
    def test_restricted_ip_address(self, mock_finalize_request, mock_session_send) -> None:
        assert not mock_finalize_request.called
        with raises(ApiHostError):
            self.api_client.get("https://172.31.255.255")
        assert mock_finalize_request.called

    @patch.object(Session, "send")
    def test_default_timeout(self, mock_session_send) -> None:
        response = MagicMock()
        response.status_code = 204
        mock_session_send.return_value = response

        self.api_client.get("https://172.31.255.255")
        assert mock_session_send.call_count == 1
        assert mock_session_send.mock_calls[0].kwargs["timeout"] == 30

    @patch.object(BaseApiClient, "track_response_data")
    @patch.object(Session, "send")
    def test_track_response_data_includes_integration_id(
        self, mock_session_send, mock_track_response_data
    ) -> None:
        response = MagicMock()
        response.status_code = 204
        mock_session_send.return_value = response

        class Client(BaseApiClient):
            integration_type = "integration"
            integration_name = "base"

        api_client = Client(integration_id=123)
        api_client.get("https://example.com/get")

        assert mock_track_response_data.call_count == 1
        assert mock_track_response_data.mock_calls[0].kwargs["extra"]["integration_id"] == "123"

    @patch("sentry.shared_integrations.client.base.metrics.incr")
    @patch.object(Session, "send")
    def test_request_and_response_metrics_include_api_request_type(
        self, mock_session_send, mock_metrics_incr
    ) -> None:
        response = MagicMock()
        response.status_code = 204
        mock_session_send.return_value = response

        self.api_client.get("https://example.com/get", api_request_type="compare_commits")

        mock_metrics_incr.assert_any_call(
            "None.http_request",
            sample_rate=1.0,
            tags={"integration": "base", "api_request_type": "compare_commits"},
        )
        mock_metrics_incr.assert_any_call(
            "None.http_response",
            sample_rate=1.0,
            tags={"integration": "base", "status": 204, "api_request_type": "compare_commits"},
        )

    @patch("sentry.shared_integrations.client.base.metrics.incr")
    def test_get_cached_emits_hit_metric(self, mock_metrics_incr) -> None:
        with patch.object(self.api_client, "check_cache", return_value={"cached": True}):
            self.api_client.get_cached("https://example.com/repos/example/repo/commits")

        mock_metrics_incr.assert_called_once_with(
            "None.get_cached",
            sample_rate=1.0,
            tags={"integration": "base", "api_request_type": "unknown", "result": "hit"},
        )

    @patch("sentry.shared_integrations.client.base.metrics.incr")
    def test_get_cached_emits_miss_metric(self, mock_metrics_incr) -> None:
        with (
            patch.object(self.api_client, "check_cache", return_value=None),
            patch.object(self.api_client, "request", return_value={"fresh": True}),
            patch.object(self.api_client, "set_cache"),
        ):
            self.api_client.get_cached("https://example.com/repos/example/repo/commits")

        mock_metrics_incr.assert_any_call(
            "None.get_cached",
            sample_rate=1.0,
            tags={"integration": "base", "api_request_type": "unknown", "result": "miss"},
        )

    @patch("sentry.shared_integrations.client.base.metrics.incr")
    def test_get_cached_emits_api_request_type_metric_tag(self, mock_metrics_incr) -> None:
        with patch.object(self.api_client, "check_cache", return_value={"cached": True}):
            self.api_client.get_cached(
                "https://example.com/repos/example/repo/commits",
                api_request_type="get_commits",
            )

        mock_metrics_incr.assert_called_once_with(
            "None.get_cached",
            sample_rate=1.0,
            tags={"integration": "base", "api_request_type": "get_commits", "result": "hit"},
        )

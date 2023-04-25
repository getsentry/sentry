from unittest.mock import patch

import responses
from requests import PreparedRequest, Request

from sentry.shared_integrations.client.base import BaseApiClient
from sentry.testutils import TestCase


class BaseApiClientTest(TestCase):
    """
    The BaseApiClient was created after ApiClient, so many tests can be found
    there instead (tests/sentry/integrations/test_client.py)
    """

    def setUp(self):
        self.url = "https://example.com"
        self.client = BaseApiClient()
        self.client.integration_type = "integration"
        self.client.integration_name = "base"

    @responses.activate
    @patch.object(BaseApiClient, "finalize_request", side_effect=lambda req: req)
    def test_finalize_request(self, mock_finalize_request):
        # Ensure finalize_request is called before all requests
        get_response = responses.add(responses.GET, "https://example.com/get", json={})
        assert not mock_finalize_request.called
        assert get_response.call_count == 0
        self.client.get("https://example.com/get")
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
    def test__request_prepared_request(self):
        put_response = responses.add(responses.PUT, "https://example.com/put", json={})
        prepared_request = Request(method="PUT", url="https://example.com/put").prepare()
        # Client should use prepared request instead of using other params
        assert put_response.call_count == 0
        self.client.get("https://example.com/get", prepared_request=prepared_request)
        assert put_response.call_count == 1

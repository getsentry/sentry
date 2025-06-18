from unittest.mock import MagicMock, patch

from django.urls import reverse
from rest_framework import status

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options


class BrowserReportingCollectorEndpointTest(APITestCase):
    endpoint = "sentry-api-0-reporting-api-experiment"

    def setUp(self):
        super().setUp()

        self.url = reverse(self.endpoint)
        self.report_data = {
            "age": 2,
            "body": {
                "columnNumber": 12,
                "id": "RangeExpand",
                "lineNumber": 31,
                "message": "Range.expand() is deprecated. Please use Selection.modify() instead.",
                "sourceFile": "https://dogs.are.great/_next/static/chunks/_4667019e._.js",
            },
            "type": "deprecation",
            "url": "https://dogs.are.great/",
            "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        }

    def test_404s_by_default(self):
        response = self.client.post(self.url, self.report_data)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @override_options({"issues.browser_reporting.collector_endpoint_enabled": True})
    @patch("sentry.issues.endpoints.browser_reporting_collector.metrics.incr")
    @patch("sentry.issues.endpoints.browser_reporting_collector.logger.info")
    def test_logs_request_data_if_option_enabled(
        self, mock_logger_info: MagicMock, mock_metrics_incr: MagicMock
    ):
        response = self.client.post(
            self.url, self.report_data, content_type="application/reports+json"
        )

        assert response.status_code == status.HTTP_200_OK
        mock_logger_info.assert_any_call(
            "browser_report_received", extra={"request_body": self.report_data}
        )
        mock_metrics_incr.assert_any_call(
            "browser_reporting.raw_report_received", tags={"type": self.report_data["type"]}
        )

    @override_options({"issues.browser_reporting.collector_endpoint_enabled": True})
    @patch("sentry.issues.endpoints.browser_reporting_collector.metrics.incr")
    def test_rejects_invalid_content_type(self, mock_metrics_incr: MagicMock):
        """Test that the endpoint rejects invalid content type and does not call the browser reporting metric"""
        response = self.client.post(self.url, self.report_data, content_type="bad/type/json")

        assert response.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
        # Verify that the browser_reporting.raw_report_received metric was not called
        # Check that none of the calls were for the browser_reporting.raw_report_received metric
        for call in mock_metrics_incr.call_args_list:
            assert call[0][0] != "browser_reporting.raw_report_received"

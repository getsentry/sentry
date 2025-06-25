from copy import deepcopy
from unittest.mock import MagicMock, patch

from django.urls import reverse
from rest_framework import status
from rest_framework.response import Response

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options

# Working Draft format
DEPRECATION_REPORT = {
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
    "destination": "default",
    "timestamp": 1640995200000,  # January 1, 2022 in milliseconds
    "attempts": 1,
}

# Editor's Draft format
INTERVENTION_REPORT = {
    "body": {
        "id": "NavigatorVibrate",
        "message": "The vibrate() method is deprecated.",
        "sourceFile": "https://dogs.are.great/app.js",
        "lineNumber": 45,
    },
    "type": "intervention",
    "url": "https://dogs.are.great/page2",
    "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
    "destination": "default",
    "age": 2,
    "attempts": 1,
}


class BrowserReportingCollectorEndpointTest(APITestCase):
    endpoint = "sentry-api-0-reporting-api-experiment"

    def setUp(self) -> None:
        super().setUp()

        self.url = reverse(self.endpoint)
        self.report_data = [DEPRECATION_REPORT]

    def assert_invalid_report_data(self, response: Response, details: dict[str, list[str]]) -> None:
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        response_data = response.json()  # type: ignore[attr-defined]
        assert response_data["error"] == "Invalid report data"
        assert response_data["details"] == details

    def test_404s_by_default(self) -> None:
        response = self.client.post(self.url, self.report_data)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @override_options({"issues.browser_reporting.collector_endpoint_enabled": True})
    @patch("sentry.issues.endpoints.browser_reporting_collector.metrics.incr")
    def test_basic(self, mock_metrics_incr: MagicMock) -> None:
        response = self.client.post(self.url, self.report_data)
        assert response.status_code == status.HTTP_200_OK
        mock_metrics_incr.assert_any_call(
            "browser_reporting.raw_report_received",
            tags={"browser_report_type": "deprecation"},
            sample_rate=1.0,
        )

    @override_options({"issues.browser_reporting.collector_endpoint_enabled": True})
    @patch("sentry.issues.endpoints.browser_reporting_collector.metrics.incr")
    def test_rejects_invalid_content_type(self, mock_metrics_incr: MagicMock) -> None:
        """Test that the endpoint rejects invalid content type and does not call the browser reporting metric"""
        response = self.client.post(self.url, self.report_data, content_type="bad/type/json")
        assert response.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
        # Verify that the browser_reporting.raw_report_received metric was not called
        # Check that none of the calls were for the browser_reporting.raw_report_received metric
        for call in mock_metrics_incr.call_args_list:
            assert call[0][0] != "browser_reporting.raw_report_received"

    @override_options({"issues.browser_reporting.collector_endpoint_enabled": True})
    @patch("sentry.issues.endpoints.browser_reporting_collector.metrics.incr")
    def test_handles_multiple_reports_both_specs(self, mock_metrics_incr: MagicMock) -> None:
        """Test that the endpoint handles multiple reports in a single request"""
        multiple_reports = [DEPRECATION_REPORT, INTERVENTION_REPORT]
        response = self.client.post(self.url, multiple_reports)
        assert response.status_code == status.HTTP_200_OK
        # Should record metrics for each report type
        mock_metrics_incr.assert_any_call(
            "browser_reporting.raw_report_received",
            tags={"browser_report_type": "deprecation"},
            sample_rate=1.0,
        )
        mock_metrics_incr.assert_any_call(
            "browser_reporting.raw_report_received",
            tags={"browser_report_type": "intervention"},
            sample_rate=1.0,
        )

    @override_options({"issues.browser_reporting.collector_endpoint_enabled": True})
    def test_rejects_missing_required_fields(self) -> None:
        """Test that missing required fields are properly validated"""
        report = deepcopy(DEPRECATION_REPORT)
        del report["user_agent"]
        response = self.client.post(self.url, [report])
        self.assert_invalid_report_data(response, {"user_agent": ["This field is required."]})

    @override_options({"issues.browser_reporting.collector_endpoint_enabled": True})
    def test_rejects_invalid_report_type(self) -> None:
        """Test that invalid report types are rejected"""
        report = deepcopy(DEPRECATION_REPORT)
        report["type"] = "invalid-type"
        response = self.client.post(self.url, [report])
        self.assert_invalid_report_data(
            response,
            {"type": ['"invalid-type" is not a valid choice.']},
        )

    @override_options({"issues.browser_reporting.collector_endpoint_enabled": True})
    def test_rejects_invalid_url(self) -> None:
        """Test that invalid URLs are rejected"""
        report = deepcopy(DEPRECATION_REPORT)
        report["url"] = "not-a-valid-url"
        response = self.client.post(self.url, [report])
        self.assert_invalid_report_data(response, {"url": ["Enter a valid URL."]})

    @override_options({"issues.browser_reporting.collector_endpoint_enabled": True})
    def test_rejects_invalid_timestamp(self) -> None:
        """Test that invalid timestamps are rejected"""
        report = deepcopy(DEPRECATION_REPORT)
        report["timestamp"] = -1
        response = self.client.post(self.url, [report])
        self.assert_invalid_report_data(
            response, {"timestamp": ["Ensure this value is greater than or equal to 0."]}
        )

    @override_options({"issues.browser_reporting.collector_endpoint_enabled": True})
    def test_optional_fields_not_required(self) -> None:
        """Test that reports missing the optional fields are accepted"""
        report = deepcopy(DEPRECATION_REPORT)
        del report["destination"]
        del report["attempts"]
        response = self.client.post(self.url, [report])
        assert response.status_code == status.HTTP_200_OK

    @override_options({"issues.browser_reporting.collector_endpoint_enabled": True})
    def test_rejects_invalid_attempts(self) -> None:
        """Test that invalid attempts values are rejected"""
        report = deepcopy(DEPRECATION_REPORT)
        report["attempts"] = 0
        response = self.client.post(self.url, [report])
        self.assert_invalid_report_data(
            response, {"attempts": ["Ensure this value is greater than or equal to 1."]}
        )

    @override_options({"issues.browser_reporting.collector_endpoint_enabled": True})
    def test_rejects_non_dict_body(self) -> None:
        """Test that non-dict body values are rejected"""
        report = deepcopy(DEPRECATION_REPORT)
        report["body"] = "not-a-dict"
        response = self.client.post(self.url, [report])
        self.assert_invalid_report_data(
            response,
            {"body": ['Expected a dictionary of items but got type "str".']},
        )

    @override_options({"issues.browser_reporting.collector_endpoint_enabled": True})
    def test_mixed_fields(self) -> None:
        """Test that mixed fields are rejected"""
        report = deepcopy(DEPRECATION_REPORT)
        report["age"] = 1
        response = self.client.post(self.url, [report])
        self.assert_invalid_report_data(
            response,
            {
                "age": ["If age is present, timestamp must be absent"],
                "timestamp": ["If timestamp is present, age must be absent"],
            },
        )

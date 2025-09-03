from sentry.monitors.validators import MONITOR_STATUSES_REVERSE, ObjectStatus
from sentry.testutils.cases import TestCase, UptimeTestCase
from sentry.uptime.endpoints.validators import (
    UptimeMonitorDataSourceValidator,
    compute_http_request_size,
)
from sentry.uptime.grouptype import UptimeSubscription


class ComputeHttpRequestSizeTest(UptimeTestCase):
    def test(self) -> None:
        assert (
            compute_http_request_size(
                "GET",
                "https://sentry.io",
                [("auth", "1234"), ("utf_text", "我喜欢哨兵正常运行时间监视器")],
                "some body stuff",
            )
            == 111
        )
        assert (
            compute_http_request_size(
                "GET",
                "https://sentry.io",
                # Test same number of characters but ascii instead
                [("auth", "1234"), ("non_utf_text", "abcdefghijklmn")],
                "some body stuff",
            )
            == 87
        )
        assert (
            compute_http_request_size(
                "GET",
                "https://sentry.io",
                # Test same number of characters but ascii instead
                [("auth", "1234"), ("non_utf_text", "abcdefghijklmn")],
                None,
            )
            == 70
        )


class UptimeMonitorDataSourceValidatorTest(TestCase):
    def setUp(self) -> None:
        self.valid_data = {
            "name": "Name",
            "status": MONITOR_STATUSES_REVERSE[ObjectStatus.ACTIVE],
            "owner": self.user.name,
            "environment": self.environment.name,
            "url": "https://www.google.com",
            "interval_seconds": UptimeSubscription.IntervalSeconds.ONE_MINUTE,
            "timeout_ms": 30000,
            "method": UptimeSubscription.SupportedHTTPMethods.GET,
            "headers": [],
            "trace_sampling": False,
            "body": None,
        }
        self.context = {
            "organization": self.project.organization,
            "project": self.project,
            "request": self.make_request(),
        }

    def test_simple(self) -> None:
        validator = UptimeMonitorDataSourceValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid()

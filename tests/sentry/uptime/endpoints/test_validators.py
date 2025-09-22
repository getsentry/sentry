from sentry.testutils.cases import TestCase, UptimeTestCase
from sentry.uptime.endpoints.validators import (
    UptimeMonitorDataSourceValidator,
    compute_http_request_size,
)
from sentry.uptime.models import UptimeSubscription


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
    def get_valid_data(self, **kwargs):
        return {
            "url": kwargs.get("url", "https://www.google.com"),
            "interval_seconds": kwargs.get(
                "interval_seconds", UptimeSubscription.IntervalSeconds.ONE_MINUTE
            ),
            "timeout_ms": kwargs.get("timeout_ms", 30000),
            "method": kwargs.get("method", UptimeSubscription.SupportedHTTPMethods.GET),
            "headers": kwargs.get("headers", []),
            "trace_sampling": kwargs.get("trace_sampling", False),
            "body": kwargs.get("body", None),
        }

    def setUp(self):
        self.context = {
            "organization": self.project.organization,
            "project": self.project,
            "request": self.make_request(),
        }

    def test_simple(self):
        validator = UptimeMonitorDataSourceValidator(
            data=self.get_valid_data(), context=self.context
        )
        assert validator.is_valid()

    def test_bad_interval(self):
        data = self.get_valid_data(interval_seconds=3700)
        validator = UptimeMonitorDataSourceValidator(data=data, context=self.context)
        assert not validator.is_valid()

    def test_bad_method(self):
        data = self.get_valid_data(method="GOT")
        validator = UptimeMonitorDataSourceValidator(data=data, context=self.context)
        assert not validator.is_valid()

    def test_too_many_urls(self):
        for _ in range(0, 100):
            self.create_uptime_subscription(
                url="https://www.google.com",
                interval_seconds=3600,
                timeout_ms=30000,
                url_domain="google",
                url_domain_suffix="com",
            )

        data = self.get_valid_data(url="https://www.google.com")
        validator = UptimeMonitorDataSourceValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert "You cannot create any additional alerts for this domain" in str(
            validator.errors["url"]
        )

    def test_too_big_request(self):
        data = self.get_valid_data(body="0" * 1000)
        validator = UptimeMonitorDataSourceValidator(data=data, context=self.context)
        assert not validator.is_valid()

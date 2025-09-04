from sentry.constants import ObjectStatus
from sentry.monitors.validators import MONITOR_STATUSES_REVERSE
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
    def get_valid_data(self):
        return {
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
        data = self.get_valid_data()
        data["interval_seconds"] = 3700
        validator = UptimeMonitorDataSourceValidator(data=data, context=self.context)
        assert not validator.is_valid()

    def test_bad_method(self):
        data = self.get_valid_data()
        data["method"] = "GOT"
        validator = UptimeMonitorDataSourceValidator(data=data, context=self.context)
        assert not validator.is_valid()

    def test_bad_status(self):
        data = self.get_valid_data()
        data["status"] = ["ready to work!"]
        validator = UptimeMonitorDataSourceValidator(data=data, context=self.context)
        assert not validator.is_valid()

    def test_too_many_urls(self):
        for _ in range(0, 100):
            UptimeSubscription.objects.create(
                url="https://www.google.com",
                interval_seconds=3600,
                timeout_ms=30000,
                status=UptimeSubscription.Status.CREATING.value,
                url_domain="google",
                url_domain_suffix="com",
            )

        data = self.get_valid_data()
        data["url"] = "https://www.google.com"
        validator = UptimeMonitorDataSourceValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert "You cannot create any additional alerts for this domain" in str(
            validator.errors["url"]
        )

    def test_too_big_request(self):
        data = self.get_valid_data()
        data["body"] = "0" * 1000
        validator = UptimeMonitorDataSourceValidator(data=data, context=self.context)
        assert not validator.is_valid()

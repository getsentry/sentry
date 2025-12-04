from unittest import mock

from sentry.constants import DataCategory
from sentry.quotas.base import SeatAssignmentResult
from sentry.testutils.cases import TestCase, UptimeTestCase
from sentry.uptime.endpoints.validators import (
    UptimeDomainCheckFailureValidator,
    UptimeMonitorDataSourceValidator,
    compute_http_request_size,
)
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.uptime.models import UptimeSubscription, get_uptime_subscription
from sentry.uptime.types import (
    DEFAULT_DOWNTIME_THRESHOLD,
    DEFAULT_RECOVERY_THRESHOLD,
    UptimeMonitorMode,
)
from sentry.utils.outcomes import Outcome


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


class UptimeDomainCheckFailureValidatorTest(UptimeTestCase):
    def setUp(self):
        super().setUp()
        self.context = {
            "organization": self.organization,
            "project": self.project,
            "request": self.make_request(user=self.user),
        }

    def get_valid_data(self, **kwargs):
        return {
            "name": kwargs.get("name", "Test Uptime Monitor"),
            "type": UptimeDomainCheckFailure.slug,
            "enabled": kwargs.get("enabled", True),
            "config": kwargs.get(
                "config",
                {
                    "mode": UptimeMonitorMode.MANUAL.value,
                    "environment": None,
                    "recovery_threshold": DEFAULT_RECOVERY_THRESHOLD,
                    "downtime_threshold": DEFAULT_DOWNTIME_THRESHOLD,
                },
            ),
            "dataSources": kwargs.get(
                "data_sources",
                [
                    {
                        "url": "https://sentry.io",
                        "intervalSeconds": 60,
                        "timeoutMs": 1000,
                    }
                ],
            ),
        }

    def test_rejects_multiple_data_sources(self):
        """Test that multiple data sources are rejected for uptime monitors."""
        data = self.get_valid_data(
            data_sources=[
                {
                    "url": "https://sentry.io",
                    "intervalSeconds": 60,
                    "timeoutMs": 1000,
                },
                {
                    "url": "https://example.com",
                    "intervalSeconds": 60,
                    "timeoutMs": 1000,
                },
            ]
        )
        validator = UptimeDomainCheckFailureValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert "dataSources" in validator.errors
        assert "Only one data source is allowed" in str(validator.errors["dataSources"])

    @mock.patch(
        "sentry.quotas.backend.assign_seat",
        return_value=Outcome.ACCEPTED,
    )
    def test_create_enabled_assigns_seat(self, mock_assign_seat: mock.MagicMock) -> None:
        """Test that creating an enabled detector assigns a billing seat."""
        validator = UptimeDomainCheckFailureValidator(
            data=self.get_valid_data(enabled=True), context=self.context
        )
        assert validator.is_valid(), validator.errors
        detector = validator.save()

        detector.refresh_from_db()
        assert detector.enabled is True

        # Verify seat was assigned
        mock_assign_seat.assert_called_with(DataCategory.UPTIME, detector)

    @mock.patch(
        "sentry.quotas.backend.assign_seat",
        return_value=Outcome.RATE_LIMITED,
    )
    def test_create_enabled_no_seat_available(self, mock_assign_seat: mock.MagicMock) -> None:
        """Test that creating a detector with no seats available creates it but leaves it disabled."""
        validator = UptimeDomainCheckFailureValidator(
            data=self.get_valid_data(enabled=True), context=self.context
        )
        assert validator.is_valid(), validator.errors
        detector = validator.save()

        detector.refresh_from_db()
        # Detector created but not enabled due to no seat assignment
        assert detector.enabled is False

        # Verify seat assignment was attempted
        mock_assign_seat.assert_called_with(DataCategory.UPTIME, detector)

        uptime_subscription = get_uptime_subscription(detector)
        assert uptime_subscription.status == UptimeSubscription.Status.DISABLED.value

    @mock.patch(
        "sentry.quotas.backend.assign_seat",
        return_value=Outcome.ACCEPTED,
    )
    def test_update_enable_assigns_seat(self, mock_assign_seat: mock.MagicMock) -> None:
        """Test that enabling a previously disabled detector assigns a seat."""
        # Create a disabled detector
        detector = self.create_uptime_detector(enabled=False)

        validator = UptimeDomainCheckFailureValidator(
            instance=detector, data={"enabled": True}, context=self.context, partial=True
        )
        assert validator.is_valid(), validator.errors
        validator.save()

        detector.refresh_from_db()
        assert detector.enabled is True

        # Verify seat was assigned
        mock_assign_seat.assert_called_with(DataCategory.UPTIME, detector)

        uptime_subscription = get_uptime_subscription(detector)
        assert uptime_subscription.status == UptimeSubscription.Status.ACTIVE.value

    @mock.patch(
        "sentry.quotas.backend.check_assign_seat",
        return_value=SeatAssignmentResult(assignable=False, reason="No seats available"),
    )
    def test_update_enable_no_seat_available(self, mock_check_assign_seat: mock.MagicMock) -> None:
        """Test that enabling fails with validation error when no seats are available."""
        # Create a disabled detector
        detector = self.create_uptime_detector(enabled=False)

        validator = UptimeDomainCheckFailureValidator(
            instance=detector, data={"enabled": True}, context=self.context, partial=True
        )

        # Validation should fail due to no seats available
        assert not validator.is_valid()
        assert "enabled" in validator.errors
        assert validator.errors["enabled"] == ["No seats available"]

        detector.refresh_from_db()
        # Detector should still be disabled
        assert detector.enabled is False

        # Verify seat availability check was performed
        mock_check_assign_seat.assert_called_with(DataCategory.UPTIME, detector)

    @mock.patch("sentry.quotas.backend.disable_seat")
    def test_update_disable_removes_seat(self, mock_disable_seat: mock.MagicMock) -> None:
        """Test that disabling a previously enabled detector removes the seat."""
        # Create an enabled detector
        detector = self.create_uptime_detector(enabled=True)

        validator = UptimeDomainCheckFailureValidator(
            instance=detector, data={"enabled": False}, context=self.context, partial=True
        )
        assert validator.is_valid(), validator.errors
        validator.save()

        detector.refresh_from_db()
        assert detector.enabled is False

        # Verify disable_seat was called
        mock_disable_seat.assert_called_with(DataCategory.UPTIME, detector)

        uptime_subscription = get_uptime_subscription(detector)
        assert uptime_subscription.status == UptimeSubscription.Status.DISABLED.value

    @mock.patch("sentry.quotas.backend.remove_seat")
    def test_delete_removes_seat(self, mock_remove_seat: mock.MagicMock) -> None:
        """Test that deleting a detector removes its billing seat immediately."""
        detector = self.create_uptime_detector(enabled=True)

        validator = UptimeDomainCheckFailureValidator(
            instance=detector, data={}, context=self.context
        )

        validator.delete()

        # Verify remove_seat was called immediately
        mock_remove_seat.assert_called_with(DataCategory.UPTIME, detector)

    @mock.patch(
        "sentry.quotas.backend.assign_seat",
        return_value=Outcome.ACCEPTED,
    )
    def test_update_no_enable_change_no_seat_call(self, mock_assign_seat: mock.MagicMock) -> None:
        """Test that updating without changing enabled status doesn't trigger seat operations."""
        # Create an enabled detector
        detector = self.create_uptime_detector(enabled=True)

        # Clear any previous mock calls from creation
        mock_assign_seat.reset_mock()

        validator = UptimeDomainCheckFailureValidator(
            instance=detector, data={"name": "Updated Name"}, context=self.context, partial=True
        )
        assert validator.is_valid(), validator.errors
        validator.save()

        detector.refresh_from_db()
        assert detector.name == "Updated Name"
        assert detector.enabled is True

        # Verify no seat operations were called
        mock_assign_seat.assert_not_called()

    def test_non_superuser_cannot_create_with_auto_detected_mode(self) -> None:
        """Test that non-superuser cannot create detector with AUTO_DETECTED mode."""
        data = self.get_valid_data(
            config={
                "mode": UptimeMonitorMode.AUTO_DETECTED_ACTIVE.value,
                "environment": None,
                "recovery_threshold": DEFAULT_RECOVERY_THRESHOLD,
                "downtime_threshold": DEFAULT_DOWNTIME_THRESHOLD,
            }
        )

        validator = UptimeDomainCheckFailureValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert validator.errors["config"] == ["Only superusers can modify `mode`"]

    def test_non_superuser_cannot_change_mode(self) -> None:
        """Test that non-superuser cannot change mode via update."""
        # Create a detector with MANUAL mode
        detector = self.create_uptime_detector(mode=UptimeMonitorMode.MANUAL)

        data = {
            "config": {
                "mode": UptimeMonitorMode.AUTO_DETECTED_ACTIVE.value,
                "environment": None,
                "recovery_threshold": DEFAULT_RECOVERY_THRESHOLD,
                "downtime_threshold": DEFAULT_DOWNTIME_THRESHOLD,
            }
        }

        validator = UptimeDomainCheckFailureValidator(
            instance=detector, data=data, context=self.context, partial=True
        )
        assert not validator.is_valid()
        assert validator.errors["config"] == ["Only superusers can modify `mode`"]

        # Verify mode was not changed
        detector.refresh_from_db()
        assert detector.config["mode"] == UptimeMonitorMode.MANUAL.value

    def test_non_superuser_can_update_with_same_mode(self) -> None:
        """Test that non-superuser can pass config if mode doesn't change."""
        # Create a detector with AUTO_DETECTED_ACTIVE mode (e.g., from autodetection)
        detector = self.create_uptime_detector(mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE)

        data = {
            "config": {
                "mode": UptimeMonitorMode.AUTO_DETECTED_ACTIVE.value,  # Same mode
                "environment": None,
                "recovery_threshold": DEFAULT_RECOVERY_THRESHOLD,
                "downtime_threshold": DEFAULT_DOWNTIME_THRESHOLD,
            }
        }

        validator = UptimeDomainCheckFailureValidator(
            instance=detector, data=data, context=self.context, partial=True
        )
        # Should be valid since mode hasn't changed
        assert validator.is_valid(), validator.errors

    def test_superuser_can_create_with_auto_detected_mode(self) -> None:
        """Test that superuser can create detector with AUTO_DETECTED mode."""
        superuser = self.create_user(is_superuser=True)
        self.context["request"] = self.make_request(user=superuser, is_superuser=True)

        data = self.get_valid_data(
            config={
                "mode": UptimeMonitorMode.AUTO_DETECTED_ACTIVE.value,
                "environment": None,
                "recovery_threshold": DEFAULT_RECOVERY_THRESHOLD,
                "downtime_threshold": DEFAULT_DOWNTIME_THRESHOLD,
            }
        )

        validator = UptimeDomainCheckFailureValidator(data=data, context=self.context)
        assert validator.is_valid(), validator.errors
        detector = validator.save()

        detector.refresh_from_db()
        assert detector.config["mode"] == UptimeMonitorMode.AUTO_DETECTED_ACTIVE.value

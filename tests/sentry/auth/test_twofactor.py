from unittest import mock

from django.core import mail

from sentry.auth.twofactor import (
    is_2fa_rate_limited,
    reset_2fa_rate_limits,
    send_2fa_rate_limit_notification,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TwoFactorRateLimitHelpersTest(TestCase):
    @mock.patch("sentry.auth.twofactor.ratelimiter.backend.is_limited", side_effect=[False, True])
    def test_rate_limits(self, is_limited: mock.MagicMock) -> None:
        assert is_2fa_rate_limited(123)
        assert is_limited.call_args_list == [
            mock.call("auth-2fa:user:123", limit=5, window=20),
            mock.call("auth-2fa-long:user:123", limit=20, window=60 * 60),
        ]

    @mock.patch("sentry.auth.twofactor.ratelimiter.backend.is_limited", side_effect=[True, False])
    def test_checks_long_rate_limit_when_short_rate_limit_is_reached(
        self, is_limited: mock.MagicMock
    ) -> None:
        assert is_2fa_rate_limited(123)
        assert is_limited.call_args_list == [
            mock.call("auth-2fa:user:123", limit=5, window=20),
            mock.call("auth-2fa-long:user:123", limit=20, window=60 * 60),
        ]

    @mock.patch("sentry.auth.twofactor.ratelimiter.backend.reset")
    def test_reset_rate_limits(self, reset: mock.MagicMock) -> None:
        reset_2fa_rate_limits(123)
        assert reset.call_args_list == [
            mock.call("auth-2fa:user:123", window=20),
            mock.call("auth-2fa-long:user:123", window=60 * 60),
        ]

    @mock.patch("sentry.auth.twofactor.ratelimiter.backend.is_limited", side_effect=[False, True])
    def test_notification_is_throttled(self, is_limited: mock.MagicMock) -> None:
        with self.tasks(), outbox_runner():
            send_2fa_rate_limit_notification(
                user_id=123,
                email="user@example.com",
                ip_address="127.0.0.1",
            )
            send_2fa_rate_limit_notification(
                user_id=123,
                email="user@example.com",
                ip_address="127.0.0.1",
            )

        assert is_limited.call_args_list == [
            mock.call("auth-2fa-failed-notification:user:123", limit=1, window=30 * 60),
            mock.call("auth-2fa-failed-notification:user:123", limit=1, window=30 * 60),
        ]
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ["user@example.com"]

from time import time
from unittest.mock import MagicMock, patch

from sentry.ratelimits.redis import RedisRateLimiter
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


class RedisRateLimiterTest(TestCase):
    def setUp(self) -> None:
        self.backend = RedisRateLimiter()

    def test_project_key(self) -> None:
        with freeze_time("2000-01-01"):
            assert not self.backend.is_limited("foo", 1, self.project)
            assert self.backend.is_limited("foo", 1, self.project)

    def test_simple_key(self) -> None:
        with freeze_time("2000-01-01"):
            assert not self.backend.is_limited("foo", 1)
            assert self.backend.is_limited("foo", 1)

    def test_correct_current_value(self) -> None:
        """Ensure that current_value get the correct value after the counter in incremented"""

        with freeze_time("2000-01-01"):
            for _ in range(10):
                self.backend.is_limited("foo", 100)

            assert self.backend.current_value("foo") == 10
            self.backend.is_limited("foo", 100)
            assert self.backend.current_value("foo") == 11

    def test_current_value_new_key(self) -> None:
        """current_value should return 0 for a new key"""

        assert self.backend.current_value("new") == 0

    def test_current_value_expire(self) -> None:
        """Ensure that the count resets when the window expires"""
        with freeze_time("2000-01-01") as frozen_time:
            for _ in range(10):
                self.backend.is_limited("foo", 1, window=10)
            assert self.backend.current_value("foo", window=10) == 10

            frozen_time.shift(10)
            assert self.backend.current_value("foo", window=10) == 0

    def test_is_limited_with_value(self) -> None:
        with freeze_time("2000-01-01") as frozen_time:
            expected_reset_time = int(time() + 5)

            limited, value, reset_time = self.backend.is_limited_with_value("foo", 1, window=5)
            assert not limited
            assert value == 1
            assert reset_time == expected_reset_time

            limited, value, reset_time = self.backend.is_limited_with_value("foo", 1, window=5)
            assert limited
            assert value == 2
            assert reset_time == expected_reset_time

            frozen_time.shift(5)
            limited, value, reset_time = self.backend.is_limited_with_value("foo", 1, window=5)
            assert not limited
            assert value == 1
            assert reset_time == expected_reset_time + 5

    def test_reset(self) -> None:
        with freeze_time("2000-01-01"):
            assert not self.backend.is_limited("foo", 1, self.project)
            assert self.backend.is_limited("foo", 1, self.project)
            self.backend.reset("foo", self.project)
            assert not self.backend.is_limited("foo", 1, self.project)

    def test_empty_pipeline_result(self) -> None:
        """Test that empty pipeline results are handled gracefully during cluster topology changes"""
        with freeze_time("2000-01-01"):
            # Mock the pipeline to return an empty list (simulating Redis Cluster topology issues)
            mock_pipeline = MagicMock()
            mock_pipeline.execute.return_value = []

            with patch.object(self.backend.client, "pipeline", return_value=mock_pipeline):
                # Should not raise IndexError and should return safe defaults
                is_limited, value, reset_time = self.backend.is_limited_with_value("foo", 1)
                assert not is_limited
                assert value == 0
                assert reset_time > 0  # Should still calculate a valid reset time

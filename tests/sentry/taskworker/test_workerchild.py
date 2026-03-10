from __future__ import annotations

import signal
import time

import pytest

from sentry.taskworker.workerchild import timeout_alarm


class AlarmFired(Exception):
    pass


class InnerFired(Exception):
    pass


class OuterFired(Exception):
    pass


class TestTimeoutAlarm:
    def setup_method(self):
        signal.alarm(0)
        signal.signal(signal.SIGALRM, signal.SIG_DFL)

    def teardown_method(self):
        signal.alarm(0)
        signal.signal(signal.SIGALRM, signal.SIG_DFL)

    def test_no_previous_alarm_no_alarm_after_exit(self):
        """With no outer alarm, no alarm remains after context exits."""
        with timeout_alarm(5, signal.SIG_DFL):
            pass

        remaining = signal.alarm(0)
        assert remaining == 0

    def test_handler_fires_after_timeout(self):
        called = []

        def handler(signum, frame):
            called.append(signum)
            raise AlarmFired()

        with pytest.raises(AlarmFired):
            with timeout_alarm(1, handler):
                time.sleep(5)

        assert called == [signal.SIGALRM]

    def test_raises_if_inner_geq_outer(self):
        """Raises ValueError when inner timeout >= outer remaining, fully restores outer alarm and handler."""
        outer_called = []

        def outer_handler(signum, frame):
            outer_called.append(signum)

        signal.signal(signal.SIGALRM, outer_handler)
        signal.alarm(10)

        with pytest.raises(ValueError, match="Inner timeout.*must be less than.*outer alarm"):
            with timeout_alarm(10, signal.SIG_DFL):
                pass

        # Outer alarm must still be active
        remaining = signal.alarm(0)
        assert remaining > 0, "Outer alarm should have been restored after ValueError"

        # Outer handler must be restored
        assert signal.getsignal(signal.SIGALRM) is outer_handler

    def test_nested_inner_fires_then_outer_fires(self):
        """Inner alarm (3s) fires first, then outer alarm (5s) fires ~2s later."""
        times: dict[str, float] = {}
        start = time.monotonic()

        def inner_handler(signum, frame):
            times["inner"] = time.monotonic()
            raise InnerFired()

        def outer_handler(signum, frame):
            times["outer"] = time.monotonic()
            raise OuterFired()

        with pytest.raises(OuterFired):
            with timeout_alarm(5, outer_handler):
                try:
                    with timeout_alarm(3, inner_handler):
                        time.sleep(10)
                except InnerFired:
                    # Inner fired and restored the outer alarm with ~2s remaining.
                    # Sleep again so the outer alarm can fire.
                    time.sleep(10)

        inner_elapsed = times["inner"] - start
        outer_elapsed = times["outer"] - start

        assert 2.5 <= inner_elapsed <= 5.0, f"Inner fired at {inner_elapsed:.2f}s, expected ~3s"
        assert 4.5 <= outer_elapsed <= 8.0, f"Outer fired at {outer_elapsed:.2f}s, expected ~5s"
        assert outer_elapsed > inner_elapsed, "Outer must fire after inner"

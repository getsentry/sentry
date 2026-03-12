from __future__ import annotations

import signal
import time
from collections.abc import Generator
from types import FrameType

import pytest

from sentry.taskworker.workerchild import timeout_alarm


class AlarmFired(Exception):
    pass


class InnerFired(Exception):
    pass


class OuterFired(Exception):
    pass


class TestTimeoutAlarm:
    @staticmethod
    def noop(signum: int, frame: FrameType | None) -> None:
        pass

    @pytest.fixture(autouse=True)
    def restore_signal_state(self) -> Generator[None]:
        # Save any existing timer (e.g. from pytest-timeout) and handler before the test.
        saved_remaining, saved_interval = signal.setitimer(signal.ITIMER_REAL, 0)
        saved_handler = signal.signal(signal.SIGALRM, signal.SIG_DFL)
        try:
            yield
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
            signal.signal(signal.SIGALRM, saved_handler)
            if saved_remaining > 0:
                signal.setitimer(signal.ITIMER_REAL, saved_remaining, saved_interval)

    def test_no_previous_alarm_no_alarm_after_exit(self) -> None:
        """With no outer alarm, no alarm remains after context exits."""
        with timeout_alarm(0.5, self.noop):
            pass

        remaining, _ = signal.getitimer(signal.ITIMER_REAL)
        assert remaining == 0

    def test_handler_fires_after_timeout(self) -> None:
        called = []

        def handler(signum: int, frame: FrameType | None) -> None:
            called.append(signum)
            raise AlarmFired()

        with pytest.raises(AlarmFired):
            with timeout_alarm(0.1, handler):
                time.sleep(1)

        assert called == [signal.SIGALRM]

    def test_raises_if_inner_geq_outer(self) -> None:
        """Raises ValueError when inner timeout >= outer remaining, fully restores outer timer and handler."""
        outer_called = []

        def outer_handler(signum: int, frame: FrameType | None) -> None:
            outer_called.append(signum)

        signal.signal(signal.SIGALRM, outer_handler)
        signal.setitimer(signal.ITIMER_REAL, 10)

        with pytest.raises(ValueError, match="Inner timeout.*must be less than.*outer alarm"):
            with timeout_alarm(10, self.noop):
                pass

        # Outer timer must still be active
        remaining, _ = signal.getitimer(signal.ITIMER_REAL)
        assert remaining > 0, "Outer timer should have been restored after ValueError"

        # Outer handler must be restored
        assert signal.getsignal(signal.SIGALRM) is outer_handler

    def test_outer_alarm_restored_after_inner_completes_normally(self) -> None:
        """When the inner timeout_alarm exits without firing, the outer alarm is still active."""

        def outer_handler(signum: int, frame: FrameType | None) -> None:
            pass

        with timeout_alarm(0.5, outer_handler):
            with timeout_alarm(0.3, self.noop):
                pass  # completes before inner alarm fires

            remaining, _ = signal.getitimer(signal.ITIMER_REAL)
            assert remaining > 0, "Outer alarm was not restored after inner exited normally"

        remaining, _ = signal.getitimer(signal.ITIMER_REAL)
        assert remaining == 0

    def test_outer_alarm_fires_with_minimal_gap(self) -> None:
        """
        With a 0.1s inner / 0.2s outer gap, the outer alarm is still restored and fires
        after the inner. Verifies the kernel-derived elapsed calculation
        (previous_remaining - seconds + remaining_inner) correctly restores the outer
        timer even when the gap between inner and outer is small.
        """
        times: dict[str, float] = {}
        start = time.monotonic()

        def inner_handler(signum: int, frame: FrameType | None) -> None:
            times["inner"] = time.monotonic()
            raise InnerFired()

        def outer_handler(signum: int, frame: FrameType | None) -> None:
            times["outer"] = time.monotonic()
            raise OuterFired()

        with pytest.raises(OuterFired):
            with timeout_alarm(0.2, outer_handler):
                try:
                    with timeout_alarm(0.1, inner_handler):
                        time.sleep(1)
                except InnerFired:
                    time.sleep(1)

        assert "outer" in times, "Outer alarm should have fired"
        outer_elapsed = times["outer"] - start
        assert 0.15 <= outer_elapsed <= 0.5, f"Outer fired at {outer_elapsed:.3f}s, expected ~0.2s"

    def test_nested_inner_fires_then_outer_fires(self) -> None:
        """Inner alarm (0.3s) fires first, then outer alarm (0.5s) fires ~0.2s later."""
        times: dict[str, float] = {}
        start = time.monotonic()

        def inner_handler(signum: int, frame: FrameType | None) -> None:
            times["inner"] = time.monotonic()
            raise InnerFired()

        def outer_handler(signum: int, frame: FrameType | None) -> None:
            times["outer"] = time.monotonic()
            raise OuterFired()

        with pytest.raises(OuterFired):
            with timeout_alarm(0.5, outer_handler):
                try:
                    with timeout_alarm(0.3, inner_handler):
                        time.sleep(10)
                except InnerFired:
                    # Inner fired and restored the outer alarm with ~0.2s remaining.
                    # Sleep again so the outer alarm can fire.
                    time.sleep(10)

        inner_elapsed = times["inner"] - start
        outer_elapsed = times["outer"] - start

        assert 0.2 <= inner_elapsed <= 0.5, f"Inner fired at {inner_elapsed:.3f}s, expected ~0.3s"
        assert 0.4 <= outer_elapsed <= 0.8, f"Outer fired at {outer_elapsed:.3f}s, expected ~0.5s"
        assert outer_elapsed > inner_elapsed, "Outer must fire after inner"

import contextlib
import signal
from types import FrameType
from typing import Callable, Generator


@contextlib.contextmanager
def timeout_alarm(
    seconds: float, handler: Callable[[int, FrameType | None], None]
) -> Generator[None]:
    """
    Context manager to handle SIGALRM handlers.

    Uses setitimer(ITIMER_REAL) for float-precision timeouts (delivers SIGALRM).

    To prevent tasks from consuming a worker forever, we set a timeout
    alarm that will interrupt tasks that run longer than
    their processing_deadline.

    When nested, the inner timeout must be strictly less than the outer alarm's
    remaining time. This ensures both handlers fire sequentially with correct
    semantics: the inner fires first, then the outer is restored and can fire
    later if execution continues. The outer alarm's remaining time is restored
    on exit, adjusted for elapsed time.
    """
    original_handler = signal.signal(signal.SIGALRM, handler)
    previous_remaining, _ = signal.setitimer(signal.ITIMER_REAL, seconds)

    if 0 < previous_remaining <= seconds:
        # Undo: restore original outer timer and handler before raising
        signal.setitimer(signal.ITIMER_REAL, previous_remaining)
        signal.signal(signal.SIGALRM, original_handler)
        raise ValueError(
            f"Inner timeout ({seconds}s) must be less than outer alarm remaining ({previous_remaining}s)"
        )
    try:
        yield
    finally:
        remaining_inner, _ = signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, original_handler)

        if previous_remaining > 0:
            # Restore original outer timer adjusted for elapsed time.
            # elapsed = seconds - remaining_inner, so outer restore = previous_remaining - seconds + remaining_inner.
            # This is always > 0: remaining_inner >= 0 and previous_remaining > seconds was enforced at entry.
            signal.setitimer(signal.ITIMER_REAL, previous_remaining - seconds + remaining_inner)

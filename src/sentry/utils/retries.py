from __future__ import annotations

import functools
import itertools
import logging
import math
import random
import time
from abc import ABC, abstractmethod
from collections.abc import Callable
from typing import TYPE_CHECKING, Any, ParamSpec, Protocol, TypeVar

if TYPE_CHECKING:
    from sentry.metrics.base import Tags

logger = logging.getLogger(__name__)


class RetryException(Exception):
    def __init__(self, message: str, exception: BaseException) -> None:
        super().__init__(message)
        self.message = message
        self.exception = exception

    def __reduce__(self) -> tuple[type[RetryException], tuple[str, BaseException]]:
        return RetryException, (self.message, self.exception)

    def __str__(self) -> str:
        return self.message

    def __repr__(self) -> str:
        return f"<{type(self).__name__}: {self.message!r}>"


T = TypeVar("T")
P = ParamSpec("P")


class _Clock(Protocol):
    def time(self) -> float: ...

    def sleep(self, secs: float, /) -> None: ...


class RetryPolicy(ABC):
    @abstractmethod
    def __call__(self, function: Callable[[], T]) -> T:
        raise NotImplementedError

    @classmethod
    def wrap(cls, *args: Any, **kwargs: Any) -> Callable[[Callable[P, T]], Callable[P, T]]:
        """
        A decorator that may be used to wrap a function to be retried using
        this policy.
        """
        retrier = cls(*args, **kwargs)

        def decorator(fn: Callable[P, T]) -> Callable[P, T]:
            @functools.wraps(fn)
            def execute_with_retry(*args: P.args, **kwargs: P.kwargs) -> T:
                return retrier(functools.partial(fn, *args, **kwargs))

            return execute_with_retry

        return decorator


def exponential_delay(duration: float) -> Callable[[int], float]:
    """
    Returns a simple exponential delay function that starts with the given
    duration.
    """

    def delay(attempt: int) -> float:
        return float(2 ** (attempt - 1)) * duration

    return delay


def sigmoid_delay(offset: int = -5, midpoint: int = 0, step: int = 1) -> Callable[[int], float]:
    """
    Returns an S-Curve function.

    A sigmoid is the intersection of these two behaviors:
        `while(true): retry() # immediate retry`
    and
        `while(true): sleep(1); retry() # static-wait then retry`

    The intersection of these two worlds is an exponential function which
    gradually ramps the program up to (or down to) a stable state (the s-curve).
    The sharpness of the curse is controlled with step. A step of 0 flattens the
    curve. A step of infinity turns the curve into a step change (a vertical
    line).

    The sigmoid is more difficult to intuit than a simple exponential delay but it
    allows you to cap the maximum amount of time you're willing to wait between
    retries. The cap is _always_ 1 second regardless of the value of the other
    arguments. If you want to wait longer than one second multiply the result of
    the function by something!

    Consider this program:
        [sigmoid_delay()(i) for i in range(-5, 5)]
    is equivalent to:
        [0.006, 0.017, 0.0474, 0.119, 0.268, 0.5, 0.731, 0.880, 0.952, 0.982]

    You get the same results with:
        [sigmoid_delay()(i) for i in range(10)]
    except the window has changed:
        [0.5, 0.731, 0.880, 0.952, 0.982, ...]

    Now you see further along the curve. This explains the utility of the `offset`
    parameter. The offset allows you to slide along the window. A smaller offset
    gives you faster retries. A larger offset gives you slower retries. An offset
    pushed too far past the midpoint reduces this function to a static wait.
    """

    def delay(attempt: int) -> float:
        return 1 / (1 + math.exp(-step * ((attempt + offset) - midpoint)))

    return delay


class ConditionalRetryPolicy(RetryPolicy):
    """
    A basic policy that can be used to retry a callable based on the result
    of a test function that determines whether or not to retry after the
    callable throws an exception.

    The test function takes two arguments: the number of times the callable
    has unsuccessfully been invoked, and the exception instance that was
    raised during the last execution attempt. This function is expected to
    return a boolean: if the value is ``True``, the callable will be retried;
    if the value is ``False``, the callable will not be retried and the
    exception thrown during the previous execution attempt will be raised.

    The delay function (if provided) takes one argument: the number of times
    the callable has unsuccessfully been invoked. This function is expected
    to return a float value: the number of seconds to wait before the next
    attempt. If the delay function is not provided, the callable will be
    immediately retried.
    """

    def __init__(
        self,
        test_function: Callable[[int, Exception], bool],
        delay_function: Callable[[int], float] | None = None,
    ) -> None:
        self.__test_function = test_function
        self.__delay_function = delay_function if delay_function is not None else lambda i: 0.0

    def __call__(self, function: Callable[[], T]) -> T:
        for i in itertools.count(1):
            try:
                return function()
            except Exception as e:
                if self.__test_function(i, e):
                    delay = self.__delay_function(i)
                    logger.warning(
                        "Caught %r while executing %r (attempt #%s), retrying in %f seconds...",
                        e,
                        function,
                        i,
                        delay,
                    )
                    time.sleep(delay)
                else:
                    raise

        assert False, "retry loop exited without returning"


def _jittered_delay(attempt: int) -> float:
    # 100ms +/- 50ms of randomized jitter
    return 0.1 + ((random.random() - 0.5) / 10)


class TimedRetryPolicy(RetryPolicy):
    """
    A time-based policy that can be used to retry a callable in the case of
    failure as many times as possible up to the ``timeout`` value (in seconds.)

    The ``delay`` function accepts one argument, a number which represents the
    number of this attempt (starting at 1.)
    """

    def __init__(
        self,
        timeout: float,
        delay: Callable[[int], float] | None = None,
        exceptions: type[Exception] | tuple[type[Exception], ...] = (Exception,),
        metric_instance: str | None = None,
        metric_tags: Tags | None = None,
        log_original_error: bool = False,
    ) -> None:
        self.timeout = timeout
        self.delay = delay if delay is not None else _jittered_delay
        self.exceptions = exceptions
        self.clock: _Clock = time
        self.metric_instance = metric_instance
        self.metric_tags: Tags = metric_tags or {}
        self.log_original_error = log_original_error

    def __call__(self, function: Callable[[], T]) -> T:
        start = self.clock.time()
        try:
            for i in itertools.count(1):
                try:
                    return function()
                except self.exceptions as error:
                    if self.log_original_error:
                        logger.info(error)
                    delay = self.delay(i)
                    now = self.clock.time()
                    if (now + delay) > (start + self.timeout):
                        raise RetryException(
                            "Could not successfully execute %r within %.3f seconds (%s attempts.)"
                            % (function, now - start, i),
                            error,
                        )
                    else:
                        logger.debug(
                            "Failed to execute %r due to %r on attempt #%s, retrying in %s seconds...",
                            function,
                            error,
                            i,
                            delay,
                        )
                        self.clock.sleep(delay)

            assert False, "retry loop exited without returning"
        finally:
            if self.metric_instance:
                from sentry.utils import metrics

                metrics.timing(
                    "timedretrypolicy.duration",
                    self.clock.time() - start,
                    instance=self.metric_instance,
                    tags=self.metric_tags,
                )

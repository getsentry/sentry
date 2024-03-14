import logging
import time
from collections.abc import MutableMapping
from typing import Any, Protocol

import sentry_sdk

logger = logging.getLogger(__name__)


class TimeoutException(BaseException):
    _elapsed: float
    _timeout: float

    def __init__(self, elapsed: float, timeout: float, *args: object) -> None:
        super().__init__(*args)
        self._elapsed = elapsed
        self._timeout = timeout


class BuildTimeChecker:
    """Interface to check whether a timeout has been hit.

    The class is initialized with the provided hard timeout, in seconds. If it's
    not bigger than `0`, no checks are performed.  Calling `check` checks the
    timeout, and raises a `TimeoutException` if it's hit. The timeout starts at
    the moment the class is initialized.
    """

    _hard_timeout: int | None
    _start: float

    def __init__(self, hard_timeout: int) -> None:
        if hard_timeout > 0:
            self._hard_timeout = hard_timeout
            self._start = time.monotonic()
        else:
            self._hard_timeout = None
            self._start = -1

    def check(self) -> None:
        if self._hard_timeout is None:
            return

        now = time.monotonic()
        elapsed = now - self._start
        if elapsed >= self._hard_timeout:
            raise TimeoutException(elapsed, self._hard_timeout)


class ExperimentalConfigBuilder(Protocol):
    def __call__(self, timeout: BuildTimeChecker, *args, **kwargs) -> Any:
        pass


#: Timeout for an experimental feature build, in seconds.
_FEATURE_BUILD_TIMEOUT = 15


def add_experimental_config(
    config: MutableMapping[str, Any],
    key: str,
    function: ExperimentalConfigBuilder,
    *args: Any,
    **kwargs: Any,
) -> None:
    """Try to set `config[key] = function(*args, **kwargs)`.
    If the result of the function call is None, the key is not set.
    If the function call raises an exception, we log it to sentry and the key remains unset.
    NOTE: Only use this function if you expect Relay to behave reasonably
    if ``key`` is missing from the config.
    """
    timeout = BuildTimeChecker(_FEATURE_BUILD_TIMEOUT)

    with sentry_sdk.start_span(op=f"project_config.experimental_config.{key}"):
        try:
            subconfig = function(timeout, *args, **kwargs)
        except TimeoutException as e:
            logger.exception(
                "Project config feature build timed out: %s",
                key,
                extra={"hard_timeout": e._timeout, "elapsed": e._elapsed},
            )
        except Exception:
            logger.exception("Exception while building Relay project config field")
        else:
            if subconfig is not None:
                config[key] = subconfig

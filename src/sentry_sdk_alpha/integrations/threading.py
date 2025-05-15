import sys
import warnings
from functools import wraps
from threading import Thread, current_thread

import sentry_sdk_alpha
from sentry_sdk_alpha import Scope
from sentry_sdk_alpha.scope import ScopeType
from sentry_sdk_alpha.integrations import Integration
from sentry_sdk_alpha.utils import (
    event_from_exception,
    capture_internal_exceptions,
    reraise,
)

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Any
    from typing import TypeVar
    from typing import Callable

    from sentry_sdk_alpha._types import ExcInfo

    F = TypeVar("F", bound=Callable[..., Any])


class ThreadingIntegration(Integration):
    identifier = "threading"

    def __init__(self, propagate_scope=True):
        # type: (bool) -> None
        self.propagate_scope = propagate_scope

    @staticmethod
    def setup_once():
        # type: () -> None
        old_start = Thread.start

        try:
            from django import VERSION as django_version  # noqa: N811
            import channels  # type: ignore[import-not-found]

            channels_version = channels.__version__
        except ImportError:
            django_version = None
            channels_version = None

        @wraps(old_start)
        def sentry_start(self, *a, **kw):
            # type: (Thread, *Any, **Any) -> Any
            integration = sentry_sdk_alpha.get_client().get_integration(ThreadingIntegration)
            if integration is None:
                return old_start(self, *a, **kw)

            if integration.propagate_scope:
                if (
                    sys.version_info < (3, 9)
                    and channels_version is not None
                    and channels_version < "4.0.0"
                    and django_version is not None
                    and django_version >= (3, 0)
                    and django_version < (4, 0)
                ):
                    warnings.warn(
                        "There is a known issue with Django channels 2.x and 3.x when using Python 3.8 or older. "
                        "(Async support is emulated using threads and some Sentry data may be leaked between those threads.) "
                        "Please either upgrade to Django channels 4.0+, use Django's async features "
                        "available in Django 3.1+ instead of Django channels, or upgrade to Python 3.9+.",
                        stacklevel=2,
                    )
                    isolation_scope = sentry_sdk_alpha.get_isolation_scope()
                    current_scope = sentry_sdk_alpha.get_current_scope()

                else:
                    isolation_scope = sentry_sdk_alpha.get_isolation_scope().fork()
                    current_scope = sentry_sdk_alpha.get_current_scope().fork()
            else:
                isolation_scope = Scope(ty=ScopeType.ISOLATION)
                current_scope = Scope(ty=ScopeType.CURRENT)

            # Patching instance methods in `start()` creates a reference cycle if
            # done in a naive way. See
            # https://github.com/getsentry/sentry-python/pull/434
            #
            # In threading module, using current_thread API will access current thread instance
            # without holding it to avoid a reference cycle in an easier way.
            with capture_internal_exceptions():
                new_run = _wrap_run(
                    isolation_scope,
                    current_scope,
                    getattr(self.run, "__func__", self.run),
                )
                self.run = new_run  # type: ignore

            return old_start(self, *a, **kw)

        Thread.start = sentry_start  # type: ignore


def _wrap_run(isolation_scope_to_use, current_scope_to_use, old_run_func):
    # type: (sentry_sdk.Scope, sentry_sdk.Scope, F) -> F
    @wraps(old_run_func)
    def run(*a, **kw):
        # type: (*Any, **Any) -> Any
        def _run_old_run_func():
            # type: () -> Any
            try:
                self = current_thread()
                return old_run_func(self, *a, **kw)
            except Exception:
                reraise(*_capture_exception())

        with sentry_sdk_alpha.use_isolation_scope(isolation_scope_to_use):
            with sentry_sdk_alpha.use_scope(current_scope_to_use):
                return _run_old_run_func()

    return run  # type: ignore


def _capture_exception():
    # type: () -> ExcInfo
    exc_info = sys.exc_info()

    client = sentry_sdk_alpha.get_client()
    if client.get_integration(ThreadingIntegration) is not None:
        event, hint = event_from_exception(
            exc_info,
            client_options=client.options,
            mechanism={"type": "threading", "handled": False},
        )
        sentry_sdk_alpha.capture_event(event, hint=hint)

    return exc_info

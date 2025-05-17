from typing import TYPE_CHECKING

import sentry_sdk_alpha
from sentry_sdk_alpha.integrations import DidNotEnable, Integration
from sentry_sdk_alpha.utils import capture_internal_exceptions, event_from_exception

if TYPE_CHECKING:
    from collections.abc import Callable
    from types import TracebackType
    from typing import Any, Optional, Type

    Excepthook = Callable[
        [type[BaseException], BaseException, Optional[TracebackType]],
        Any,
    ]

try:
    import typer
except ImportError:
    raise DidNotEnable("Typer not installed")


class TyperIntegration(Integration):
    identifier = "typer"

    @staticmethod
    def setup_once():
        # type: () -> None
        typer.main.except_hook = _make_excepthook(typer.main.except_hook)  # type: ignore


def _make_excepthook(old_excepthook):
    # type: (Excepthook) -> Excepthook
    def sentry_sdk_excepthook(type_, value, traceback):
        # type: (Type[BaseException], BaseException, Optional[TracebackType]) -> None
        integration = sentry_sdk_alpha.get_client().get_integration(TyperIntegration)

        # Note: If we replace this with ensure_integration_enabled then
        # we break the exceptiongroup backport;
        # See: https://github.com/getsentry/sentry-python/issues/3097
        if integration is None:
            return old_excepthook(type_, value, traceback)

        with capture_internal_exceptions():
            event, hint = event_from_exception(
                (type_, value, traceback),
                client_options=sentry_sdk_alpha.get_client().options,
                mechanism={"type": "typer", "handled": False},
            )
            sentry_sdk_alpha.capture_event(event, hint=hint)

        return old_excepthook(type_, value, traceback)

    return sentry_sdk_excepthook

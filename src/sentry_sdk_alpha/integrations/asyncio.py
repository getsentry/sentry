import sys

import sentry_sdk_alpha
from sentry_sdk_alpha.consts import OP
from sentry_sdk_alpha.integrations import Integration, DidNotEnable
from sentry_sdk_alpha.utils import event_from_exception, logger, reraise

try:
    import asyncio
    from asyncio.tasks import Task
except ImportError:
    raise DidNotEnable("asyncio not available")

from typing import cast, TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Any
    from collections.abc import Coroutine

    from sentry_sdk_alpha._types import ExcInfo


def get_name(coro):
    # type: (Any) -> str
    return (
        getattr(coro, "__qualname__", None)
        or getattr(coro, "__name__", None)
        or "coroutine without __name__"
    )


def patch_asyncio():
    # type: () -> None
    orig_task_factory = None
    try:
        loop = asyncio.get_running_loop()
        orig_task_factory = loop.get_task_factory()

        def _sentry_task_factory(loop, coro, **kwargs):
            # type: (asyncio.AbstractEventLoop, Coroutine[Any, Any, Any], Any) -> asyncio.Future[Any]

            async def _task_with_sentry_span_creation():
                # type: () -> Any
                result = None

                with sentry_sdk_alpha.isolation_scope():
                    with sentry_sdk_alpha.start_span(
                        op=OP.FUNCTION,
                        name=get_name(coro),
                        origin=AsyncioIntegration.origin,
                        only_if_parent=True,
                    ):
                        try:
                            result = await coro
                        except Exception:
                            reraise(*_capture_exception())

                return result

            task = None

            # Trying to use user set task factory (if there is one)
            if orig_task_factory:
                task = orig_task_factory(
                    loop, _task_with_sentry_span_creation(), **kwargs
                )

            if task is None:
                # The default task factory in `asyncio` does not have its own function
                # but is just a couple of lines in `asyncio.base_events.create_task()`
                # Those lines are copied here.

                # WARNING:
                # If the default behavior of the task creation in asyncio changes,
                # this will break!
                task = Task(_task_with_sentry_span_creation(), loop=loop, **kwargs)
                if task._source_traceback:  # type: ignore
                    del task._source_traceback[-1]  # type: ignore

            # Set the task name to include the original coroutine's name
            try:
                cast("asyncio.Task[Any]", task).set_name(
                    f"{get_name(coro)} (Sentry-wrapped)"
                )
            except AttributeError:
                # set_name might not be available in all Python versions
                pass

            return task

        loop.set_task_factory(_sentry_task_factory)  # type: ignore

    except RuntimeError:
        # When there is no running loop, we have nothing to patch.
        logger.warning(
            "There is no running asyncio loop so there is nothing Sentry can patch. "
            "Please make sure you call sentry_sdk.init() within a running "
            "asyncio loop for the AsyncioIntegration to work. "
            "See https://docs.sentry.io/platforms/python/integrations/asyncio/"
        )


def _capture_exception():
    # type: () -> ExcInfo
    exc_info = sys.exc_info()

    client = sentry_sdk_alpha.get_client()

    integration = client.get_integration(AsyncioIntegration)
    if integration is not None:
        event, hint = event_from_exception(
            exc_info,
            client_options=client.options,
            mechanism={"type": "asyncio", "handled": False},
        )
        sentry_sdk_alpha.capture_event(event, hint=hint)

    return exc_info


class AsyncioIntegration(Integration):
    identifier = "asyncio"
    origin = f"auto.function.{identifier}"

    @staticmethod
    def setup_once():
        # type: () -> None
        patch_asyncio()

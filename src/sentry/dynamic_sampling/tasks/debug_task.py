import logging

import sentry_sdk
from sentry_sdk import capture_exception

from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.debug_task",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,
    time_limit=2 * 60 * 60 + 5,
    silo_mode=SiloMode.REGION,
)
def debug_task() -> None:
    logger.error("Debug Task")
    for i in range(100):
        with sentry_sdk.start_span(
            op="spawn-child",
            description="spawning child task",
        ):
            child_task.delay()
    try:
        raise ValueError("Debug Task Error")
    except Exception as e:
        capture_exception(e)


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.child_task",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=2 * 60 * 60,
    time_limit=2 * 60 * 60 + 5,
    silo_mode=SiloMode.REGION,
)
def child_task() -> None:

    logger.error("Child Task")
    with sentry_sdk.start_span(
        op="main",
        description="main child task",
    ):
        do_some_db_stuff()
        call_some_service()

    try:
        raise ValueError("Child task Error")
    except Exception as e:
        capture_exception(e)


def do_some_db_stuff():
    with sentry_sdk.start_span(
        op="db",
        description="doing some db stuff",
    ):
        pass  # calling db


def call_some_service():
    with sentry_sdk.start_span(
        op="http",
        description="doing some db stuff",
    ):
        pass  # calling service

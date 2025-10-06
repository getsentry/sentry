import logging
from collections.abc import Generator, Mapping
from contextlib import contextmanager
from typing import Any

import sentry_sdk

from sentry.taskworker.state import current_task
from sentry.taskworker.workerchild import ProcessingDeadlineExceeded

logger = logging.getLogger(__name__)


# sentry_sdk doesn't export these.
_Event = Any
_ExcInfo = Any


@contextmanager
def exception_grouping_context(
    exception_mapping: Mapping[type[BaseException], str], *refinements: str
) -> Generator[None]:
    """
    Context manager that ensures specified exceptions are grouped together on the task level
    using custom fingerprint prefixes.

    Args:
        exception_mapping: Mapping from exception types to their fingerprint prefix strings
        refinements: Additional refinement strings to append to the fingerprint
    """
    task_state = current_task()
    if task_state:

        def process_error(event: _Event, exc_info: _ExcInfo) -> _Event | None:
            exc = exc_info[1]
            for exc_type, fingerprint_prefix in exception_mapping.items():
                if isinstance(exc, exc_type):
                    event["fingerprint"] = [
                        fingerprint_prefix,
                        task_state.namespace,
                        task_state.taskname,
                        *refinements,
                    ]
                    break
            return event

        with sentry_sdk.new_scope() as scope:
            scope.add_error_processor(process_error)
            yield
    else:
        logger.info("No task state found in exception_grouping_context")
        yield


@contextmanager
def timeout_grouping_context(*refinements: str) -> Generator[None]:
    """
    Context manager that ensures that ProcessingDeadlineExceeded errors are grouped together on the task level.
    Grouping based on specific stacktrace is usually inappropriate because once we've past the deadline, any
    subsequent line of code executed may be running when it is raised.
    Defaulting to grouping by task is more accurate, and where there's a need to subdivide that, we
    offer the ability to refine.
    """
    with exception_grouping_context(
        {ProcessingDeadlineExceeded: "task.processing_deadline_exceeded"}, *refinements
    ):
        yield

import logging
from collections.abc import Generator
from contextlib import contextmanager

import sentry_sdk

from sentry.taskworker.state import current_task
from sentry.taskworker.workerchild import ProcessingDeadlineExceeded

logger = logging.getLogger(__name__)


@contextmanager
def timeout_grouping_context(*refinements: str) -> Generator[None]:
    """
    Context manager that ensures that ProcessingDeadlineExceeded errors are grouped together on the task level.
    Grouping based on specific stacktrace is usually inappropriate because once we've past the deadline, any
    subsequent line of code executed may be running when it is raised.
    Defaulting to grouping by task is more accurate, and where there's a need to subdivide that, we
    offer the ability to refine.
    """
    task_state = current_task()
    if task_state:

        def process_error(event, exc_info):
            exc = exc_info[1]
            if isinstance(exc, ProcessingDeadlineExceeded):
                event["fingerprint"] = [
                    "task.processing_deadline_exceeded",
                    task_state.namespace,
                    task_state.taskname,
                    *refinements,
                ]
            return event

        with sentry_sdk.new_scope() as scope:
            scope.add_error_processor(process_error)
            yield
    else:
        logger.info("No task state found in timeout_grouping_context")
        yield

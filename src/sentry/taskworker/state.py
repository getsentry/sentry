import dataclasses
import threading

from django.conf import settings
from sentry_protos.taskbroker.v1.taskbroker_pb2 import TaskActivation

if settings.TASKWORKER_USE_LIBRARY:
    from taskbroker_client.state import (
        CurrentTaskState,  # type: ignore[assignment]
        clear_current_task,  # type: ignore[assignment]
        current_task,  # type: ignore[assignment]
        set_current_task,  # type: ignore[assignment]
    )

    __all__ = ["CurrentTaskState", "clear_current_task", "current_task", "set_current_task"]
else:
    _current_state = threading.local()

    @dataclasses.dataclass
    class CurrentTaskState:  # type: ignore[no-redef]
        id: str
        namespace: str
        taskname: str
        attempt: int
        processing_deadline_duration: int
        retries_remaining: bool

    def current_task() -> CurrentTaskState | None:
        if not hasattr(_current_state, "state"):
            _current_state.state = None

        return _current_state.state

    def set_current_task(activation: TaskActivation) -> None:
        retry_state = activation.retry_state
        state = CurrentTaskState(
            id=activation.id,
            namespace=activation.namespace,
            taskname=activation.taskname,
            attempt=activation.retry_state.attempts,
            # We subtract one, as attempts starts at 0, but `max_attempts`
            # starts at 1.
            retries_remaining=(retry_state.attempts < (retry_state.max_attempts - 1)),
            processing_deadline_duration=activation.processing_deadline_duration,
        )
        _current_state.state = state

    def clear_current_task() -> None:
        _current_state.state = None

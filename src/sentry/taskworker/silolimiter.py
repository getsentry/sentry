from collections.abc import Callable, Iterable
from typing import Any, cast

from sentry.silo.base import SiloLimit, SiloMode
from sentry.taskworker.task import P, R, Task


class TaskSiloLimit(SiloLimit):
    """
    Silo limiter for tasks

    We don't want tasks to be spawned in the incorrect silo.
    We can't reliably cause tasks to fail as not all tasks use
    the ORM (which also has silo bound safety).
    """

    def handle_when_unavailable(
        self,
        original_method: Callable[P, R],
        current_mode: SiloMode,
        available_modes: Iterable[SiloMode],
    ) -> Callable[P, R]:
        def handle(*args: P.args, **kwargs: P.kwargs) -> Any:
            name = original_method.__name__
            message = f"Cannot call or spawn {name} in {current_mode},"
            raise self.AvailabilityError(message)

        return handle

    def __call__(self, decorated_task: Task[P, R]) -> Task[P, R]:
        # Replace the sentry.taskworker.Task interface used to schedule tasks.
        replacements = {"delay", "apply_async"}
        for attr_name in replacements:
            task_attr = getattr(decorated_task, attr_name)
            if callable(task_attr):
                limited_attr = self.create_override(task_attr)
                setattr(decorated_task, attr_name, limited_attr)

        limited_func = self.create_override(decorated_task)

        # Task attributes are copied by functools.update_wrapper
        # Task properties (@property) are not, so we must explicitly copy them
        # as attributes. These are accessed by the scheduler and other code.
        limited_func.fullname = decorated_task.fullname
        limited_func.namespace = decorated_task.namespace
        limited_func.retry = decorated_task.retry

        # Cast limited_func as the super class type is just Callable, but we
        # know here we have Task instances.
        limited_task = cast(Task[P, R], limited_func)

        return limited_task

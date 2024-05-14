#!/usr/bin/env python -i
#
# NOTE: when started with "python", this script is meant to be used in "interactive" mode:
#   python -i SCRIPT
#
import enum
import inspect as insp
import sys
from collections.abc import Generator

control = None
inspect = None

_initialized = False


HELP = """
Initialized objects:

    control <celery.app.control.Control>
        Docs: https://docs.celeryq.dev/en/stable/reference/celery.app.control.html#celery.app.control.Control
    inspect <celery.app.control.Inspect>
        Docs: https://docs.celeryq.dev/en/stable/reference/celery.app.control.html#celery.app.control.Inspect

Functions:

{functions_help}
"""


class TaskStatus(enum.Enum):
    ACTIVE = enum.auto()
    SCHEDULED = enum.auto()
    RESERVED = enum.auto()


def _ensure_initialized():
    if not _initialized:
        print("!!! The Sentry/Celery apps are not initialized! Run init_sentry() function.")  # NOQA
        sys.exit(1)


def _get_tasks_by_status(status: TaskStatus) -> dict:
    _ensure_initialized()

    res = {}
    if status == TaskStatus.ACTIVE:
        res = inspect.active()
    elif status == TaskStatus.SCHEDULED:
        res = inspect.scheduled()
    elif status == TaskStatus.RESERVED:
        res = inspect.reserved()
    return res or {}


def _get_task_ids_by_name_and_status(
    task_name: str, status: TaskStatus
) -> Generator[str, None, None]:
    if not task_name:
        raise ValueError("Invalid task_name: %f", task_name)

    worker_to_task_map = _get_tasks_by_status(status)
    for worker_id, tasks in worker_to_task_map.items():
        for task in tasks:
            if task["name"] == task_name:
                yield task["id"]


def get_active_task_ids_by_name(task_name: str) -> Generator[str, None, None]:
    """Get IDs of all active (running) tasks by a task name"""
    return _get_task_ids_by_name_and_status(task_name, TaskStatus.ACTIVE)


def get_scheduled_task_ids_by_name(task_name: str) -> Generator[str, None, None]:
    """Get IDs of all scheduled tasks by a task name"""
    return _get_task_ids_by_name_and_status(task_name, TaskStatus.SCHEDULED)


def get_reserved_task_ids_by_name(task_name: str) -> Generator[str, None, None]:
    """Get IDs of all reserved tasks by a task name"""
    return _get_task_ids_by_name_and_status(task_name, TaskStatus.RESERVED)


def revoke_active_tasks_by_name(task_name: str, dry_run: bool = False):
    """Revoke all tasks with the given name. Dangerous!"""

    _ensure_initialized()

    task_ids = get_active_task_ids_by_name(task_name)

    num = 0
    for task_id in task_ids:
        if not dry_run:
            # Technically, revoke() can accept a list of IDs
            control.revoke(task_ids)
        num += 1
    print(f"!!!{'[dry-run]' if dry_run else ''} Revoked tasks: {num}")  # NOQA


def generate_help() -> str:
    functions_help = ""
    for func in [
        get_active_task_ids_by_name,
        get_scheduled_task_ids_by_name,
        get_reserved_task_ids_by_name,
        revoke_active_tasks_by_name,
    ]:
        functions_help += f"    {func.__name__} - {func.__doc__}\n"
        functions_help += f"        {insp.signature(func)}\n\n"
    return HELP.format(functions_help=functions_help)


def init_sentry():
    global control
    global inspect
    global _initialized

    from sentry.runner import configure

    print("!!! Initializing Sentry app...")  # NOQA
    configure()

    from sentry.celery import app

    control = app.control
    inspect = control.inspect()

    _initialized = True


def main() -> None:
    init_sentry()
    print("!!! Celery shell initialized!")  # NOQA
    print(generate_help())  # NOQA


if __name__ == "__main__":
    main()

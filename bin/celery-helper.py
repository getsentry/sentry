#!/usr/bin/env python -i
#
# NOTE: this script is meant to be used in "interactive" mode:
#   python -i SCRIPT
#
import sys
from collections.abc import Generator
from enum import Enum

control = None
inspect = None

_initialized = False


class TaskStatus(Enum):
    ACTIVE = 0
    SCHEDULED = 1
    RESERVED = 2


def _ensure_initialized():
    if not _initialized:
        print(">>> The app is not initialized! Run init_sentry() function.")  # NOQA
        sys.exit(1)


def _get_task_ids_by_name_and_status(
    task_name: str, status: TaskStatus
) -> Generator[str, None, None]:
    if not task_name:
        raise ValueError("Invalid task_name: %f", task_name)

    _ensure_initialized()

    worker_to_task_map = {}
    if status == TaskStatus.ACTIVE:
        worker_to_task_map = inspect.active()
    elif status == TaskStatus.SCHEDULED:
        worker_to_task_map = inspect.scheduled()
    elif status == TaskStatus.RESERVED:
        worker_to_task_map = inspect.reserved()

    worker_to_task_map = inspect.active() or {}
    for worker_id, tasks in worker_to_task_map.items():
        for task in tasks:
            if task["name"] == task_name:
                yield task["id"]


def get_active_task_ids_by_name(task_name: str) -> Generator[str, None, None]:
    return _get_task_ids_by_name_and_status(task_name, TaskStatus.ACTIVE)


def get_scheduled_task_ids_by_name(task_name: str) -> Generator[str, None, None]:
    return _get_task_ids_by_name_and_status(task_name, TaskStatus.SCHEDULED)


def get_reserved_task_ids_by_name(task_name: str) -> Generator[str, None, None]:
    return _get_task_ids_by_name_and_status(task_name, TaskStatus.RESERVED)


def revoke_active_tasks_by_name(task_name: str):
    task_ids = get_active_task_ids_by_name(task_name)

    num = 0
    for task_id in task_ids:
        control.revoke(task_ids)
        num += 1
    print(f">> Revoked tasks: {num}")  # NOQA


def init_sentry():
    global control
    global inspect
    global _initialized

    from sentry.runner import configure

    configure()

    from sentry.celery import app

    control = app.control
    inspect = control.inspect()

    _initialized = True


def main() -> None:
    init_sentry()


if __name__ == "__main__":
    main()

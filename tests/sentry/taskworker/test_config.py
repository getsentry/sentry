import inspect
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import timedelta
from types import GenericAlias, NoneType, UnionType
from typing import Any

from django.conf import settings

from sentry.conf.types.taskworker import crontab
from sentry.taskworker.registry import taskregistry
from sentry.taskworker.task import Task


def test_import_paths():
    for path in settings.TASKWORKER_IMPORTS:
        try:
            __import__(path)
        except ImportError:
            raise AssertionError(f"Unable to import {path} from TASKWORKER_IMPORTS")


def test_taskworker_schedule() -> None:
    for schedule_name, config in settings.TASKWORKER_SCHEDULES.items():
        assert config["task"], f"schedule {schedule_name} is missing a task name"
        (namespace, taskname) = config["task"].split(":")
        assert taskregistry.get_task(
            namespace, taskname
        ), f"task for {schedule_name} is not registered"

        assert config["schedule"], f"Schedule {schedule_name} is missing a schedule"
        schedule = config.get("schedule")
        assert isinstance(
            schedule, (timedelta, crontab)
        ), f"Schedule {schedule_name} has a schedule of type {type(schedule)}"


def test_task_signature_json_check() -> None:
    """
    Inspect the parameters of each registered task, and attempt to
    find any usage of parameters that are not json encodable.
    """
    # First ensure all tasks are imported
    for path in settings.TASKWORKER_IMPORTS:
        __import__(path)

    # Accumulate failures so we can report all at once
    failures = []
    for namespace in taskregistry.namespaces():
        for task in namespace.tasks():
            try:
                _validate_task_signature(task)
            except AssertionError as e:
                failures.append(e)
    if failures:
        message = "Some tasks have parameters that are not json encodable, see below:\n"
        message += "\n".join(str(f) for f in failures)
        raise AssertionError(message)


def _validate_task_signature(task: Task[Any, Any]) -> None:
    sig = inspect.signature(task._func, eval_str=True)
    for param in sig.parameters.values():
        _validate_parameter_type(param.annotation, task.name, param.name)


ALLOWED_SCALARS = (bool, int, float, str)
ALLOWED_CONTAINERS = (dict, list, Mapping, MutableMapping, Sequence)


def _validate_parameter_type(annotation: Any, func_name: str, param_name: str) -> None:
    if isinstance(annotation, UnionType):
        for opt in annotation.__args__:
            _validate_parameter_type(opt, func_name, param_name)
        return
    elif isinstance(annotation, GenericAlias):
        _validate_parameter_type(annotation.__origin__, func_name, param_name)
        for opt in annotation.__args__:
            _validate_parameter_type(opt, func_name, param_name)
        return

    if annotation == inspect.Parameter.empty:
        # The parameter has no type annotation. This could be
        # an error in the future.
        return

    if annotation in ALLOWED_SCALARS or annotation in ALLOWED_CONTAINERS:
        return

    if annotation == NoneType:
        return

    if annotation == Any:
        # Any should probably not be allowed outside of kwargs.
        return
    raise AssertionError(
        f"Parameter {param_name} of task {func_name} is of type {annotation} which cannot be json encoded"
    )

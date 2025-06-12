import inspect
from datetime import timedelta
from typing import Any

import pytest
from django.conf import settings

from sentry.conf.types.taskworker import crontab
from sentry.dynamic_sampling.tasks.task_context import TaskContext
from sentry.taskworker.registry import taskregistry


def test_import_paths():
    for path in settings.TASKWORKER_IMPORTS:
        try:
            __import__(path)
        except ImportError:
            raise AssertionError(f"Unable to import {path} from TASKWORKER_IMPORTS")


@pytest.mark.parametrize("name,config", list(settings.TASKWORKER_SCHEDULES.items()))
def test_taskworker_schedule_type(name: str, config: dict[str, Any]) -> None:
    assert config["task"], f"schedule {name} is missing a task name"
    (namespace, taskname) = config["task"].split(":")
    assert taskregistry.get_task(namespace, taskname), f"task for {name} is not registered"

    assert config["schedule"], f"Schedule {name} is missing a schedule"
    schedule = config.get("schedule")
    assert isinstance(
        schedule, (timedelta, crontab)
    ), f"Schedule {name} has a schedule of type {type(schedule)}"


@pytest.mark.parametrize("config", list(settings.TASKWORKER_SCHEDULES.values()))
def test_taskworker_schedule_parameters(config: dict[str, Any]) -> None:
    (namespace, taskname) = config["task"].split(":")
    task = taskregistry.get_task(namespace, taskname)
    signature = inspect.signature(task)

    for parameter in signature.parameters.values():
        # Skip *args and **kwargs
        if parameter.kind in (parameter.VAR_POSITIONAL, parameter.VAR_KEYWORD):
            continue
        # The dynamic sampling tasks splice in a TaskContext via a decorator :(
        if parameter.annotation == TaskContext:
            continue
        if parameter.default == parameter.empty:
            raise AssertionError(
                f"Parameter `{parameter.name}` for task `{task.name}` must have a default value."
            )

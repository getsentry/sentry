import inspect
from datetime import timedelta
from typing import int, Any

import pytest
from django.conf import settings

from sentry.conf.types.taskworker import crontab
from sentry.taskworker.registry import taskregistry


@pytest.fixture
def load_tasks() -> None:
    """Ensure that tasks are loaded for schedule tests"""
    for path in settings.TASKWORKER_IMPORTS:
        __import__(path)


def test_import_paths() -> None:
    for path in settings.TASKWORKER_IMPORTS:
        try:
            __import__(path)
        except ImportError:
            raise AssertionError(f"Unable to import {path} from TASKWORKER_IMPORTS")


def test_taskworker_schedule_unique() -> None:
    visited: dict[str, str] = {}
    for key, entry in settings.TASKWORKER_SCHEDULES.items():
        if entry["task"] in visited:
            msg = (
                f"Schedule {key} references a task ({entry['task']}) "
                f"that is already scheduled under key {visited[entry['task']]}."
            )
            raise AssertionError(msg)

        visited[entry["task"]] = key


@pytest.mark.parametrize("name,config", list(settings.TASKWORKER_SCHEDULES.items()))
def test_taskworker_schedule_type(name: str, config: dict[str, Any], load_tasks) -> None:
    assert config["task"], f"schedule {name} is missing a task name"
    (namespace, taskname) = config["task"].split(":")
    assert taskregistry.get_task(namespace, taskname), f"task for {name} is not registered"

    assert config["schedule"], f"Schedule {name} is missing a schedule"
    schedule = config.get("schedule")
    assert isinstance(
        schedule, (timedelta, crontab)
    ), f"Schedule {name} has a schedule of type {type(schedule)}"


def test_taskworker_schedule_parameters() -> None:
    for config in settings.TASKWORKER_SCHEDULES.values():
        (namespace, taskname) = config["task"].split(":")
        task = taskregistry.get_task(namespace, taskname)
        signature = inspect.signature(task)

        for parameter in signature.parameters.values():
            # Skip *args and **kwargs
            if parameter.kind in (parameter.VAR_POSITIONAL, parameter.VAR_KEYWORD):
                continue
            if parameter.default == parameter.empty:
                raise AssertionError(
                    f"Parameter `{parameter.name}` for task `{task.name}` must have a default value."
                )

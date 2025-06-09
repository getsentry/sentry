from __future__ import annotations

import inspect
from typing import Any

import pytest
from celery.beat import ScheduleEntry
from django.conf import settings

from sentry.celery import app
from sentry.dynamic_sampling.tasks.task_context import TaskContext

app.loader.import_default_modules()


# XXX(dcramer): this doesn't actually work as we'd expect, as if the task is imported
# anywhere else before this code is run it will still show up as registered
@pytest.mark.parametrize("name,entry_data", list(settings.CELERYBEAT_SCHEDULE.items()))
def test_validate_celerybeat_schedule(name: str, entry_data: dict[str, Any]) -> None:
    entry = ScheduleEntry(name=name, app=app, **entry_data)
    assert entry.task in app.tasks
    mod_name = app.tasks[entry.task].__module__
    assert mod_name in settings.CELERY_IMPORTS, f"{mod_name} is missing from CELERY_IMPORTS"
    # Test that the schedules are valid. Throws a RuntimeError if one is invalid.
    entry.is_due()


@pytest.mark.parametrize("name,entry_data", list(settings.CELERYBEAT_SCHEDULE.items()))
def test_validate_scheduled_task_parameters(name: str, entry_data: dict[str, Any]) -> None:
    entry = ScheduleEntry(name=name, app=app, **entry_data)
    task = app.tasks[entry.task]
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
                f"Parameter `{parameter.name}` for task `{task.name}` must have a default value"
            )

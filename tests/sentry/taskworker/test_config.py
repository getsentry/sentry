from datetime import timedelta

from django.conf import settings

from sentry.conf.types.taskworker import crontab
from sentry.taskworker.registry import taskregistry


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

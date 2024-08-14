from celery import current_app
from celery.schedules import crontab
from django.conf import settings

from sentry.testutils.cases import TestCase


class CeleryQueueRegisteredTest(TestCase):
    def test(self):
        queue_names = {q.name for q in settings.CELERY_QUEUES}
        missing_queue_tasks = []
        for task in current_app.tasks.values():
            # Filter out any tasks that aren't sentry specific, or don't specify `queue`.
            if task.name.startswith("celery.") or not hasattr(task, "queue"):
                continue
            if task.queue not in queue_names:
                missing_queue_tasks.append(f" - Task: {task.name}, Queue: {task.queue}")

        assert not missing_queue_tasks, (
            "Found tasks with queues that are undefined. These must be defined in "
            "settings.CELERY_QUEUES.\nTask Info:\n{}.".format("\n".join(missing_queue_tasks))
        )


class CeleryQueuesUseCrontabTest(TestCase):
    def test(self):
        crontab_tasks = settings.CELERYBEAT_SCHEDULE.keys() - settings.TIMEDELTA_ALLOW_LIST
        for task_name in crontab_tasks:
            config = settings.CELERYBEAT_SCHEDULE[task_name]
            schedule = config.get("schedule")
            assert isinstance(
                schedule, crontab
            ), f"Task {task_name} has a schedule of type {type(schedule)}"

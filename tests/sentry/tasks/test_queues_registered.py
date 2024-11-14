from celery import current_app
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

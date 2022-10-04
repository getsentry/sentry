import itertools

from celery import current_app

TRIGGER_TASKS = {
    "sentry.tasks.post_process.post_process_group",
}


class SplitQueueRouter:
    def __init__(self):
        queues = current_app.conf["CELERY_QUEUES"]

        self.trigger_queues = itertools.cycle(
            [q.name for q in queues if q.name.startswith("triggers-")]
        )

    def route_for_task(self, task, *args, **kwargs):
        if task in TRIGGER_TASKS:
            return {"queue": next(self.trigger_queues)}
        return None

import gc
import logging
from datetime import datetime
from typing import Any

from celery import Celery, Task, signals
from celery.worker.request import Request
from django.conf import settings

from sentry.utils import metrics

logger = logging.getLogger("celery.pickle")


@signals.worker_before_create_process.connect
def celery_prefork_freeze_gc(**kwargs: object) -> None:
    # prefork: move all current objects to "permanent" gc generation (usually
    # modules / functions / etc.) preventing them from being paged in during
    # garbage collection (which writes to objects)
    #
    # docs suggest disabling gc up until this point (to reduce holes in
    # allocated blocks).  that can be a future improvement if this helps
    gc.freeze()


class SentryTask(Task):
    Request = "sentry.celery:SentryRequest"

    @classmethod
    def _add_metadata(cls, kwargs: dict[str, Any] | None) -> None:
        """
        Helper method that adds relevant metadata
        """
        if kwargs is None:
            return None
        # Add the start time when the task was kicked off for async processing by the calling code
        kwargs["__start_time"] = datetime.now().timestamp()

    def __call__(self, *args, **kwargs):
        return super().__call__(*args, **kwargs)

    def delay(self, *args, **kwargs):
        self._add_metadata(kwargs)
        return super().delay(*args, **kwargs)

    def apply_async(self, *args, **kwargs):
        self._add_metadata(kwargs)

        with metrics.timer("jobs.delay", instance=self.name):
            return Task.apply_async(self, *args, **kwargs)


class SentryRequest(Request):
    def __init__(self, message, **kwargs):
        super().__init__(message, **kwargs)
        self._request_dict["headers"] = message.headers


class SentryCelery(Celery):
    task_cls = SentryTask


app = SentryCelery("sentry")
app.config_from_object(settings)
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)

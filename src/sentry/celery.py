import gc
from datetime import datetime
from itertools import chain
from typing import Any

from celery import Celery, Task, signals
from celery.worker.request import Request
from django.conf import settings
from django.db import models

from sentry.utils import metrics

LEGACY_PICKLE_TASKS = frozenset(
    [
        # basic tasks that must be passed models still
        "sentry.tasks.process_buffer.process_incr",
        "sentry.tasks.unmerge",
        "src.sentry.notifications.utils.async_send_notification",
        # basic tasks that can already deal with primary keys passed
        "sentry.tasks.update_code_owners_schema",
        # integration tasks that must be passed models still
        "sentry.integrations.slack.link_users_identities",
    ]
)


def holds_bad_pickle_object(value, memo=None):
    if memo is None:
        memo = {}

    value_id = id(value)
    if value_id in memo:
        return
    memo[value_id] = value

    if isinstance(value, (tuple, list)):
        for item in value:
            bad_object = holds_bad_pickle_object(item, memo)
            if bad_object is not None:
                return bad_object
    elif isinstance(value, dict):
        for item in value.values():
            bad_object = holds_bad_pickle_object(item, memo)
            if bad_object is not None:
                return bad_object

    if isinstance(value, models.Model):
        return (
            value,
            "django database models are large and likely to be stale when your task is run. "
            "Instead pass primary key values to the task and load records from the database within your task.",
        )
    if type(value).__module__.startswith(("sentry.", "getsentry.")):
        return value, "do not pickle custom classes"

    return None


def good_use_of_pickle_or_bad_use_of_pickle(task, args, kwargs):
    argiter = chain(enumerate(args), kwargs.items())

    for name, value in argiter:
        bad = holds_bad_pickle_object(value)
        if bad is not None:
            bad_object, reason = bad
            raise TypeError(
                "Task %r was invoked with an object that we do not want "
                "to pass via pickle (%r, reason is %s) in argument %s"
                % (task, bad_object, reason, name)
            )


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

    def delay(self, *args, **kwargs):
        self._add_metadata(kwargs)
        return super().delay(*args, **kwargs)

    def apply_async(self, *args, **kwargs):
        self._add_metadata(kwargs)
        # If intended detect bad uses of pickle and make the tasks fail in tests.  This should
        # in theory pick up a lot of bad uses without accidentally failing tasks in prod.
        if (
            settings.CELERY_COMPLAIN_ABOUT_BAD_USE_OF_PICKLE
            and self.name not in LEGACY_PICKLE_TASKS
        ):
            good_use_of_pickle_or_bad_use_of_pickle(self, args, kwargs)

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

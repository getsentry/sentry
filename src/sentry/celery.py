from datetime import datetime
from itertools import chain

from celery import Celery, Task
from celery.worker.request import Request
from django.conf import settings
from django.db import models

from sentry.utils import metrics

LEGACY_PICKLE_TASKS = frozenset(
    [
        # basic tasks that must be passed models still
        "sentry.tasks.process_buffer.process_incr",
        "sentry.tasks.process_resource_change_bound",
        "sentry.tasks.sentry_apps.send_alert_event",
        "sentry.tasks.unmerge",
        "src.sentry.notifications.utils.async_send_notification",
        # basic tasks that can already deal with primary keys passed
        "sentry.tasks.update_code_owners_schema",
        # integration tasks that must be passed models still
        "sentry.integrations.slack.post_message",
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
            bad_object = holds_bad_pickle_object(item)
            if bad_object is not None:
                return bad_object
    elif isinstance(value, dict):
        for item in value.values():
            bad_object = holds_bad_pickle_object(item)
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


class SentryTask(Task):
    Request = "sentry.celery:SentryRequest"

    def delay(self, *args, **kwargs):
        kwargs["__start_time"] = datetime.now().timestamp()
        return super().delay(*args, **kwargs)

    def apply_async(self, *args, **kwargs):
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

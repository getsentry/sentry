# XXX(mdtro): backwards compatible imports for celery 4.4.7, remove after upgrade to 5.2.7
from itertools import chain

import celery
from django.conf import settings
from django.db import models

from sentry.utils import metrics

if celery.version_info >= (5, 2):
    from celery import Celery, Task
else:
    from celery import Celery
    from celery.app.task import Task

from celery.worker.request import Request

DB_SHARED_THREAD = """\
DatabaseWrapper objects created in a thread can only \
be used in that same thread.  The object with alias '%s' \
was created in thread id %s and this is thread id %s.\
"""


def patch_thread_ident():
    # monkey patch django.
    # This patch make sure that we use real threads to get the ident which
    # is going to happen if we are using gevent or eventlet.
    # -- patch taken from gunicorn
    if getattr(patch_thread_ident, "called", False):
        return
    try:
        from django.db.backends import BaseDatabaseWrapper, DatabaseError

        if "validate_thread_sharing" in BaseDatabaseWrapper.__dict__:
            import _thread as thread

            _get_ident = thread.get_ident

            __old__init__ = BaseDatabaseWrapper.__init__

            def _init(self, *args, **kwargs):
                __old__init__(self, *args, **kwargs)
                self._thread_ident = _get_ident()

            def _validate_thread_sharing(self):
                if not self.allow_thread_sharing and self._thread_ident != _get_ident():
                    raise DatabaseError(
                        DB_SHARED_THREAD % (self.alias, self._thread_ident, _get_ident())
                    )

            BaseDatabaseWrapper.__init__ = _init
            BaseDatabaseWrapper.validate_thread_sharing = _validate_thread_sharing

        patch_thread_ident.called = True
    except ImportError:
        pass


patch_thread_ident()


LEGACY_PICKLE_TASKS = frozenset(
    [
        # basic tasks
        "sentry.tasks.process_buffer.process_incr",
        "sentry.tasks.process_resource_change_bound",
        "sentry.tasks.sentry_apps.send_alert_event",
        "sentry.tasks.store.symbolicate_event",
        "sentry.tasks.store.symbolicate_event_low_priority",
        "sentry.tasks.unmerge",
        "sentry.tasks.update_code_owners_schema",
        "src.sentry.notifications.utils.async_send_notification",
        # integrations
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
            "django database model is huge and can be stale. Load from database in task instead",
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

from sentry.utils.monitors import connect

connect(app)

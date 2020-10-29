from __future__ import absolute_import

from django.conf import settings

from celery import Celery
from celery.worker.request import Request
from celery.app.task import Task

from sentry.utils import metrics

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
            from six.moves import _thread as thread

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


class SentryTask(Task):
    Request = "sentry.celery:SentryRequest"

    def apply_async(self, *args, **kwargs):
        with metrics.timer("jobs.delay", instance=self.name):
            return Task.apply_async(self, *args, **kwargs)


class SentryRequest(Request):
    def __init__(self, message, **kwargs):
        super(SentryRequest, self).__init__(message, **kwargs)
        self._request_dict["headers"] = message.headers


class SentryCelery(Celery):
    task_cls = SentryTask


app = SentryCelery("sentry")
app.config_from_object(settings)
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)

from sentry.utils.monitors import connect

connect(app)

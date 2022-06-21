# XXX(mdtro): backwards compatible imports for celery 4.4.7, remove after upgrade to 5.2.7
import celery
from django.conf import settings

from sentry.utils import metrics

if celery.version_info >= (5, 2):
    from celery import Celery, Task
else:
    from celery import Celery
    from celery.app.task import Task

from celery.worker.request import Request


class SentryTask(Task):
    Request = "sentry.celery:SentryRequest"

    def apply_async(self, *args, **kwargs):
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

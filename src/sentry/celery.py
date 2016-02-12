from __future__ import absolute_import

import celery
import os
import os.path
import sys

# Add the project to the python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), os.pardir))

# Configure the application only if it seemingly isnt already configured
from django.conf import settings
if not settings.configured:
    from sentry.runner import configure
    configure()

from sentry.utils import metrics


class Celery(celery.Celery):
    def on_configure(self):
        from raven.contrib.django.models import client
        from raven.contrib.celery import register_signal, register_logger_signal

        # register a custom filter to filter out duplicate logs
        register_logger_signal(client)

        # hook into the Celery error handler
        register_signal(client)


app = Celery('sentry')


OriginalTask = app.Task


class SentryTask(OriginalTask):

    def apply_async(self, *args, **kwargs):
        key = 'jobs.delay'
        instance = self.name
        with metrics.timer(key, instance=instance):
            return OriginalTask.apply_async(self, *args, **kwargs)

app.Task = SentryTask

# Using a string here means the worker will not have to
# pickle the object when using Windows.
app.config_from_object(settings)
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)


if __name__ == '__main__':
    app.start()

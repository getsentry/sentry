from __future__ import absolute_import

__all__ = ["TaskRunner"]

from celery import current_app
from contextlib import contextmanager
from django.conf import settings
from mock import patch


@contextmanager
def TaskRunner():
    settings.CELERY_ALWAYS_EAGER = True
    current_app.conf.CELERY_ALWAYS_EAGER = True
    yield
    current_app.conf.CELERY_ALWAYS_EAGER = False
    settings.CELERY_ALWAYS_EAGER = False


@contextmanager
def BurstTaskRunner():
    """
    A fixture for queueing up Celery tasks and working them off in bursts.

    The main interesting property is that one can run tasks at a later point in
    the future, testing "concurrency" without actually spawning any kind of
    worker.
    """

    queue = []

    def apply_async(self, args=(), kwargs=(), countdown=None):
        queue.append((self, args, kwargs))

    def work():
        while queue:
            self, args, kwargs = queue.pop(0)

            with patch("celery.app.task.Task.apply_async", apply_async):
                self(*args, **kwargs)

    with patch("celery.app.task.Task.apply_async", apply_async):
        yield work

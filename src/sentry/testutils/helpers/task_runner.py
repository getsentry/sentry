__all__ = ["TaskRunner"]

from contextlib import contextmanager
from unittest.mock import patch

from celery import current_app
from django.conf import settings


@contextmanager
def TaskRunner():
    prev = settings.CELERY_ALWAYS_EAGER
    settings.CELERY_ALWAYS_EAGER = True
    current_app.conf.CELERY_ALWAYS_EAGER = True
    yield
    current_app.conf.CELERY_ALWAYS_EAGER = prev
    settings.CELERY_ALWAYS_EAGER = prev


@contextmanager
def BurstTaskRunner():
    """
    A fixture for queueing up Celery tasks and working them off in bursts.

    The main interesting property is that one can run tasks at a later point in
    the future, testing "concurrency" without actually spawning any kind of
    worker.
    """

    job_queue = []

    def apply_async(self, args=(), kwargs=(), countdown=None, queue=None):
        job_queue.append((self, args, kwargs))

    def work(max_jobs=None):
        jobs = 0
        while job_queue and (max_jobs is None or max_jobs > jobs):
            self, args, kwargs = job_queue.pop(0)

            with patch("celery.app.task.Task.apply_async", apply_async):
                self(*args, **kwargs)

            jobs += 1

        if job_queue:
            raise RuntimeError("Could not empty queue, last task items: %s" % repr(job_queue))

    work.queue = job_queue

    with patch("celery.app.task.Task.apply_async", apply_async):
        yield work

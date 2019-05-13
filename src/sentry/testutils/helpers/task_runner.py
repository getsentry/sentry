from __future__ import absolute_import

from contextlib import contextmanager

from celery import current_app
from django.conf import settings

__all__ = ['TaskRunner']


@contextmanager
def TaskRunner():
    settings.CELERY_ALWAYS_EAGER = True
    current_app.conf.CELERY_ALWAYS_EAGER = True
    yield
    current_app.conf.CELERY_ALWAYS_EAGER = False
    settings.CELERY_ALWAYS_EAGER = False

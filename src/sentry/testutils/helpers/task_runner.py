from __future__ import absolute_import

__all__ = ["TaskRunner"]

from celery import current_app
from contextlib import contextmanager
from django.conf import settings


@contextmanager
def TaskRunner():
    settings.CELERY_ALWAYS_EAGER = True
    current_app.conf.CELERY_ALWAYS_EAGER = True
    yield
    current_app.conf.CELERY_ALWAYS_EAGER = False
    settings.CELERY_ALWAYS_EAGER = False

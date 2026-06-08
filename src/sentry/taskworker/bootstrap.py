"""
Worker child process bootstrap.

Bootstraps sentry with configure() and then imports the task app
"""

from sentry.runner import configure

configure()

from django.conf import settings

from sentry.taskworker.runtime import app

settings.TASKWORKER_USE_TASK_PRODUCER = True

__all__ = ("app",)

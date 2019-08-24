from __future__ import absolute_import

from time import time

from django.conf import settings

from sentry import options
from sentry.utils.http import absolute_uri

from .base import Problem, StatusCheck


class CeleryAliveCheck(StatusCheck):
    def check(self):
        # There is no queue, and celery is not running, so never show error
        if settings.CELERY_ALWAYS_EAGER:
            return []
        last_ping = options.get("sentry:last_worker_ping") or 0
        if last_ping >= time() - 300:
            return []

        backlogged, size = None, 0
        from sentry.monitoring.queues import backend

        if backend is not None:
            size = backend.get_size("default")
            backlogged = size > 0

        message = "Background workers haven't checked in recently. "
        if backlogged:
            message += (
                "It seems that you have a backlog of %d tasks. Either your workers aren't running or you need more capacity."
                % size
            )
        else:
            message += (
                "This is likely an issue with your configuration or the workers aren't running."
            )

        return [Problem(message, url=absolute_uri("/manage/queue/"))]

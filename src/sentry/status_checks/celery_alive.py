from __future__ import absolute_import

from time import time

from sentry import options

from .base import StatusCheck, Problem


class CeleryAliveCheck(StatusCheck):
    def check(self):
        last_ping = options.get('sentry:last_worker_ping') or 0
        if last_ping >= time() - 300:
            return []
        return [
            Problem("Background workers haven't checked in recently. This can mean an issue with your configuration or a serious backlog in tasks."),
        ]

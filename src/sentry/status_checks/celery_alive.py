from __future__ import absolute_import

from time import time

from django.conf import settings
from django.core.urlresolvers import reverse

from sentry import options
from sentry.utils.http import absolute_uri

from .base import Problem, StatusCheck


class CeleryAliveCheck(StatusCheck):
    def check(self):
        # There is no queue, and celery is not running, so never show error
        if settings.CELERY_ALWAYS_EAGER:
            return []
        last_ping = options.get('sentry:last_worker_ping') or 0
        if last_ping >= time() - 300:
            return []
        return [
            Problem(
                "Background workers haven't checked in recently. This can mean an issue with your configuration or a serious backlog in tasks.",
                url=absolute_uri(reverse('sentry-admin-queue')),
            ),
        ]

from __future__ import absolute_import

import sentry

from sentry import options

from .base import StatusCheck, Problem


class CeleryAppVersionCheck(StatusCheck):
    def check(self):
        version = options.get('sentry:last_worker_version')
        if not version:
            return []
        if version == sentry.VERSION:
            return []
        return [
            Problem("Celery workers are referencing a different version of Sentry ({version1} vs {version2})".format(
                version1=sentry.VERSION,
                version2=version,
            )),
        ]

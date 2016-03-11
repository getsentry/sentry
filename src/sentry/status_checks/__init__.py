from __future__ import absolute_import

__all__ = ('check_all', 'Problem', 'StatusCheck')

from .base import Problem, StatusCheck  # NOQA
from .celery_alive import CeleryAliveCheck
from .celery_app_version import CeleryAppVersionCheck


checks = [
    CeleryAliveCheck(),
    CeleryAppVersionCheck(),
]


def check_all():
    return {check: check.check() for check in checks}

from __future__ import absolute_import

__all__ = ('check_all', 'Problem', 'StatusCheck')

from .base import Problem, StatusCheck  # NOQA
from .celery_ping import CeleryPingCheck

checks = [
    CeleryPingCheck,
]


def check_all():
    problems = []
    for cls in checks:
        problems.extend(cls().check())
    return problems

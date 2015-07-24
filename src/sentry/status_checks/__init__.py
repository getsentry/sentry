from __future__ import absolute_import

__all__ = ('check_all', 'Problem', 'StatusCheck')

from .base import Problem, StatusCheck  # NOQA
from .celery_ping import CeleryPingCheck

check_classes = [
    CeleryPingCheck,
]


def check_all():
    checks = {}
    problems = []
    for cls in check_classes:
        problem = cls().check()
        problems.extend(problem)
        checks[cls.__name__] = not bool(problem)

    return problems, checks

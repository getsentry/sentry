from __future__ import absolute_import

__all__ = ("check_all", "sort_by_severity", "Problem", "StatusCheck")

from sentry.utils.warnings import seen_warnings

from .base import Problem, StatusCheck, sort_by_severity  # NOQA
from .celery_alive import CeleryAliveCheck
from .celery_app_version import CeleryAppVersionCheck
from .warnings import WarningStatusCheck

checks = [CeleryAliveCheck(), CeleryAppVersionCheck(), WarningStatusCheck(seen_warnings)]


def check_all():
    return {check: check.check() for check in checks}

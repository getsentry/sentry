from typing import int
from sentry.utils.warnings import seen_warnings

from .base import Problem, StatusCheck, sort_by_severity
from .warnings import WarningStatusCheck

__all__ = ("check_all", "sort_by_severity", "Problem", "StatusCheck")


checks = [WarningStatusCheck(seen_warnings)]


def check_all() -> dict[StatusCheck, list[Problem]]:
    return {check: check.check() for check in checks}

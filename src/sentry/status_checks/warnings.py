from __future__ import absolute_import

from .base import Problem, StatusCheck


class WarningStatusCheck(StatusCheck):
    def __init__(self, warning_set):
        self.__warning_set = warning_set

    def check(self):
        if self.__warning_set:
            return [
                Problem(
                    u"There {} {} {} with your system configuration.".format(
                        "are" if len(self.__warning_set) > 1 else "is",
                        len(self.__warning_set),
                        "issues" if len(self.__warning_set) > 1 else "issue",
                    ),
                    severity=Problem.SEVERITY_WARNING,
                )
            ]
        else:
            return []

import functools

from .base import Problem, StatusCheck


class WarningStatusCheck(StatusCheck):
    def __init__(self, warning_set):
        self.__warning_set = warning_set

    def check(self):
        return map(
            functools.partial(Problem, severity=Problem.SEVERITY_WARNING),
            self.__warning_set,
        )

from urllib.parse import urljoin

from django.urls import reverse

from .base import Problem, StatusCheck


class WarningStatusCheck(StatusCheck):
    def __init__(self, warning_set):
        self.__warning_set = warning_set

    def check(self):
        if self.__warning_set:
            return [
                Problem(
                    "There {} {} {} with your system configuration.".format(
                        "are" if len(self.__warning_set) > 1 else "is",
                        len(self.__warning_set),
                        "issues" if len(self.__warning_set) > 1 else "issue",
                    ),
                    severity=Problem.SEVERITY_WARNING,
                    # We need this manual URL building as this page is moved to react
                    # and only the top-level entrypoint is defined and addressable in
                    # our backend Django app.
                    url=urljoin(reverse("sentry-admin-overview"), "status/warnings/"),
                )
            ]
        else:
            return []

from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.utils.http import absolute_uri

from .base import Problem, StatusCheck


class WarningStatusCheck(StatusCheck):
    def __init__(self, warning_set):
        self.__warning_set = warning_set

    def check(self):
        if self.__warning_set:
            return [
                Problem(
                    'There {} {} {} with your system configuration.'.format(
                        'are' if len(self.__warning_set) > 1 else 'is',
                        len(self.__warning_set),
                        'issues' if len(self.__warning_set) > 1 else 'issue',
                    ),
                    severity=Problem.SEVERITY_WARNING,
                    url=absolute_uri(reverse('sentry-admin-warnings-status')),
                ),
            ]
        else:
            return []

from __future__ import absolute_import

import six


class Problem(object):

    # Used for issues that may render the system inoperable or have effects on
    # data integrity (e.g. issues in the processing pipeline.)
    SEVERITY_CRITICAL = 'critical'

    # Used for issues that may cause the system to operate in a degraded (but
    # still operational) state, as well as configuration options that are set
    # in unexpected ways or deprecated in future versions.
    SEVERITY_WARNING = 'warning'

    # Mapping of severity level to a priority score, where the greater the
    # score, the more critical the issue. (The numeric values should only be
    # used for comparison purposes, and are subject to change as levels are
    # modified.)
    SEVERITY_LEVELS = {
        SEVERITY_CRITICAL: 2,
        SEVERITY_WARNING: 1,
    }

    def __init__(self, message, severity=SEVERITY_CRITICAL, url=None):
        assert severity in self.SEVERITY_LEVELS
        self.message = six.text_type(message)
        self.severity = severity
        self.url = url

    def __cmp__(self, other):
        if not isinstance(other, Problem):
            return NotImplemented

        return six.cmp(
            self.SEVERITY_LEVELS[self.severity],
            self.SEVERITY_LEVELS[other.severity],
        )

    def __str__(self):
        return self.message.encode('utf-8')

    def __unicode__(self):
        return self.message

    @classmethod
    def threshold(cls, severity):
        threshold = cls.SEVERITY_LEVELS[severity]

        def predicate(problem):
            return cls.SEVERITY_LEVELS[problem.severity] >= threshold

        return predicate


class StatusCheck(object):
    def check(self):
        """
        Perform required checks and return a list of ``Problem`` instances.
        """
        raise NotImplementedError

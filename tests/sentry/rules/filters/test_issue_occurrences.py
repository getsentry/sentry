from __future__ import absolute_import

import six

from sentry.rules.filters.issue_occurrences import IssueOccurrencesFilter
from sentry.testutils.cases import RuleTestCase


class IssueOccurrencesTest(RuleTestCase):
    rule_cls = IssueOccurrencesFilter

    def test_compares_correctly(self):
        event = self.get_event()
        value = 10
        data = {"value": six.text_type(value)}

        rule = self.get_rule(data=data)

        event.group.times_seen = 11
        self.assertPasses(rule, event)

        event.group.times_seen = 10
        self.assertPasses(rule, event)

        event.group.times_seen = 8
        self.assertDoesNotPass(rule, event)

    def test_fails_on_bad_data(self):
        event = self.get_event()
        data = {"value": "bad data"}

        rule = self.get_rule(data=data)

        event.group.times_seen = 10
        self.assertDoesNotPass(rule, event)

from __future__ import absolute_import

from sentry.testutils.cases import RuleTestCase
from sentry.rules.conditions.tagged_event import TaggedEventCondition, MatchType


class TaggedEventConditionTest(RuleTestCase):
    rule_cls = TaggedEventCondition

    def get_event(self):
        event = self.event
        event.data['tags'] = (
            ('logger', 'sentry.example'),
            ('logger', 'foo.bar'),
            ('notlogger', 'sentry.other.example'),
            ('notlogger', 'bar.foo.baz'),
        )
        return event

    def test_equals(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'key': 'LOGGER',
            'value': 'sentry.example',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'key': 'logger',
            'value': 'sentry.other.example',
        })
        self.assertDoesNotPass(rule, event)

    def test_does_not_equal(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.NOT_EQUAL,
            'key': 'logger',
            'value': 'sentry.example',
        })
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule({
            'match': MatchType.NOT_EQUAL,
            'key': 'logger',
            'value': 'sentry.other.example',
        })
        self.assertPasses(rule, event)

    def test_starts_with(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.STARTS_WITH,
            'key': 'logger',
            'value': 'sentry.',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.STARTS_WITH,
            'key': 'logger',
            'value': 'bar.',
        })
        self.assertDoesNotPass(rule, event)

    def test_ends_with(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.ENDS_WITH,
            'key': 'logger',
            'value': '.example',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.ENDS_WITH,
            'key': 'logger',
            'value': '.foo',
        })
        self.assertDoesNotPass(rule, event)

    def test_contains(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.CONTAINS,
            'key': 'logger',
            'value': 'sentry',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.CONTAINS,
            'key': 'logger',
            'value': 'bar.foo',
        })
        self.assertDoesNotPass(rule, event)

    def test_does_not_contain(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.NOT_CONTAINS,
            'key': 'logger',
            'value': 'sentry',
        })
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule({
            'match': MatchType.NOT_CONTAINS,
            'key': 'logger',
            'value': 'bar.foo',
        })
        self.assertPasses(rule, event)

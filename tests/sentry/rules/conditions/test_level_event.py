from __future__ import absolute_import

import logging

from sentry.testutils.cases import RuleTestCase
from sentry.rules.conditions.level import LevelCondition, MatchType


class LevelConditionTest(RuleTestCase):
    rule_cls = LevelCondition

    def test_render_label(self):
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'level': '30',
        })
        assert rule.render_label() == u'An event\'s level is equal to warning'

    def test_equals(self):
        event = self.create_event(event_id='a' * 32, tags={'level': 'info'})
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'level': '20',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'level': '30',
        })
        self.assertDoesNotPass(rule, event)

    def test_greater_than(self):
        event = self.create_event(event_id='a' * 32, tags={'level': 'info'})
        rule = self.get_rule({
            'match': MatchType.GREATER_OR_EQUAL,
            'level': '40',
        })
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule({
            'match': MatchType.GREATER_OR_EQUAL,
            'level': '20',
        })
        self.assertPasses(rule, event)

    def test_less_than(self):
        event = self.create_event(event_id='a' * 32, tags={'level': 'info'})
        rule = self.get_rule({
            'match': MatchType.LESS_OR_EQUAL,
            'level': '10',
        })
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule({
            'match': MatchType.LESS_OR_EQUAL,
            'level': '30',
        })
        self.assertPasses(rule, event)

    def test_without_tag(self):
        event = self.create_event(event_id='a' * 32, tags={})
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'level': '30',
        })
        self.assertDoesNotPass(rule, event)

    def test_errors_with_invalid_level(self):
        event = self.create_event(event_id='a' * 32, tags={'level': 'foobar'})
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'level': '30',
        })
        self.assertDoesNotPass(rule, event)

    # This simulates the following case:
    # - Rule is setup to accept >= error
    # - error event finishes the save_event task, group has a level of error
    # - warning event finishes the save event, group now has a level of warning
    # - error event starts post_process_group should pass even though the group
    #   has a warning level set
    #
    # Specifically here to make sure the check is properly checking the event's level
    def test_differing_levels(self):
        eevent = self.create_event(tags={'level': 'error'})
        wevent = self.create_event(tags={'level': 'warning'})

        assert wevent.id != eevent.id
        assert wevent.group.id == eevent.group.id

        wevent.group.level = logging.WARNING

        assert wevent.level == logging.WARNING
        assert eevent.level == logging.WARNING

        rule = self.get_rule({
            'match': MatchType.GREATER_OR_EQUAL,
            'level': '40',
        })
        self.assertDoesNotPass(rule, wevent)
        self.assertPasses(rule, eevent)

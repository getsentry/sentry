from __future__ import absolute_import

from sentry.testutils.cases import RuleTestCase
from sentry.rules.conditions.level import LevelCondition, MatchType


class LevelConditionTest(RuleTestCase):
    rule_cls = LevelCondition

    def test_render_label(self):
        rule = self.get_rule(data={"match": MatchType.EQUAL, "level": "30"})
        assert rule.render_label() == u"The event's level is equal to warning"

    def test_equals(self):
        event = self.store_event(data={"level": "info"}, project_id=self.project.id)
        rule = self.get_rule(data={"match": MatchType.EQUAL, "level": "20"})
        self.assertPasses(rule, event)

        rule = self.get_rule(data={"match": MatchType.EQUAL, "level": "30"})
        self.assertDoesNotPass(rule, event)

    def test_greater_than(self):
        event = self.store_event(data={"level": "info"}, project_id=self.project.id)
        rule = self.get_rule(data={"match": MatchType.GREATER_OR_EQUAL, "level": "40"})
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(data={"match": MatchType.GREATER_OR_EQUAL, "level": "20"})
        self.assertPasses(rule, event)

    def test_less_than(self):
        event = self.store_event(data={"level": "info"}, project_id=self.project.id)
        rule = self.get_rule(data={"match": MatchType.LESS_OR_EQUAL, "level": "10"})
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(data={"match": MatchType.LESS_OR_EQUAL, "level": "30"})
        self.assertPasses(rule, event)

    def test_without_tag(self):
        event = self.store_event(data={}, project_id=self.project.id)
        rule = self.get_rule(data={"match": MatchType.EQUAL, "level": "30"})
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
        eevent = self.store_event(data={"level": "error"}, project_id=self.project.id)
        wevent = self.store_event(data={"level": "warning"}, project_id=self.project.id)
        assert wevent.event_id != eevent.event_id
        assert wevent.group.id == eevent.group.id

        rule = self.get_rule(data={"match": MatchType.GREATER_OR_EQUAL, "level": "40"})
        self.assertDoesNotPass(rule, wevent)
        self.assertPasses(rule, eevent)

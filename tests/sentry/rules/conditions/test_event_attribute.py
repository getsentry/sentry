from sentry.rules.conditions.event_attribute import EventAttributeCondition
from sentry.testutils.cases import RuleTestCase
from sentry.workflow_engine.handlers.condition.utils.match import MatchType


class EventAttributeConditionTest(RuleTestCase):
    rule_cls = EventAttributeCondition

    def test_render_label(self) -> None:
        rule = self.get_rule(data={"match": MatchType.EQUAL, "attribute": "\xc3", "value": "\xc4"})
        assert rule.render_label() == "The event's \xc3 value equals \xc4"

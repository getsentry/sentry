from typing import cast

from sentry.rules.actions.base import EventAction
from sentry.rules.conditions.tagged_event import TaggedEventCondition
from sentry.testutils.cases import RuleTestCase
from sentry.workflow_engine.handlers.condition.utils.match import MatchType


class TaggedEventConditionTest(RuleTestCase):
    rule_cls = cast("type[EventAction]", TaggedEventCondition)

    def test_render_label(self) -> None:
        rule = self.get_rule(data={"match": MatchType.EQUAL, "key": "\xc3", "value": "\xc4"})
        assert rule.render_label() == "The event's tags match \xc3 equals \xc4"

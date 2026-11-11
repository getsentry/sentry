from typing import cast

from sentry.rules.actions.base import EventAction
from sentry.rules.conditions.level import LevelCondition
from sentry.testutils.cases import RuleTestCase
from sentry.workflow_engine.handlers.condition.utils.match import MatchType


class LevelConditionTest(RuleTestCase):
    rule_cls = cast("type[EventAction]", LevelCondition)

    def test_render_label(self) -> None:
        rule = self.get_rule(data={"match": MatchType.EQUAL, "level": "30"})
        assert rule.render_label() == "The event's level is equal to warning"

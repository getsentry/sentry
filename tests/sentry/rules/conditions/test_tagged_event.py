from typing import int
from sentry.rules.conditions.tagged_event import TaggedEventCondition
from sentry.rules.match import MatchType
from sentry.services.eventstore.models import Event
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class TaggedEventConditionTest(RuleTestCase):
    rule_cls = TaggedEventCondition

    def get_event(self) -> Event:
        event = self.event
        event.data["tags"] = (
            ("logger", "sentry.example"),
            ("logger", "foo.bar"),
            ("notlogger", "sentry.other.example"),
            ("notlogger", "bar.foo.baz"),
        )
        return event

    def test_render_label(self) -> None:
        rule = self.get_rule(data={"match": MatchType.EQUAL, "key": "\xc3", "value": "\xc4"})
        assert rule.render_label() == "The event's tags match \xc3 equals \xc4"

    def test_equals(self) -> None:
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "key": "LOGGER", "value": "sentry.example"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "key": "logger", "value": "sentry.other.example"}
        )
        self.assertDoesNotPass(rule, event)

    def test_does_not_equal(self) -> None:
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.NOT_EQUAL, "key": "logger", "value": "sentry.example"}
        )
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.NOT_EQUAL, "key": "logger", "value": "sentry.other.example"}
        )
        self.assertPasses(rule, event)

    def test_starts_with(self) -> None:
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.STARTS_WITH, "key": "logger", "value": "sentry."}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.STARTS_WITH, "key": "logger", "value": "bar."}
        )
        self.assertDoesNotPass(rule, event)

    def test_does_not_start_with(self) -> None:
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.NOT_STARTS_WITH, "key": "logger", "value": "sentry."}
        )
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.NOT_STARTS_WITH, "key": "logger", "value": "bar."}
        )
        self.assertPasses(rule, event)

    def test_ends_with(self) -> None:
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.ENDS_WITH, "key": "logger", "value": ".example"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(data={"match": MatchType.ENDS_WITH, "key": "logger", "value": ".foo"})
        self.assertDoesNotPass(rule, event)

    def test_does_not_end_with(self) -> None:
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.NOT_ENDS_WITH, "key": "logger", "value": ".example"}
        )
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.NOT_ENDS_WITH, "key": "logger", "value": ".foo"}
        )
        self.assertPasses(rule, event)

    def test_contains(self) -> None:
        event = self.get_event()
        rule = self.get_rule(data={"match": MatchType.CONTAINS, "key": "logger", "value": "sentry"})
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.CONTAINS, "key": "logger", "value": "bar.foo"}
        )
        self.assertDoesNotPass(rule, event)

    def test_does_not_contain(self) -> None:
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.NOT_CONTAINS, "key": "logger", "value": "sentry"}
        )
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.NOT_CONTAINS, "key": "logger", "value": "bar.foo"}
        )
        self.assertPasses(rule, event)

    def test_is_set(self) -> None:
        event = self.get_event()

        rule = self.get_rule(data={"match": MatchType.IS_SET, "key": "logger"})
        self.assertPasses(rule, event)

        rule = self.get_rule(data={"match": MatchType.IS_SET, "key": "missing"})
        self.assertDoesNotPass(rule, event)

    def test_is_not_set(self) -> None:
        event = self.get_event()
        rule = self.get_rule(data={"match": MatchType.NOT_SET, "key": "logger"})
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(data={"match": MatchType.NOT_SET, "key": "missing"})
        self.assertPasses(rule, event)

    def test_is_in(self) -> None:
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.IS_IN, "key": "logger", "value": "bar.foo, wee, wow"}
        )
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(data={"match": MatchType.IS_IN, "key": "logger", "value": "foo.bar"})
        self.assertPasses(rule, event)

    def test_not_in(self) -> None:
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.NOT_IN, "key": "logger", "value": "bar.foo, wee, wow"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(data={"match": MatchType.NOT_IN, "key": "logger", "value": "foo.bar"})
        self.assertDoesNotPass(rule, event)

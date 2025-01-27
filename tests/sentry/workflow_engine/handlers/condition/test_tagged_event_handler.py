from sentry.rules.conditions.tagged_event import TaggedEventCondition
from sentry.rules.match import MatchType
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestTaggedEventCondition(ConditionTestCase):
    condition = Condition.TAGGED_EVENT
    rule_cls = TaggedEventCondition
    payload = {
        "id": TaggedEventCondition.id,
        "match": MatchType.EQUAL,
        "key": "LOGGER",
        "value": "sentry.example",
    }

    def get_event(self):
        event = self.event
        event.data["tags"] = (
            ("logger", "sentry.example"),
            ("logger", "foo.bar"),
            ("notlogger", "sentry.other.example"),
            ("notlogger", "bar.foo.baz"),
        )
        return event

    def setUp(self):
        super().setUp()
        self.event = self.get_event()
        self.group = self.create_group(project=self.project)
        self.group_event = self.event.for_group(self.group)
        self.job = WorkflowJob(
            {
                "event": self.group_event,
            }
        )
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison={"match": MatchType.EQUAL, "key": "LOGGER", "value": "sentry.example"},
            condition_result=True,
        )

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "match": MatchType.EQUAL,
            "key": "LOGGER",
            "value": "sentry.example",
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

        self.payload = {
            "id": TaggedEventCondition.id,
            "match": MatchType.IS_SET,
            "key": "logger",
        }
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "match": MatchType.IS_SET,
            "key": "logger",
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

    def test_equals(self):
        self.dc.update(
            comparison={"match": MatchType.EQUAL, "key": "LOGGER", "value": "sentry.example"}
        )
        self.assert_passes(self.dc, self.job)

        self.dc.update(
            comparison={
                "match": MatchType.EQUAL,
                "key": "logger",
                "value": "sentry.other.example",
            }
        )
        self.assert_does_not_pass(self.dc, self.job)

    def test_does_not_equal(self):
        self.dc.update(
            comparison={
                "match": MatchType.NOT_EQUAL,
                "key": "logger",
                "value": "sentry.example",
            }
        )
        self.assert_does_not_pass(self.dc, self.job)

        self.dc.update(
            comparison={
                "match": MatchType.NOT_EQUAL,
                "key": "logger",
                "value": "sentry.other.example",
            }
        )
        self.assert_passes(self.dc, self.job)

    def test_starts_with(self):
        self.dc.update(
            comparison={
                "match": MatchType.STARTS_WITH,
                "key": "logger",
                "value": "sentry.",
            }
        )
        self.assert_passes(self.dc, self.job)

        self.dc.update(
            comparison={"match": MatchType.STARTS_WITH, "key": "logger", "value": "bar."}
        )
        self.assert_does_not_pass(self.dc, self.job)

    def test_does_not_start_with(self):
        self.dc.update(
            comparison={
                "match": MatchType.NOT_STARTS_WITH,
                "key": "logger",
                "value": "sentry.",
            }
        )
        self.assert_does_not_pass(self.dc, self.job)

        self.dc.update(
            comparison={
                "match": MatchType.NOT_STARTS_WITH,
                "key": "logger",
                "value": "bar.",
            }
        )
        self.assert_passes(self.dc, self.job)

    def test_ends_with(self):
        self.dc.update(
            comparison={
                "match": MatchType.ENDS_WITH,
                "key": "logger",
                "value": ".example",
            }
        )
        self.assert_passes(self.dc, self.job)

        self.dc.update(comparison={"match": MatchType.ENDS_WITH, "key": "logger", "value": ".foo"})
        self.assert_does_not_pass(self.dc, self.job)

    def test_does_not_end_with(self):
        self.dc.update(
            comparison={
                "match": MatchType.NOT_ENDS_WITH,
                "key": "logger",
                "value": ".example",
            }
        )
        self.assert_does_not_pass(self.dc, self.job)

        self.dc.update(
            comparison={
                "match": MatchType.NOT_ENDS_WITH,
                "key": "logger",
                "value": ".foo",
            }
        )
        self.assert_passes(self.dc, self.job)

    def test_contains(self):
        self.dc.update(
            comparison={
                "match": MatchType.CONTAINS,
                "key": "logger",
                "value": "sentry",
            }
        )
        self.assert_passes(self.dc, self.job)

        self.dc.update(
            comparison={"match": MatchType.CONTAINS, "key": "logger", "value": "bar.foo"}
        )
        self.assert_does_not_pass(self.dc, self.job)

    def test_does_not_contain(self):
        self.dc.update(
            comparison={
                "match": MatchType.NOT_CONTAINS,
                "key": "logger",
                "value": "sentry",
            }
        )
        self.assert_does_not_pass(self.dc, self.job)

        self.dc.update(
            comparison={
                "match": MatchType.NOT_CONTAINS,
                "key": "logger",
                "value": "bar.foo",
            }
        )
        self.assert_passes(self.dc, self.job)

    def test_is_set(self):
        self.dc.update(comparison={"match": MatchType.IS_SET, "key": "logger"})
        self.assert_passes(self.dc, self.job)

        self.dc.update(comparison={"match": MatchType.IS_SET, "key": "missing"})
        self.assert_does_not_pass(self.dc, self.job)

    def test_is_not_set(self):
        self.dc.update(comparison={"match": MatchType.NOT_SET, "key": "logger"})
        self.assert_does_not_pass(self.dc, self.job)

        self.dc.update(comparison={"match": MatchType.NOT_SET, "key": "missing"})
        self.assert_passes(self.dc, self.job)

    def test_is_in(self):
        self.dc.update(
            comparison={
                "match": MatchType.IS_IN,
                "key": "logger",
                "value": "bar.foo, wee, wow",
            }
        )
        self.assert_does_not_pass(self.dc, self.job)

        self.dc.update(
            comparison={
                "match": MatchType.IS_IN,
                "key": "logger",
                "value": "foo.bar",
            }
        )
        self.assert_passes(self.dc, self.job)

    def test_not_in(self):
        self.dc.update(
            comparison={
                "match": MatchType.NOT_IN,
                "key": "logger",
                "value": "bar.foo, wee, wow",
            }
        )
        self.assert_passes(self.dc, self.job)

        self.dc.update(
            comparison={
                "match": MatchType.NOT_IN,
                "key": "logger",
                "value": "foo.bar",
            }
        )
        self.assert_does_not_pass(self.dc, self.job)

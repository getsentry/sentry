import pytest
from jsonschema import ValidationError

from sentry.rules.conditions.level import LevelCondition
from sentry.rules.match import MatchType
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestLevelCondition(ConditionTestCase):
    condition = Condition.LEVEL
    rule_cls = LevelCondition
    payload = {
        "id": LevelCondition.id,
        "match": MatchType.EQUAL,
        "level": 20,
    }

    def setup_group_event_and_job(self):
        self.group_event = self.event.for_group(self.group)
        self.job = WorkflowJob(
            {
                "event": self.group_event,
                "has_reappeared": True,
            }
        )

    def setUp(self):
        super().setUp()
        self.event = self.store_event(data={"level": "info"}, project_id=self.project.id)
        self.group = self.create_group(project=self.project)
        self.setup_group_event_and_job()
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison={"match": MatchType.EQUAL, "level": 20},
            condition_result=True,
        )

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "match": MatchType.EQUAL,
            "level": 20,
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

    def test_json_schema(self):
        self.dc.comparison.update({"match": MatchType.EQUAL, "level": 30})
        self.dc.save()

        self.dc.comparison.update({"hi": "bye"})
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison.update({"match": MatchType.EQUAL, "level": -1})
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison.update({"match": "invalid_match", "level": 30})
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison.update({"match": MatchType.EQUAL, "level": "invalid_level"})
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison.update({"match": MatchType.EQUAL, "level": 30, "hello": "world"})
        with pytest.raises(ValidationError):
            self.dc.save()

    def test_equals(self):
        self.dc.comparison.update({"match": MatchType.EQUAL, "level": 20})
        self.assert_passes(self.dc, self.job)

        self.dc.comparison.update({"match": MatchType.EQUAL, "level": 30})
        self.assert_does_not_pass(self.dc, self.job)

    def test_greater_than(self):
        self.dc.comparison.update({"match": MatchType.GREATER_OR_EQUAL, "level": 40})
        self.assert_does_not_pass(self.dc, self.job)

        self.dc.comparison.update({"match": MatchType.GREATER_OR_EQUAL, "level": 20})
        self.assert_passes(self.dc, self.job)

        self.dc.comparison.update({"match": MatchType.GREATER_OR_EQUAL, "level": 10})
        self.assert_passes(self.dc, self.job)

    def test_less_than(self):
        self.dc.comparison.update({"match": MatchType.LESS_OR_EQUAL, "level": 40})
        self.assert_passes(self.dc, self.job)

        self.dc.comparison.update({"match": MatchType.LESS_OR_EQUAL, "level": 20})
        self.assert_passes(self.dc, self.job)

        self.dc.comparison.update({"match": MatchType.LESS_OR_EQUAL, "level": 10})
        self.assert_does_not_pass(self.dc, self.job)

    def test_without_tag(self):
        self.event = self.store_event(data={}, project_id=self.project.id)
        self.setup_group_event_and_job()
        self.dc.comparison.update({"match": MatchType.EQUAL, "level": 20})
        self.assert_does_not_pass(self.dc, self.job)

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
        assert eevent.group is not None
        assert wevent.group is not None
        assert wevent.group.id == eevent.group.id

        self.dc.comparison.update({"match": MatchType.GREATER_OR_EQUAL, "level": 40})

        self.event = wevent
        self.setup_group_event_and_job()
        self.assert_does_not_pass(self.dc, self.job)

        self.event = eevent
        self.setup_group_event_and_job()
        self.assert_passes(self.dc, self.job)

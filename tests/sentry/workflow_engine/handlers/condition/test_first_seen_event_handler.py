from dataclasses import replace

import pytest
from jsonschema import ValidationError

from sentry.eventstream.base import GroupState
from sentry.rules.conditions.first_seen_event import FirstSeenEventCondition
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestFirstSeenEventCondition(ConditionTestCase):
    condition = Condition.FIRST_SEEN_EVENT
    payload = {"id": FirstSeenEventCondition.id}

    def setUp(self):
        super().setUp()
        self.event_data = WorkflowEventData(
            event=self.group_event,
            group=self.group_event.group,
            group_state=GroupState(
                {
                    "id": 1,
                    "is_regression": True,
                    "is_new": True,
                    "is_new_group_environment": True,
                }
            ),
            workflow_env=None,
        )
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison=True,
            condition_result=True,
        )

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison is True
        assert dc.condition_result is True
        assert dc.condition_group == dcg

    def test_json_schema(self):
        dc = self.create_data_condition(
            type=self.condition,
            comparison=True,
            condition_result=True,
        )

        dc.comparison = False
        dc.save()

        dc.comparison = {"time": "asdf"}
        with pytest.raises(ValidationError):
            dc.save()

        dc.comparison = "hello"
        with pytest.raises(ValidationError):
            dc.save()

    def test(self):
        self.assert_passes(self.dc, self.event_data)

        assert self.event_data.group_state
        self.event_data.group_state["is_new"] = False
        self.assert_does_not_pass(self.dc, self.event_data)

    def test_with_environment(self):
        self.event_data = replace(self.event_data, workflow_env=self.environment)
        assert self.event_data.group_state

        self.assert_passes(self.dc, self.event_data)

        self.event_data.group_state["is_new"] = False
        self.event_data.group_state["is_new_group_environment"] = True
        self.assert_passes(self.dc, self.event_data)

        self.event_data.group_state["is_new"] = True
        self.event_data.group_state["is_new_group_environment"] = False
        self.assert_does_not_pass(self.dc, self.event_data)

        self.event_data.group_state["is_new"] = False
        self.event_data.group_state["is_new_group_environment"] = False
        self.assert_does_not_pass(self.dc, self.event_data)

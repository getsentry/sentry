from sentry.rules.base import EventState
from sentry.rules.conditions.reappeared_event import ReappearedEventCondition
from sentry.rules.conditions.regression_event import RegressionEventCondition
from sentry.workflow_engine.models.data_condition import Condition
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestReappearedEventCondition(ConditionTestCase):
    condition = Condition.GROUP_EVENT_ATTR_COMPARISON
    rule_cls = ReappearedEventCondition
    payload = {"id": ReappearedEventCondition.id}

    def test(self):
        dc = self.create_data_condition(
            type=Condition.GROUP_EVENT_ATTR_COMPARISON,
            condition="state.has_reappeared",
            comparison=True,
            condition_result=True,
        )

        self.assert_passes(
            dc,
            self.event,
            state=EventState(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                has_reappeared=True,
                has_escalated=False,
            ),
        )
        self.assert_does_not_pass(
            dc,
            self.event,
            state=EventState(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                has_reappeared=False,
                has_escalated=False,
            ),
        )

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.condition == "state.has_reappeared"
        assert dc.comparison is True
        assert dc.condition_result is True
        assert dc.condition_group == dcg


class TestRegressionEventCondition(ConditionTestCase):
    condition = Condition.GROUP_EVENT_ATTR_COMPARISON
    rule_cls = RegressionEventCondition
    payload = {"id": RegressionEventCondition.id}

    def test(self):
        dc = self.create_data_condition(
            type=Condition.GROUP_EVENT_ATTR_COMPARISON,
            condition="state.is_regression",
            comparison=True,
            condition_result=True,
        )

        self.assert_passes(
            dc,
            self.event,
            state=EventState(
                is_new=False,
                is_regression=True,
                is_new_group_environment=False,
                has_reappeared=True,
                has_escalated=False,
            ),
        )
        self.assert_does_not_pass(
            dc,
            self.event,
            state=EventState(
                is_new=False,
                is_regression=False,
                is_new_group_environment=False,
                has_reappeared=True,
                has_escalated=False,
            ),
        )

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.condition == "state.is_regression"
        assert dc.comparison is True
        assert dc.condition_result is True
        assert dc.condition_group == dcg

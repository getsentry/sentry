from datetime import timedelta

from django.utils import timezone

from sentry.issues.action_log.types import GroupActionType
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.condition.first_seen_event_handler import (
    FirstSeenEventConditionHandler,
)
from sentry.workflow_engine.handlers.condition.issue_priority_greater_or_equal_handler import (
    IssuePriorityGreaterOrEqualConditionHandler,
)
from sentry.workflow_engine.handlers.condition.regression_event_handler import (
    RegressionEventConditionHandler,
)
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.preview import PreviewCondition, PreviewConditionGroup
from sentry.workflow_engine.processors.preview import build_alert_preview_plan
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestAlertPreview(BaseWorkflowTest):
    def test_processes_candidate_sources_filters_and_throttling(self) -> None:
        end = timezone.now()
        high_priority_group = self.create_group(
            project=self.project,
            priority=PriorityLevel.HIGH,
            first_seen=end - timedelta(hours=3),
        )
        low_priority_group = self.create_group(
            project=self.project,
            priority=PriorityLevel.LOW,
            first_seen=end - timedelta(weeks=3),
        )
        self.create_group_action_log_entry(
            group=high_priority_group,
            type=GroupActionType.SET_REGRESSED,
            date_added=end - timedelta(hours=2),
        )
        self.create_group_action_log_entry(
            group=high_priority_group,
            type=GroupActionType.SET_REGRESSED,
            date_added=end - timedelta(hours=1),
        )
        self.create_group_action_log_entry(
            group=low_priority_group,
            type=GroupActionType.SET_REGRESSED,
            date_added=end - timedelta(minutes=30),
        )

        plan = build_alert_preview_plan(
            triggers=PreviewConditionGroup(
                logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
                conditions=(
                    PreviewCondition(
                        type=Condition.FIRST_SEEN_EVENT,
                        comparison=True,
                        handler=FirstSeenEventConditionHandler,
                    ),
                    PreviewCondition(
                        type=Condition.REGRESSION_EVENT,
                        comparison=True,
                        handler=RegressionEventConditionHandler,
                    ),
                ),
            ),
            action_filters=(
                PreviewConditionGroup(
                    logic_type=DataConditionGroup.Type.ALL,
                    conditions=(
                        PreviewCondition(
                            type=Condition.ISSUE_PRIORITY_GREATER_OR_EQUAL,
                            comparison=PriorityLevel.HIGH,
                            handler=IssuePriorityGreaterOrEqualConditionHandler,
                        ),
                    ),
                ),
                PreviewConditionGroup(
                    logic_type=DataConditionGroup.Type.NONE,
                    conditions=(
                        PreviewCondition(
                            type=Condition.ISSUE_PRIORITY_GREATER_OR_EQUAL,
                            comparison=PriorityLevel.HIGH,
                            handler=IssuePriorityGreaterOrEqualConditionHandler,
                        ),
                    ),
                ),
            ),
        )

        high_priority_preview, low_priority_preview = plan.execute(
            [self.project.id],
            end,
            throttling_period=timedelta(minutes=60),
        )

        assert [
            (
                result.group_id,
                result.triggered_at,
                result.is_throttled,
            )
            for result in high_priority_preview.results
        ] == [
            (high_priority_group.id, end - timedelta(hours=1), False),
            (high_priority_group.id, end - timedelta(hours=2), True),
            (high_priority_group.id, end - timedelta(hours=3), False),
        ]
        assert [
            (
                result.group_id,
                result.triggered_at,
                result.is_throttled,
            )
            for result in low_priority_preview.results
        ] == [
            (low_priority_group.id, end - timedelta(minutes=30), False),
        ]

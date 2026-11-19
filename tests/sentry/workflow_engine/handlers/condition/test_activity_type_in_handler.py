import pytest
from jsonschema import ValidationError

from sentry.types.activity import ActivityType
from sentry.types.actor import ActorType
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class ActivityTypeInConditionTest(ConditionTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.dc = self.create_data_condition(
            type=Condition.ACTIVITY_TYPE_IN,
            comparison=["issue.assigned", "issue.mentioned"],
            condition_result=True,
        )

    def test_assignments(self) -> None:
        for assignee_type, assignee_id in (("user", self.user.id), ("team", self.team.id)):
            activity = self.create_group_activity(
                group=self.group,
                type=ActivityType.ASSIGNED.value,
                data={"assignee": str(assignee_id), "assigneeType": assignee_type},
            )
            self.assert_passes(self.dc, WorkflowEventData(event=activity, group=self.group))

    def test_notes_without_mentions(self) -> None:
        activity = self.create_group_activity(group=self.group, type=ActivityType.NOTE.value)
        data: object
        for data in (
            {},
            {"mentions": []},
            None,
            {"mentions": "user:1"},
        ):
            activity.data = data
            self.assert_does_not_pass(self.dc, WorkflowEventData(event=activity, group=self.group))

    def test_group_event_does_not_match(self) -> None:
        self.assert_does_not_pass(
            self.dc, WorkflowEventData(event=self.group_event, group=self.group)
        )

    def test_kind_selection(self) -> None:
        assignment = self.create_group_activity(
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            data={"assignee": str(self.user.id), "assigneeType": "user"},
        )
        mention = self.create_group_activity(
            group=self.group,
            type=ActivityType.NOTE.value,
            data={"mentions": [{"actor_type": ActorType.USER, "id": self.user.id}]},
        )
        self.assert_passes(self.dc, WorkflowEventData(event=mention, group=self.group))
        self.dc.comparison = ["issue.assigned"]
        self.assert_passes(self.dc, WorkflowEventData(event=assignment, group=self.group))
        self.assert_does_not_pass(self.dc, WorkflowEventData(event=mention, group=self.group))
        self.dc.comparison = ["issue.mentioned"]
        self.assert_passes(self.dc, WorkflowEventData(event=mention, group=self.group))
        self.assert_does_not_pass(self.dc, WorkflowEventData(event=assignment, group=self.group))

    def test_comparison_schema(self) -> None:
        comparison: object
        for comparison in (
            [],
            "issue.assigned",
            [11],
            ["unknown"],
            ["issue.assigned", "issue.assigned"],
        ):
            self.dc.comparison = comparison
            with pytest.raises(ValidationError):
                self.dc.save()

    def test_malformed_stored_comparison(self) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            data={"assignee": str(self.user.id)},
        )
        for comparison in (
            "issue.assigned",
            ["issue.assigned", {}],
        ):
            # Simulate invalid data written outside the model's save validation.
            self.dc.comparison = comparison
            self.assert_does_not_pass(self.dc, WorkflowEventData(event=activity, group=self.group))

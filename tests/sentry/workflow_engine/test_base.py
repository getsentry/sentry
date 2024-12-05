from datetime import datetime
from uuid import uuid4

from sentry.eventstore.models import Event, GroupEvent
from sentry.models.group import Group
from sentry.snuba.models import SnubaQuery
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import EventType
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroup,
    Detector,
    DetectorWorkflow,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorType
from tests.sentry.issues.test_utils import OccurrenceTestMixin


class BaseWorkflowTest(TestCase, OccurrenceTestMixin):
    def create_snuba_query(self, **kwargs):
        return SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            aggregate="count()",
            time_window=60,
            resolution=60,
            **kwargs,
        )

    def create_event(
        self,
        project_id: int,
        timestamp: datetime,
        fingerprint: str,
        environment=None,
        tags: list[list[str]] | None = None,
    ) -> Event:
        data = {
            "timestamp": timestamp.isoformat(),
            "environment": environment,
            "fingerprint": [fingerprint],
            "level": "error",
            "user": {"id": uuid4().hex},
            "exception": {
                "values": [
                    {
                        "type": "IntegrationError",
                        "value": "Identity not found.",
                    }
                ]
            },
        }
        if tags:
            data["tags"] = tags

        return self.store_event(
            data=data,
            project_id=project_id,
            assert_no_errors=False,
            default_event_type=EventType.ERROR,
        )

    def create_detector_and_workflow(
        self,
        name_prefix="test",
        workflow_triggers: DataConditionGroup | None = None,
        detector_type: DetectorType | str = "TestDetector",
        **kwargs,
    ) -> tuple[Workflow, Detector, DetectorWorkflow, DataConditionGroup]:
        workflow_triggers = workflow_triggers or self.create_data_condition_group()

        if not workflow_triggers.conditions.exists():
            # create a trigger condition for a new event
            self.create_data_condition(
                condition_group=workflow_triggers,
                type=Condition.GROUP_EVENT_ATTR_COMPARISON,
                condition="group.times_seen",
                comparison=1,
                condition_result=True,
            )

        workflow = self.create_workflow(
            name=f"{name_prefix}_workflow",
            when_condition_group=workflow_triggers,
            **kwargs,
        )

        detector = self.create_detector(
            name=f"{name_prefix}_detector",
            type=detector_type,
            project=self.project,
        )

        detector_workflow = self.create_detector_workflow(
            detector=detector,
            workflow=workflow,
        )

        return workflow, detector, detector_workflow, workflow_triggers

    def create_workflow_action(
        self,
        workflow: Workflow,
        **kwargs,
    ) -> tuple[DataConditionGroup, Action]:
        action_group = self.create_data_condition_group(logic_type="any-short")

        action = self.create_action(
            type=Action.Type.NOTIFICATION,
            data={"message": "test"},
            **kwargs,
        )

        self.create_data_condition_group_action(
            condition_group=action_group,
            action=action,
        )

        # Add the action group to the workflow
        self.create_workflow_data_condition_group(workflow, action_group)

        return action_group, action

    def create_group_event(self, project=None, occurrence=None) -> tuple[Group, Event, GroupEvent]:
        project = project or self.project
        group = self.create_group(project)
        event = self.create_event(
            project.id,
            datetime.now(),
            "test_fingerprint",
        )

        group_event = GroupEvent(
            self.project.id,
            event.event_id,
            group,
            event.data,
            event._snuba_data,
            occurrence,
        )

        return group, event, group_event

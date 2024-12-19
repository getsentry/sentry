from datetime import UTC, datetime
from unittest import mock
from uuid import uuid4

from sentry.eventstore.models import Event, GroupEvent
from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.snuba.models import SnubaQuery
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import EventType
from sentry.utils.registry import AlreadyRegisteredError
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroup,
    DataPacket,
    DataSource,
    Detector,
    DetectorWorkflow,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.issues.test_utils import OccurrenceTestMixin

try:
    type_mock = mock.Mock()
    data_source_type_registry.register("test")(type_mock)
except AlreadyRegisteredError:
    # Ensure "test" is mocked for tests, but don't fail if already registered here.
    pass


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
        name_prefix: str = "test",
        workflow_triggers: DataConditionGroup | None = None,
        detector_type: str = MetricAlertFire.slug,
        **kwargs,
    ) -> tuple[Workflow, Detector, DetectorWorkflow, DataConditionGroup]:
        """
        Create a Worfkllow, Detector, DetectorWorkflow, and DataConditionGroup for testing.
        These models are configured to work together to test the workflow engine.
        """
        workflow_triggers = workflow_triggers or self.create_data_condition_group()

        if not workflow_triggers.conditions.exists():
            # create a trigger condition for a new event
            self.create_data_condition(
                condition_group=workflow_triggers,
                type=Condition.EVENT_SEEN_COUNT,
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

    def create_test_query_data_source(self, detector: Detector) -> tuple[DataSource, DataPacket]:
        """
        Create a DataSource and DataPacket for testing; this will create a fake QuerySubscriptionUpdate and link it to a data_source.

        A detector is required to create this test data, so we can ensure that the detector
        has a condition to evaluate for the data_packet that evalutes to true.
        """
        subscription_update: QuerySubscriptionUpdate = {
            "subscription_id": "123",
            "values": {"foo": 1},
            "timestamp": datetime.now(UTC),
            "entity": "test-entity",
        }

        data_source = self.create_data_source(
            query_id=subscription_update["subscription_id"],
            organization=self.organization,
        )

        data_source.detectors.add(detector)

        if detector.workflow_condition_group is None:
            detector.workflow_condition_group = self.create_data_condition_group(logic_type="any")
            detector.save()

            self.create_data_condition(
                condition_group=detector.workflow_condition_group,
                type=Condition.EQUAL,
                condition_result=DetectorPriorityLevel.HIGH,
                comparison=1,
            )

        # Create a data_packet from the update for testing
        data_packet = DataPacket[QuerySubscriptionUpdate](
            query_id=subscription_update["subscription_id"],
            packet=subscription_update,
        )

        return data_source, data_packet

    def create_workflow_action(
        self,
        workflow: Workflow,
        **kwargs,
    ) -> tuple[DataConditionGroup, Action]:
        action_group = self.create_data_condition_group(logic_type="any-short")

        action = self.create_action(
            type=Action.Type.SLACK,
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

    def create_group_event(
        self,
        project: Project | None = None,
        event: Event | None = None,
        occurrence: IssueOccurrence | None = None,
        fingerprint="test_fingerprint",
    ) -> tuple[Group, Event, GroupEvent]:
        project = project or self.project
        event = event or self.create_event(
            project.id,
            datetime.now(),
            fingerprint,
        )

        group = self.create_group(project=project)
        event.for_group(group)

        group_event = GroupEvent(
            self.project.id,
            event.event_id,
            group,
            event.data,
            event._snuba_data,
            occurrence,
        )

        return group, event, group_event

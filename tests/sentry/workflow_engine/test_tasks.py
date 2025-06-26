from unittest import mock

import pytest

from sentry.issues.grouptype import GroupType
from sentry.issues.status_change_consumer import update_status
from sentry.issues.status_change_message import StatusChangeMessageData
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.workflow_engine.models import DataPacket, DataSource, Detector
from sentry.workflow_engine.tasks import process_data_packet, workflow_status_update_handler


class IssuePlatformIntegrationTests(TestCase):
    def test_handler_invoked__when_resolved(self):
        """
        Integration test to ensure the `update_status` method
        will correctly invoke the `workflow_state_update_handler`
        and increment the metric.
        """
        detector = self.create_detector()
        group = self.create_group(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.ESCALATING,
        )

        message = StatusChangeMessageData(
            id="test_message_id",
            project_id=self.project.id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
            fingerprint=["test_fingerprint"],
            detector_id=detector.id,
        )

        with mock.patch("sentry.workflow_engine.tasks.metrics.incr") as mock_incr:
            update_status(group, message)
            mock_incr.assert_called_with(
                "workflow_engine.process_workflow.activity_update",
                tags={"activity_type": ActivityType.SET_RESOLVED.value},
            )


class WorkflowStatusUpdateHandlerTests(TestCase):
    def test__no_detector_id(self):
        """
        Test that the workflow_status_update_handler does not crash
        when no detector_id is provided in the status change message.
        """
        group = self.create_group(project=self.project)
        activity = Activity(
            project=self.project,
            group=group,
            type=ActivityType.SET_RESOLVED.value,
            data={"fingerprint": ["test_fingerprint"]},
        )

        message = StatusChangeMessageData(
            id="test_message_id",
            project_id=self.project.id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
            fingerprint=["test_fingerprint"],
            detector_id=None,  # No detector_id provided
        )

        with mock.patch("sentry.workflow_engine.tasks.metrics.incr") as mock_incr:
            workflow_status_update_handler(group, message, activity)
            mock_incr.assert_called_with("workflow_engine.error.tasks.no_detector_id")


test_primitive_datapackets = [
    ({"key": "value"}, "dict"),
    (["item1", "item2"], "list"),
    ({"item1", "item2"}, "set"),
    (1.2, "float"),
    (123, "int"),
    (True, "bool"),
    ((1, 2), "tuple"),
]


@pytest.mark.parametrize(
    "packet,packet_type",
    test_primitive_datapackets,
)
def test_process_data_packet__invalid_primitive(packet, packet_type):
    data_packet = DataPacket(packet=packet, source_id="test")

    with pytest.raises(
        ValueError,
        match=f"DataPacket cannot be a primitive, {packet_type}, without a packet_type.",
    ):
        process_data_packet.run(data_packet)


@pytest.mark.parametrize(
    "packet,packet_type",
    test_primitive_datapackets
    + [
        # add tests for snuba queries
        # uptime ticks
        # etc
    ],
)
@django_db_all
def test_process_data_packet__no_detectors(packet, packet_type):
    packet_type = f"{packet_type}_test_example"
    data_packet = DataPacket(packet=packet, source_id="test")

    with (
        mock.patch("sentry.workflow_engine.tasks.process_data_sources") as process_data_sources,
        mock.patch("sentry.workflow_engine.tasks.process_detectors") as process_detectors,
    ):
        process_data_packet.run(data_packet, packet_type)
        process_data_sources.assert_called_once_with([data_packet], packet_type)
        process_detectors.assert_not_called()  # No detectors to process in this test case


@pytest.mark.parametrize(
    "packet,packet_type",
    test_primitive_datapackets
    + [
        # add tests for snuba queries
        # uptime ticks
        # etc
    ],
)
@django_db_all
@mock.patch(
    "sentry.workflow_engine.models.detector.grouptype.registry.get_by_slug",
    return_value=GroupType(
        category_v2=2,
        category=1,
        description="test",
        slug="test_group_type",
        type_id=1234,
    ),
)
@mock.patch(
    "sentry.workflow_engine.models.data_source.data_source_type_registry.get", return_value=None
)
def test_process_data_packet(mock_group_registry, mock_registry_get, packet, packet_type):
    packet_type = f"{packet_type}_test_example"
    data_packet = DataPacket(packet=packet, source_id="test")
    organization = Organization.objects.create(name="Test Org")
    project = Project.objects.create(
        name="Test Project",
        organization=organization,
    )

    data_source = DataSource.objects.create(
        source_id="test",
        type=packet_type,
        organization=organization,
    )

    detector = Detector.objects.create(
        name="test_detector",
        type=packet_type,
        project=project,
    )
    detector.data_sources.add(data_source)
    detector.save()

    with (mock.patch("sentry.workflow_engine.tasks.process_detectors") as process_detectors,):
        process_data_packet.run(data_packet, packet_type)
        process_detectors.assert_called_once_with(data_packet, [Detector.objects.first()])

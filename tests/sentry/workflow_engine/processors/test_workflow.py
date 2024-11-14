from datetime import datetime
from uuid import uuid4

from sentry.eventstore.models import Event, GroupEvent
from sentry.snuba.models import SnubaQuery
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import EventType
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors.workflow import process_workflows


class TestProcessWorkflows(TestCase):
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

    def setUp(self):
        self.query = self.create_snuba_query()
        self.packet = DataPacket[dict](self.query.id, {"query_id": self.query.id, "foo": "bar"})

        self.workflow = self.create_workflow(name="test_workflow")
        self.workflow_two = self.create_workflow(name="test_workflow2")

        self.detector = self.create_detector(name="test_detector1")
        self.detector_two = self.create_detector(name="test_detector2")

        self.detector_workflow = self.create_detector_workflow(
            detector=self.detector,
            workflow=self.workflow,
        )

        self.detector_workflow_two = self.create_detector_workflow(
            detector=self.detector,
            workflow=self.workflow_two,
        )

        self.detector_workflow_unused = self.create_detector_workflow(
            detector=self.detector_two,
            workflow=self.workflow,
        )

        self.group = self.create_group(self.project)
        self.event = self.create_event(
            self.project.id,
            datetime.now(),
            "test_fingerprint",
        )

        self.group_event = GroupEvent(
            self.project.id,
            self.event.event_id,
            self.group,
            self.event.data,
            self.event._snuba_data,
        )

    def test_single_workflow(self):
        process_workflows(self.packet, self.group_event)
        pass

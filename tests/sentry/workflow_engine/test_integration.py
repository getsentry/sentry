from datetime import datetime
from unittest import mock

from sentry.eventstream.types import EventStreamEventType
from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.issues.grouptype import ErrorGroupType
from sentry.issues.ingest import save_issue_occurrence
from sentry.models.group import Group
from sentry.tasks.post_process import post_process_group
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors import process_data_sources, process_detectors
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class BaseWorkflowIntegrationTest(BaseWorkflowTest):
    def setUp(self):
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow(
            name_prefix="e2e-test",
            detector_type="metric_alert_fire",
        )

        detector_conditions = self.create_data_condition_group()
        self.create_data_condition(
            condition_group=detector_conditions,
            type=Condition.EQUAL,
            condition_result=DetectorPriorityLevel.HIGH,
            comparison=1,
        )
        self.detector.workflow_condition_group = detector_conditions
        self.detector.save()

        self.action_group, self.action = self.create_workflow_action(workflow=self.workflow)
        self.event = self.store_event(data={}, project_id=self.project.id)

        occurrence_data = self.build_occurrence_data(
            event_id=self.event.event_id,
            project_id=self.project.id,
            fingerprint=[f"detector-{self.detector.id}"],
            evidence_data={"detector_id": self.detector.id},
            type=MetricAlertFire.type_id,
        )

        self.occurrence, group_info = save_issue_occurrence(occurrence_data, self.event)
        assert group_info is not None

        self.group = Group.objects.filter(grouphash__hash=self.occurrence.fingerprint[0]).first()
        assert self.group is not None
        assert self.group.type == MetricAlertFire.type_id

    def call_post_process_group(
        self,
        group_id,
        is_new=False,
        is_regression=False,
        is_new_group_environment=True,
        cache_key=None,
    ):
        post_process_group(
            is_new=is_new,
            is_regression=is_regression,
            is_new_group_environment=is_new_group_environment,
            cache_key=cache_key,
            group_id=group_id,
            occurrence_id=self.occurrence.id,
            project_id=self.project.id,
            eventstream_type=EventStreamEventType.Generic,
        )

        return cache_key


class TestWorkflowEngineIntegrationToIssuePlatform(BaseWorkflowIntegrationTest):
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    def test_workflow_engine__data_source__to_metric_issue_workflow(self):
        """
        This test ensures that a data_source can create the correct event in Issue Platform
        """
        self.data_source, self.data_packet = self.create_test_query_data_source(self.detector)

        with mock.patch(
            "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
        ) as mock_producer:
            processed_packets = process_data_sources(
                [self.data_packet], DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
            )

            for packet, detectors in processed_packets:
                results = process_detectors(packet, detectors)
                assert len(results) == 1

            mock_producer.assert_called_once()

    @with_feature("organizations:workflow-engine-metric-alert-processing")
    def test_workflow_engine__data_source__different_type(self):
        self.data_source, self.data_packet = self.create_test_query_data_source(self.detector)

        with mock.patch(
            "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
        ) as mock_producer:
            # Change the type to mismatch from the packet. This should not find any detectors and return.
            processed_packets = process_data_sources([self.data_packet], "snuba_query")

            assert processed_packets == []
            mock_producer.assert_not_called()

    @with_feature("organizations:workflow-engine-metric-alert-processing")
    def test_workflow_engine__data_source__no_detectors(self):
        self.data_source, self.data_packet = self.create_test_query_data_source(self.detector)
        self.detector.delete()

        with mock.patch(
            "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
        ) as mock_producer:
            processed_packets = process_data_sources(
                [self.data_packet], DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
            )

            assert processed_packets == []
            mock_producer.assert_not_called()


class TestWorkflowEngineIntegrationFromIssuePlatform(BaseWorkflowIntegrationTest):
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    def test_workflow_engine__workflows(self):
        """
        This test ensures that the workflow engine is correctly hooked up to tasks/post_process.py.
        """
        self.create_event(self.project.id, datetime.utcnow(), str(self.detector.id))

        if not self.group:
            assert False, "Group not created"

        with mock.patch(
            "sentry.workflow_engine.processors.workflow.process_workflows"
        ) as mock_process_workflow:
            self.call_post_process_group(self.group.id)
            mock_process_workflow.assert_called_once()

    @with_feature("organizations:workflow-engine-metric-alert-processing")
    def test_workflow_engine__workflows__other_events(self):
        """
        Ensure that the workflow engine only supports MetricAlertFire events for now.
        """
        error_event = self.store_event(data={}, project_id=self.project.id)

        occurrence_data = self.build_occurrence_data(
            event_id=error_event.event_id,
            project_id=self.project.id,
            fingerprint=[f"detector-{self.detector.id}"],
            evidence_data={},
            type=ErrorGroupType.type_id,
        )

        self.occurrence, group_info = save_issue_occurrence(occurrence_data, error_event)
        self.group = Group.objects.filter(grouphash__hash=self.occurrence.fingerprint[0]).first()

        if not self.group:
            assert False, "Group not created"

        with mock.patch(
            "sentry.workflow_engine.processors.workflow.process_workflows"
        ) as mock_process_workflow:
            self.call_post_process_group(error_event.group_id)

            # We currently don't have a detector for this issue type, so it should not call workflow_engine.
            mock_process_workflow.assert_not_called()

    def test_workflow_engine__workflows__no_flag(self):
        self.create_event(self.project.id, datetime.utcnow(), str(self.detector.id))

        if not self.group:
            assert False, "Group not created"

        with mock.patch(
            "sentry.workflow_engine.processors.workflow.process_workflows"
        ) as mock_process_workflow:
            self.call_post_process_group(self.group.id)

            # While this is the same test as the first one, it doesn't invoke the workflow engine because the feature flag is off.
            mock_process_workflow.assert_not_called()

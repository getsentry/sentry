from datetime import datetime, timedelta
from unittest import mock

import pytest
from django.utils import timezone

from sentry import buffer
from sentry.eventstore.models import Event
from sentry.eventstore.processing import event_processing_store
from sentry.eventstream.types import EventStreamEventType
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.issues.ignored import handle_ignored
from sentry.issues.ingest import save_issue_occurrence
from sentry.models.group import Group
from sentry.rules.match import MatchType
from sentry.tasks.post_process import post_process_group
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import Feature, with_feature
from sentry.testutils.helpers.redis import mock_redis_buffer
from sentry.utils.cache import cache_key_for_event
from sentry.workflow_engine.models import Detector, DetectorWorkflow
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors import process_data_sources, process_detectors
from sentry.workflow_engine.processors.delayed_workflow import process_delayed_workflows
from sentry.workflow_engine.processors.workflow import WORKFLOW_ENGINE_BUFFER_LIST_KEY
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
            detector_type="metric_issue",
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
            type=MetricIssue.type_id,
        )

        self.occurrence, group_info = save_issue_occurrence(occurrence_data, self.event)
        assert group_info is not None

        self.group = Group.objects.get(grouphash__hash=self.occurrence.fingerprint[0])
        assert self.group.type == MetricIssue.type_id

    def call_post_process_group(
        self,
        group_id,
        is_new=False,
        is_regression=False,
        is_new_group_environment=True,
        cache_key=None,
        eventstream_type=EventStreamEventType.Generic.value,
        include_occurrence=True,
    ):
        post_process_group(
            is_new=is_new,
            is_regression=is_regression,
            is_new_group_environment=is_new_group_environment,
            cache_key=cache_key,
            group_id=group_id,
            occurrence_id=self.occurrence.id if include_occurrence else None,
            project_id=self.project.id,
            eventstream_type=eventstream_type,
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
    @with_feature("organizations:workflow-engine-process-metric-issue-workflows")
    def test_workflow_engine__workflows(self):
        """
        This test ensures that the workflow engine is correctly hooked up to tasks/post_process.py.
        """
        self.create_event(self.project.id, datetime.utcnow(), str(self.detector.id))

        with mock.patch(
            "sentry.workflow_engine.processors.workflow.process_workflows"
        ) as mock_process_workflow:
            self.call_post_process_group(self.group.id)
            mock_process_workflow.assert_called_once()

    @with_feature("organizations:workflow-engine-metric-alert-processing")
    def test_workflow_engine__workflows__other_events(self):
        """
        Ensure that the workflow engine only supports MetricIssue events for now.
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
        self.group = Group.objects.get(grouphash__hash=self.occurrence.fingerprint[0])

        with mock.patch(
            "sentry.workflow_engine.processors.workflow.process_workflows"
        ) as mock_process_workflow:
            self.call_post_process_group(error_event.group_id)

            # We currently don't have a detector for this issue type, so it should not call workflow_engine.
            mock_process_workflow.assert_not_called()

    def test_workflow_engine__workflows__no_flag(self):
        self.create_event(self.project.id, datetime.utcnow(), str(self.detector.id))

        assert self.group

        with mock.patch(
            "sentry.workflow_engine.processors.workflow.process_workflows"
        ) as mock_process_workflow:
            self.call_post_process_group(self.group.id)

            # While this is the same test as the first one, it doesn't invoke the workflow engine because the feature flag is off.
            mock_process_workflow.assert_not_called()


@mock.patch("sentry.workflow_engine.processors.workflow.trigger_action.delay")
@mock_redis_buffer()
class TestWorkflowEngineIntegrationFromErrorPostProcess(BaseWorkflowIntegrationTest):
    def setUp(self):
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow(
            name_prefix="e2e-test",
            detector_type="error",
        )
        self.workflow_triggers.conditions.all().delete()
        self.action_group, self.action = self.create_workflow_action(workflow=self.workflow)

    @pytest.fixture(autouse=True)
    def with_feature_flags(self):
        with Feature(
            {
                "organizations:workflow-engine-process-workflows": True,
                "organizations:workflow-engine-trigger-actions": True,
            }
        ):
            yield

    def create_error_event(
        self,
        project=None,
        detector=None,
        environment=None,
        fingerprint=None,
        level="error",
        tags: list[list[str]] | None = None,
    ) -> Event:
        if project is None:
            project = self.project
        if detector is None:
            detector = self.detector
        if fingerprint is None:
            fingerprint = str(detector.id)
        event = self.create_event(
            project_id=project.id,
            timestamp=timezone.now(),
            fingerprint=fingerprint,
            environment=environment,
            level=level,
            tags=tags,
        )
        event_processing_store.store({**event.data, "project": project.id})
        return event

    def get_cache_key(self, event: Event) -> str:
        return cache_key_for_event({"project": event.project_id, "event_id": event.event_id})

    def post_process_error(self, event: Event, **kwargs):
        self.call_post_process_group(
            event.group_id,
            cache_key=self.get_cache_key(event),
            eventstream_type=EventStreamEventType.Error.value,
            include_occurrence=False,
            **kwargs,
        )

    @with_feature("organizations:workflow-engine-issue-alert-dual-write")
    def test_default_workflow(self, mock_trigger):
        project = self.create_project(fire_project_created=True)
        project.flags.has_high_priority_alerts = True
        project.save()
        detector = Detector.objects.get(project=project)
        workflow = DetectorWorkflow.objects.get(detector=detector).workflow
        workflow.update(config={"frequency": 0})

        # fires for high priority issue
        high_priority_event = self.create_error_event(project=project, detector=detector)
        self.post_process_error(high_priority_event, is_new=True)
        mock_trigger.assert_called_once()

        # fires for existing high priority issue (has_reappeared or is_escalating)
        mock_trigger.reset_mock()
        high_priority_event_2 = self.create_error_event(project=project, detector=detector)
        # ignore the issue to get has_reappeared
        assert high_priority_event_2.group
        handle_ignored(
            group_list=[high_priority_event_2.group],
            status_details={"ignoreDuration": -1},
            acting_user=self.user,
        )
        self.post_process_error(high_priority_event_2)
        mock_trigger.assert_called_once()

        # does not fire for low priority issue
        mock_trigger.reset_mock()
        low_priority_event = self.create_error_event(
            project=project, detector=detector, fingerprint="asdf", level="warning"
        )
        self.post_process_error(low_priority_event, is_new=True)
        assert not mock_trigger.called

    def test_snoozed_workflow(self, mock_trigger):
        event_1 = self.create_error_event()
        self.post_process_error(event_1)
        mock_trigger.assert_called_once()

        self.workflow.update(enabled=False)
        mock_trigger.reset_mock()
        event_2 = self.create_error_event()
        self.post_process_error(event_2)
        assert not mock_trigger.called

    def test_workflow_frequency(self, mock_trigger):
        self.workflow.update(config={"frequency": 5})
        now = timezone.now()

        with freeze_time(now):
            event_1 = self.create_error_event()
            self.post_process_error(event_1)
            mock_trigger.assert_called_once()

            event_2 = self.create_error_event()
            self.post_process_error(event_2)
            assert mock_trigger.call_count == 1  # not called a second time

        mock_trigger.reset_mock()

        with freeze_time(now + timedelta(minutes=5, seconds=1)):
            event_3 = self.create_error_event()
            self.post_process_error(event_3)
            mock_trigger.assert_called_once()  # called again after 5 minutes

    def test_workflow_environment(self, mock_trigger):
        env = self.create_environment(self.project, name="production")
        self.workflow.update(environment=env)

        event_with_env = self.create_error_event(environment="production")
        event_without_env = self.create_error_event()

        self.post_process_error(event_with_env)
        mock_trigger.assert_called_once()

        mock_trigger.reset_mock()
        self.post_process_error(event_without_env)
        assert not mock_trigger.called  # Should not trigger for events without the environment

    def test_slow_condition_workflow_with_conditions(self, mock_trigger):
        self.project.flags.has_high_priority_alerts = True
        self.project.save()

        # slow condition + trigger, and filter condition
        self.workflow_triggers.update(logic_type="all")
        self.create_data_condition(
            condition_group=self.workflow_triggers,
            type=Condition.EVENT_FREQUENCY_COUNT,
            condition_result=True,
            comparison={
                "interval": "1h",
                "value": 1,
            },
        )
        self.create_data_condition(
            condition_group=self.workflow_triggers,
            type=Condition.NEW_HIGH_PRIORITY_ISSUE,
            condition_result=True,
            comparison=True,
        )
        self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.TAGGED_EVENT,
            condition_result=True,
            comparison={
                "match": MatchType.EQUAL,
                "key": "hello",
                "value": "world",
            },
        )

        # event that is not high priority = no enqueue
        event_1 = self.create_error_event(fingerprint="abcd", level="warning")
        self.post_process_error(event_1, is_new=True)
        assert not mock_trigger.called

        project_ids = buffer.backend.get_sorted_set(
            WORKFLOW_ENGINE_BUFFER_LIST_KEY, 0, timezone.now().timestamp()
        )
        assert not project_ids

        # event that does not have the tags = no fire
        event_2 = self.create_error_event(fingerprint="asdf")
        self.post_process_error(event_2, is_new=True)
        assert not mock_trigger.called

        event_3 = self.create_error_event(fingerprint="asdf")
        self.post_process_error(event_3)
        assert not mock_trigger.called

        project_ids = buffer.backend.get_sorted_set(
            WORKFLOW_ENGINE_BUFFER_LIST_KEY, 0, timezone.now().timestamp()
        )

        process_delayed_workflows(project_ids[0][0])
        assert not mock_trigger.called

        # event that fires
        event_4 = self.create_error_event(tags=[["hello", "world"]])
        self.post_process_error(event_4, is_new=True)
        assert not mock_trigger.called

        event_5 = self.create_error_event(tags=[["hello", "world"]])
        self.post_process_error(event_5)
        assert not mock_trigger.called

        project_ids = buffer.backend.get_sorted_set(
            WORKFLOW_ENGINE_BUFFER_LIST_KEY, 0, timezone.now().timestamp()
        )

        process_delayed_workflows(project_ids[0][0])
        mock_trigger.assert_called_once()

    def test_slow_condition_subqueries(self, mock_trigger):
        env = self.create_environment(self.project, name="production")
        self.workflow.update(environment=env)
        self.create_data_condition(
            condition_group=self.workflow_triggers,
            type=Condition.EVENT_FREQUENCY_COUNT,
            condition_result=True,
            comparison={
                "interval": "1h",
                "value": 2,
                "filters": [
                    {
                        "match": MatchType.EQUAL,
                        "key": "hello",
                        "value": "world",
                    },
                ],
            },
        )
        now = timezone.now()

        with freeze_time(now):
            event_1 = self.create_error_event(environment="production", tags=[["hello", "world"]])
            self.post_process_error(event_1)
            assert not mock_trigger.called

            event_2 = self.create_error_event(environment="production", tags=[["hello", "world"]])
            self.post_process_error(event_2)
            assert not mock_trigger.called

            event_3 = self.create_error_event(tags=[["abc", "def"]])
            self.post_process_error(event_3)
            assert not mock_trigger.called

            project_ids = buffer.backend.get_sorted_set(
                WORKFLOW_ENGINE_BUFFER_LIST_KEY, 0, timezone.now().timestamp()
            )

            process_delayed_workflows(project_ids[0][0])
            assert not mock_trigger.called

        with freeze_time(now + timedelta(minutes=1)):
            # 3 events with matching tags should trigger the workflow
            event_4 = self.create_error_event(environment="production", tags=[["hello", "world"]])
            self.post_process_error(event_4)
            assert not mock_trigger.called

            project_ids = buffer.backend.get_sorted_set(
                WORKFLOW_ENGINE_BUFFER_LIST_KEY, 0, timezone.now().timestamp()
            )

            process_delayed_workflows(project_ids[0][0])
            mock_trigger.assert_called_once()

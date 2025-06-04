from datetime import datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

from sentry import buffer
from sentry.eventstore.models import Event
from sentry.models.project import Project
from sentry.rules.conditions.event_frequency import ComparisonType, EventFrequencyConditionData
from sentry.rules.processing.buffer_processing import (
    bucket_num_groups,
    process_buffer,
    process_in_batches,
)
from sentry.rules.processing.processor import PROJECT_ID_BUFFER_LIST_KEY
from sentry.testutils.cases import PerformanceIssueTestCase, TestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.redis import mock_redis_buffer
from sentry.utils import json
from tests.snuba.rules.conditions.test_event_frequency import BaseEventFrequencyPercentTest

FROZEN_TIME = before_now(days=1).replace(hour=1, minute=30, second=0, microsecond=0)


def test_bucket_num_groups():
    assert bucket_num_groups(1) == "1"
    assert bucket_num_groups(50) == ">10"
    assert bucket_num_groups(101) == ">100"


@freeze_time(FROZEN_TIME)
class CreateEventTestCase(TestCase, BaseEventFrequencyPercentTest):
    def setUp(self):
        super().setUp()
        self.mock_redis_buffer = mock_redis_buffer()
        self.mock_redis_buffer.__enter__()

    def tearDown(self):
        self.mock_redis_buffer.__exit__(None, None, None)

    def push_to_hash(self, project_id, rule_id, group_id, event_id=None, occurrence_id=None):
        value = json.dumps({"event_id": event_id, "occurrence_id": occurrence_id})
        buffer.backend.push_to_hash(
            model=Project,
            filters={"project_id": project_id},
            field=f"{rule_id}:{group_id}",
            value=value,
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

    def create_event_frequency_condition(
        self,
        interval="1d",
        id="EventFrequencyCondition",
        value=1,
        comparison_type=ComparisonType.COUNT,
        comparison_interval=None,
    ) -> EventFrequencyConditionData:
        condition_id = f"sentry.rules.conditions.event_frequency.{id}"
        condition_blob = EventFrequencyConditionData(
            interval=interval,
            id=condition_id,
            value=value,
            comparisonType=comparison_type,
        )
        if comparison_interval:
            condition_blob["comparisonInterval"] = comparison_interval

        return condition_blob


class ProcessDelayedAlertConditionsTestBase(CreateEventTestCase, PerformanceIssueTestCase):
    buffer_timestamp = (FROZEN_TIME + timedelta(seconds=1)).timestamp()

    def assert_buffer_cleared(self, project_id):
        rule_group_data = buffer.backend.get_hash(Project, {"project_id": project_id})
        assert rule_group_data == {}

    def setUp(self):
        super().setUp()

        self.tag_filter = {
            "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
            "key": "foo",
            "match": "eq",
            "value": "bar",
        }

        self.event_frequency_condition = self.create_event_frequency_condition()
        self.event_frequency_condition2 = self.create_event_frequency_condition(value=2)
        self.event_frequency_condition3 = self.create_event_frequency_condition(
            interval="1h", value=1
        )
        self.user_frequency_condition = self.create_event_frequency_condition(
            interval="1m",
            id="EventUniqueUserFrequencyCondition",
        )
        event_frequency_percent_condition = self.create_event_frequency_condition(
            interval="5m", id="EventFrequencyPercentCondition", value=1.0
        )

        self.rule1 = self.create_project_rule(
            project=self.project,
            condition_data=[self.event_frequency_condition],
            environment_id=self.environment.id,
        )
        self.event1 = self.create_event(
            self.project.id, FROZEN_TIME, "group-1", self.environment.name
        )
        self.create_event(self.project.id, FROZEN_TIME, "group-1", self.environment.name)
        assert self.event1.group
        self.group1 = self.event1.group

        self.rule2 = self.create_project_rule(
            project=self.project, condition_data=[self.user_frequency_condition]
        )
        self.event2 = self.create_event(
            self.project.id, FROZEN_TIME, "group-2", self.environment.name
        )
        assert self.event2.group

        self.create_event(self.project.id, FROZEN_TIME, "group-2", self.environment.name)
        self.group2 = self.event2.group

        self.rulegroup_event_mapping_one = {
            f"{self.rule1.id}:{self.group1.id}": {self.event1.event_id},
            f"{self.rule2.id}:{self.group2.id}": {self.event2.event_id},
        }

        self.project_two = self.create_project(organization=self.organization)
        self.environment2 = self.create_environment(project=self.project_two)

        self.rule3 = self.create_project_rule(
            project=self.project_two,
            condition_data=[self.event_frequency_condition2],
            environment_id=self.environment2.id,
        )
        self.event3 = self.create_event(
            self.project_two.id, FROZEN_TIME, "group-3", self.environment2.name
        )
        self.create_event(self.project_two.id, FROZEN_TIME, "group-3", self.environment2.name)
        self.create_event(self.project_two.id, FROZEN_TIME, "group-3", self.environment2.name)
        self.create_event(self.project_two.id, FROZEN_TIME, "group-3", self.environment2.name)
        assert self.event3.group
        self.group3 = self.event3.group

        self.rule4 = self.create_project_rule(
            project=self.project_two, condition_data=[event_frequency_percent_condition]
        )
        self.event4 = self.create_event(self.project_two.id, FROZEN_TIME, "group-4")
        assert self.event4.group
        self.create_event(self.project_two.id, FROZEN_TIME, "group-4")
        self._make_sessions(60, project=self.project_two)
        self.group4 = self.event4.group

        self.rulegroup_event_mapping_two = {
            f"{self.rule3.id}:{self.group3.id}": {self.event3.event_id},
            f"{self.rule4.id}:{self.group4.id}": {self.event4.event_id},
        }
        self.buffer_mapping = {
            self.project.id: self.rulegroup_event_mapping_one,
            self.project_two.id: self.rulegroup_event_mapping_two,
        }
        buffer.backend.push_to_sorted_set(key=PROJECT_ID_BUFFER_LIST_KEY, value=self.project.id)
        buffer.backend.push_to_sorted_set(key=PROJECT_ID_BUFFER_LIST_KEY, value=self.project_two.id)

    def _push_base_events(self) -> None:
        self.push_to_hash(self.project.id, self.rule1.id, self.group1.id, self.event1.event_id)
        self.push_to_hash(self.project.id, self.rule2.id, self.group2.id, self.event2.event_id)
        self.push_to_hash(self.project_two.id, self.rule3.id, self.group3.id, self.event3.event_id)
        self.push_to_hash(self.project_two.id, self.rule4.id, self.group4.id, self.event4.event_id)


class ProcessBufferTest(ProcessDelayedAlertConditionsTestBase):
    @patch("sentry.rules.processing.buffer_processing.process_in_batches")
    def test_fetches_from_buffer_and_executes(self, mock_process_in_batches):
        self._push_base_events()
        # To get the correct mapping, we need to return the correct
        # rulegroup_event mapping based on the project_id input
        process_buffer()

        for project, rule_group_event_mapping in (
            (self.project, self.rulegroup_event_mapping_one),
            (self.project_two, self.rulegroup_event_mapping_two),
        ):
            assert mock_process_in_batches.call_count == 2

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        assert project_ids == []

    @patch("sentry.rules.processing.buffer_processing.process_in_batches")  # False option
    @patch(
        "sentry.rules.processing.delayed_processing.DelayedRule.option",
        "delayed_processing.emit_logs",
    )
    def test_skips_processing_with_option(self, mock_process_in_batches):
        self._push_base_events()
        process_buffer()

        assert mock_process_in_batches.call_count == 0

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        assert {project_id for project_id, _ in project_ids} == {
            self.project.id,
            self.project_two.id,
        }


class ProcessInBatchesTest(CreateEventTestCase):
    def setUp(self):
        super().setUp()

        self.project = self.create_project()
        self.group = self.create_group(self.project)
        self.group_two = self.create_group(self.project)
        self.group_three = self.create_group(self.project)
        self.rule = self.create_alert_rule()

    @patch("sentry.rules.processing.delayed_processing.apply_delayed.delay")
    def test_no_redis_data(self, mock_apply_delayed):
        process_in_batches(self.project.id, "delayed_processing")
        mock_apply_delayed.assert_called_once_with(self.project.id)

    @patch("sentry.rules.processing.delayed_processing.apply_delayed.delay")
    def test_basic(self, mock_apply_delayed):
        self.push_to_hash(self.project.id, self.rule.id, self.group.id)
        self.push_to_hash(self.project.id, self.rule.id, self.group_two.id)
        self.push_to_hash(self.project.id, self.rule.id, self.group_three.id)

        process_in_batches(self.project.id, "delayed_processing")
        mock_apply_delayed.assert_called_once_with(self.project.id)

    @override_options({"delayed_processing.batch_size": 2})
    @patch("sentry.rules.processing.delayed_processing.apply_delayed.delay")
    def test_batch(self, mock_apply_delayed):
        self.push_to_hash(self.project.id, self.rule.id, self.group.id)
        self.push_to_hash(self.project.id, self.rule.id, self.group_two.id)
        self.push_to_hash(self.project.id, self.rule.id, self.group_three.id)

        process_in_batches(self.project.id, "delayed_processing")
        assert mock_apply_delayed.call_count == 2

        # Validate the batches are created correctly
        batch_one_key = mock_apply_delayed.call_args_list[0][0][1]
        batch_one = buffer.backend.get_hash(
            model=Project, field={"project_id": self.project.id, "batch_key": batch_one_key}
        )
        batch_two_key = mock_apply_delayed.call_args_list[1][0][1]
        batch_two = buffer.backend.get_hash(
            model=Project, field={"project_id": self.project.id, "batch_key": batch_two_key}
        )

        assert len(batch_one) == 2
        assert len(batch_two) == 1

        # Validate that we've cleared the original data to reduce storage usage
        assert not buffer.backend.get_hash(model=Project, field={"project_id": self.project.id})

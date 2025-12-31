from dataclasses import asdict
from datetime import datetime, timedelta
from unittest.mock import ANY, MagicMock, Mock, call, patch

import pytest
from django.utils import timezone

from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.rules.conditions.event_frequency import ComparisonType
from sentry.rules.match import MatchType
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.taskworker.state import CurrentTaskState
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.utils import json
from sentry.utils.snuba import RateLimitExceeded
from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient
from sentry.workflow_engine.handlers.condition.event_frequency_query_handlers import (
    BaseEventFrequencyQueryHandler,
    EventFrequencyQueryHandler,
    EventUniqueUserFrequencyQueryHandler,
    QueryResult,
)
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    Detector,
    Workflow,
    WorkflowFireHistory,
)
from sentry.workflow_engine.models.data_condition import (
    PERCENT_CONDITIONS,
    SLOW_CONDITIONS,
    Condition,
)
from sentry.workflow_engine.processors.data_condition_group import (
    ProcessedDataConditionGroup,
    TriggerResult,
    get_slow_conditions_for_groups,
)
from sentry.workflow_engine.processors.delayed_workflow import (
    EventInstance,
    EventKey,
    EventRedisData,
    GroupQueryParams,
    UniqueConditionQuery,
    bulk_fetch_events,
    cleanup_redis_buffer,
    fetch_project,
    fetch_workflows_envs,
    fire_actions_for_groups,
    generate_unique_queries,
    get_condition_group_results,
    get_condition_query_groups,
    get_group_to_groupevent,
    get_groups_to_fire,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest
from tests.snuba.rules.conditions.test_event_frequency import BaseEventFrequencyPercentTest

FROZEN_TIME = before_now(days=1).replace(hour=1, minute=30, second=0, microsecond=0)


class TestDelayedWorkflowBase(BaseWorkflowTest, BaseEventFrequencyPercentTest):
    def setUp(self) -> None:
        super().setUp()

        self.workflow1, self.workflow1_if_dcgs = self.create_project_event_freq_workflow(
            self.project, self.environment, has_when_slow_condition=True
        )
        self.workflow2, self.workflow2_if_dcgs = self.create_project_event_freq_workflow(
            self.project
        )

        self.project2 = self.create_project()
        self.environment2 = self.create_environment(project=self.project2)
        self.workflow3, self.workflow3_if_dcgs = self.create_project_event_freq_workflow(
            self.project2, self.environment2, has_when_slow_condition=True
        )
        self.workflow4, self.workflow4_if_dcgs = self.create_project_event_freq_workflow(
            self.project2
        )

        self.event1, self.group1 = self.setup_event(self.project, self.environment, "group-1")
        self.create_event(self.project.id, FROZEN_TIME, "group-1", self.environment.name)

        self.event2, self.group2 = self.setup_event(self.project, self.environment, "group-2")
        self.create_event(self.project.id, FROZEN_TIME, "group-2", self.environment.name)

        self.workflow_group_dcg_mapping = {
            f"{self.workflow1.id}:{self.group1.id}:{self.workflow1.when_condition_group_id}:{self.workflow1_if_dcgs[0].id}:{self.workflow1_if_dcgs[1].id}",
            f"{self.workflow2.id}:{self.group2.id}::{self.workflow2_if_dcgs[0].id}:{self.workflow2_if_dcgs[1].id}",
        }

        self.event3, self.group3 = self.setup_event(self.project2, self.environment2, "group-3")
        self.create_event(self.project2.id, FROZEN_TIME, "group-3", self.environment.name)
        self.create_event(self.project2.id, FROZEN_TIME, "group-3", self.environment.name)
        self.create_event(self.project2.id, FROZEN_TIME, "group-3", self.environment.name)

        self.event4, self.group4 = self.setup_event(self.project2, self.environment2, "group-4")
        self.create_event(self.project2.id, FROZEN_TIME, "group-4")
        self._make_sessions(60, project=self.project2)

        self.workflow_group_dcg_mapping2 = {
            f"{self.workflow3.id}:{self.group3.id}:{self.workflow3.when_condition_group_id}:{self.workflow3_if_dcgs[0].id}:{self.workflow3_if_dcgs[1].id}",
            f"{self.workflow4.id}:{self.group4.id}::{self.workflow4_if_dcgs[0].id}:{self.workflow4_if_dcgs[1].id}",
        }

        self.detector = Detector.objects.get(project_id=self.project.id, type=ErrorGroupType.slug)
        self.detector_dcg = self.create_data_condition_group()
        self.detector.update(workflow_condition_group=self.detector_dcg)

        self.batch_client = DelayedWorkflowClient()
        self.batch_client.add_project_ids([self.project.id, self.project2.id])

    def create_project_event_freq_workflow(
        self,
        project: Project,
        environment: Environment | None = None,
        has_when_slow_condition: bool = False,
    ) -> tuple[Workflow, list[DataConditionGroup]]:
        detector, _ = Detector.objects.get_or_create(
            project_id=project.id, type=ErrorGroupType.slug, defaults={"config": {}}
        )

        workflow_trigger_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT
        )
        if has_when_slow_condition:
            self.create_data_condition(
                condition_group=workflow_trigger_group,
                type=Condition.EVENT_FREQUENCY_COUNT,
                comparison={"interval": "1h", "value": 100},
                condition_result=True,
            )

        workflow = self.create_workflow(
            when_condition_group=workflow_trigger_group,
            organization=project.organization,
            environment=environment,
        )
        self.create_detector_workflow(
            detector=detector,
            workflow=workflow,
        )

        workflow_action_slow_filter_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ALL
        )
        self.create_data_condition(
            condition_group=workflow_action_slow_filter_group,
            type=Condition.EVENT_FREQUENCY_PERCENT,
            comparison={"interval": "1h", "value": 100, "comparison_interval": "1w"},
            condition_result=True,
        )

        workflow_action_filter_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ALL
        )
        self.create_data_condition(
            condition_group=workflow_action_filter_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "1h", "value": 100},
            condition_result=True,
        )
        self.create_workflow_data_condition_group(
            workflow=workflow, condition_group=workflow_action_filter_group
        )
        self.create_workflow_data_condition_group(
            workflow=workflow, condition_group=workflow_action_slow_filter_group
        )

        return workflow, [workflow_action_slow_filter_group, workflow_action_filter_group]

    def setup_event(
        self, project: Project, environment: Environment, name: str
    ) -> tuple[Event, Group]:
        event = self.create_event(project.id, FROZEN_TIME, name, environment.name)
        assert event.group
        return event, event.group

    def push_to_hash(
        self,
        project_id: int,
        workflow_id: int,
        group_id: int,
        when_dcg_id: int | None,
        if_dcgs: list[DataConditionGroup],
        passing_dcgs: list[DataConditionGroup],
        event_id: str | None = None,
        occurrence_id: str | None = None,
        timestamp: datetime | None = None,
    ) -> None:
        value_dict: dict[str, str | None | datetime] = {
            "event_id": event_id,
            "occurrence_id": occurrence_id,
        }
        if timestamp:
            value_dict["timestamp"] = timestamp
        value = json.dumps(value_dict)
        when_dcg_str = str(when_dcg_id) if when_dcg_id else ""
        field = f"{workflow_id}:{group_id}:{when_dcg_str}:{','.join([str(dcg.id) for dcg in if_dcgs])}:{','.join([str(dcg.id) for dcg in passing_dcgs])}"
        self.batch_client.for_project(project_id).push_to_hash(
            batch_key=None,
            data={field: value},
        )

    def _push_base_events(self, timestamp: datetime | None = None) -> None:
        workflow_to_data = {
            self.workflow1: (
                self.project,
                self.workflow1.when_condition_group_id,
                [self.workflow1_if_dcgs[0]],
                [self.workflow1_if_dcgs[1]],
                self.event1,
                self.group1,
            ),
            self.workflow2: (
                self.project,
                None,
                [self.workflow2_if_dcgs[0]],
                [self.workflow2_if_dcgs[1]],
                self.event2,
                self.group2,
            ),
            self.workflow3: (
                self.project2,
                self.workflow3.when_condition_group_id,
                [self.workflow3_if_dcgs[0]],
                [self.workflow3_if_dcgs[1]],
                self.event3,
                self.group3,
            ),
            self.workflow4: (
                self.project2,
                None,
                [self.workflow4_if_dcgs[0]],
                [self.workflow4_if_dcgs[1]],
                self.event4,
                self.group4,
            ),
        }

        for workflow, (
            project,
            when_condition_group_id,
            if_condition_groups,
            passing_if_groups,
            event,
            group,
        ) in workflow_to_data.items():
            self.push_to_hash(
                project_id=project.id,
                workflow_id=workflow.id,
                group_id=group.id,
                when_dcg_id=when_condition_group_id,
                if_dcgs=if_condition_groups,
                passing_dcgs=passing_if_groups,
                event_id=event.event_id,
                timestamp=timestamp,
            )


class TestDelayedWorkflowHelpers(TestDelayedWorkflowBase):
    def test_fetch_project(self) -> None:
        assert fetch_project(self.project.id) == self.project
        assert fetch_project(1) is None

    def test_fetch_workflows_envs(self) -> None:
        self._push_base_events()
        event_data = EventRedisData.from_redis_data(
            self.batch_client.for_project(self.project.id).get_hash_data(batch_key=None),
            continue_on_error=False,
        )
        workflows_to_envs = fetch_workflows_envs(list(event_data.workflow_ids))
        assert workflows_to_envs == {
            self.workflow1.id: self.environment.id,
            self.workflow2.id: None,
        }

    def test_parse_none_timestamps(self) -> None:
        self._push_base_events()
        event_data = EventRedisData.from_redis_data(
            self.batch_client.for_project(self.project.id).get_hash_data(batch_key=None),
            continue_on_error=False,
        )
        for instance in event_data.events.values():
            assert instance.timestamp is None

    @freeze_time()
    def test_parse_timestamps(self) -> None:
        self._push_base_events(timestamp=timezone.now())
        event_data = EventRedisData.from_redis_data(
            self.batch_client.for_project(self.project.id).get_hash_data(batch_key=None),
            continue_on_error=False,
        )
        for instance in event_data.events.values():
            assert instance.timestamp == timezone.now()


class TestDelayedWorkflowQueries(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow()

        self.count_dc = self.create_data_condition(
            condition_group=self.workflow_triggers,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "1h", "value": 100},
            condition_result=True,
        )

        self.percent_dc = self.create_data_condition(
            condition_group=self.workflow_triggers,
            type=Condition.EVENT_FREQUENCY_PERCENT,
            comparison={"interval": "1h", "value": 100, "comparison_interval": "1w"},
            condition_result=True,
        )

        self.workflow_filters = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ALL
        )
        self.create_data_condition(
            condition_group=self.workflow_filters,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "1h", "value": 100},
            condition_result=True,
        )
        self.create_workflow_data_condition_group(
            workflow=self.workflow, condition_group=self.workflow_filters
        )

    def test_generate_unique_queries(self) -> None:
        count_queries = generate_unique_queries(self.count_dc, None)
        percent_queries = generate_unique_queries(self.percent_dc, None)

        assert len(count_queries) == 1
        assert len(percent_queries) == 2
        assert count_queries[0] == percent_queries[0]  # they share 1 query

        # 2nd query for percent is the same as the 1st but has comparison interval
        comparison_query_dict = asdict(percent_queries[0])
        comparison_query_dict["comparison_interval"] = "1w"
        expected_comparison_query = UniqueConditionQuery(**comparison_query_dict)
        assert percent_queries[1] == expected_comparison_query

    def test_generate_unique_queries__filters_hashable(self) -> None:
        dc = self.create_data_condition(
            condition_group=self.create_data_condition_group(
                logic_type=DataConditionGroup.Type.ALL
            ),
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={
                "interval": "1h",
                "value": 100,
                "filters": [
                    {
                        "key": "http.method",
                        "match": MatchType.IS_IN,
                        "value": "GET,POST",
                    }
                ],
            },
            condition_result=True,
        )
        queries = generate_unique_queries(dc, None)
        [hash(query) for query in queries]  # shouldn't raise
        assert len(queries) == 1
        assert queries[0].filters == [
            {
                "key": "http.method",
                "match": MatchType.IS_IN,
                "value": "GET,POST",
            }
        ]

    def test_generate_unique_queries__invalid(self) -> None:
        dc = self.create_data_condition(
            condition_group=self.workflow_triggers,
            type=Condition.REGRESSION_EVENT,
            comparison=True,
            condition_result=True,
        )

        # not slow condition
        assert generate_unique_queries(dc, None) == []

        # invalid condition.type
        dc.update(type="asdf")
        assert generate_unique_queries(dc, None) == []

        # no handler
        dc.update(type=Condition.NOT_EQUAL)
        assert generate_unique_queries(dc, None) == []

    def test_get_condition_query_groups(self) -> None:
        group2 = self.create_group()
        group3 = self.create_group()
        group4 = self.create_group()

        other_workflow_filters = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ALL
        )
        other_condition = self.create_data_condition(
            condition_group=other_workflow_filters,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "15m", "value": 100},
            condition_result=True,
        )
        self.create_workflow_data_condition_group(
            workflow=self.workflow, condition_group=other_workflow_filters
        )
        detector_dcg = self.create_data_condition_group()
        _ = self.create_data_condition(
            condition_group=detector_dcg,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "15m", "value": 100},
            condition_result=True,
        )  # same as other_condition
        self.detector.update(workflow_condition_group=detector_dcg)

        dcgs = [self.workflow_triggers, self.workflow_filters, other_workflow_filters, detector_dcg]
        dcg_to_groups = {
            self.workflow_triggers.id: {self.group.id},
            self.workflow_filters.id: {group2.id},
            other_workflow_filters.id: {group3.id},
            detector_dcg.id: {group4.id},
        }
        dcg_to_workflow = {
            self.workflow_triggers.id: self.workflow.id,
            self.workflow_filters.id: self.workflow.id,
            other_workflow_filters.id: self.workflow.id,
        }
        current_time = timezone.now()
        dcg_to_timestamp = {
            self.workflow_triggers.id: current_time,
            self.workflow_filters.id: current_time + timedelta(minutes=1),
            other_workflow_filters.id: current_time + timedelta(minutes=2),
            detector_dcg.id: current_time + timedelta(minutes=3),
        }
        workflows_to_envs: dict[int, int | None] = {self.workflow.id: None}

        # Create mock event data with just the required properties
        mock_event_data = Mock(spec=EventRedisData)
        mock_event_data.dcg_to_groups = dcg_to_groups
        mock_event_data.dcg_to_workflow = dcg_to_workflow
        mock_event_data.dcg_to_timestamp = dcg_to_timestamp

        dcg_to_slow_conditions = get_slow_conditions_for_groups(list(dcg_to_groups.keys()))
        result = get_condition_query_groups(
            dcgs, mock_event_data, workflows_to_envs, dcg_to_slow_conditions
        )

        count_query = generate_unique_queries(self.count_dc, None)[0]
        percent_only_query = generate_unique_queries(self.percent_dc, None)[1]
        different_query = generate_unique_queries(other_condition, None)[0]

        assert result[count_query].group_ids == {
            self.group.id,
            group2.id,
        }  # count and percent condition
        assert result[count_query].timestamp == current_time + timedelta(
            minutes=1
        )  # uses latest timestamp
        assert result[percent_only_query].group_ids == {self.group.id}
        assert result[percent_only_query].timestamp == current_time
        assert result[different_query].group_ids == {group3.id, group4.id}
        assert result[different_query].timestamp == current_time + timedelta(minutes=3)


@freeze_time(FROZEN_TIME)
class TestGetSnubaResults(BaseWorkflowTest):
    def tearDown(self) -> None:
        super().tearDown()

    def create_events(self, comparison_type: ComparisonType) -> Event:
        # Create current events for the first query
        event = self.create_event(self.project.id, FROZEN_TIME, "group-1", self.environment.name)
        self.create_event(self.project.id, FROZEN_TIME, "group-1", self.environment.name)
        if comparison_type == ComparisonType.PERCENT:
            # Create a past event for the second query
            self.create_event(
                self.project.id,
                FROZEN_TIME - timedelta(hours=1, minutes=10),
                "group-1",
                self.environment.name,
            )
        return event

    def create_condition_groups(
        self, data_conditions: list[DataCondition], timestamp: datetime | None = None
    ) -> tuple[dict[UniqueConditionQuery, GroupQueryParams], int, list[UniqueConditionQuery]]:
        condition_groups: dict[UniqueConditionQuery, GroupQueryParams] = {}
        all_unique_queries = []
        for data_condition in data_conditions:
            unique_queries = generate_unique_queries(data_condition, self.environment.id)
            comparison_type = (
                ComparisonType.PERCENT
                if Condition(data_condition.type) in PERCENT_CONDITIONS
                else ComparisonType.COUNT
            )
            event = self.create_events(comparison_type)
            assert event.group
            group = event.group
            condition_groups.update(
                {
                    query: GroupQueryParams(group_ids={event.group.id}, timestamp=timestamp)
                    for query in unique_queries
                }
            )
            all_unique_queries.extend(unique_queries)
        return condition_groups, group.id, all_unique_queries

    def create_event_frequency_condition(
        self, type: Condition | None = Condition.EVENT_FREQUENCY_COUNT
    ) -> DataCondition:
        if type not in SLOW_CONDITIONS:
            raise ValueError(f"{type} is not a slow condition")

        comparison = {"interval": "1h", "value": 100}

        if type in PERCENT_CONDITIONS:
            comparison["comparison_interval"] = "15m"

        return self.create_data_condition(
            type=type,
            comparison=comparison,
            condition_result=True,
        )

    def test_empty_condition_groups(self) -> None:
        assert get_condition_group_results({}) == {}

    def test_count_comparison_condition(self) -> None:
        dc = self.create_event_frequency_condition()
        condition_groups, group_id, unique_queries = self.create_condition_groups([dc])

        results = get_condition_group_results(condition_groups)
        assert results == {
            unique_queries[0]: {group_id: 2},
        }

    def test_with_enqueue_time(self) -> None:
        dc = self.create_event_frequency_condition()
        condition_groups, group_id, unique_queries = self.create_condition_groups(
            [dc], timestamp=timezone.now() - timedelta(minutes=1)
        )

        # events created at timezone.now(), querying for 1 minute before should return no events
        results = get_condition_group_results(condition_groups)
        assert results == {
            unique_queries[0]: {group_id: 0},
        }

    def test_percent_comparison_condition(self) -> None:
        dc = self.create_event_frequency_condition(type=Condition.EVENT_FREQUENCY_PERCENT)
        condition_groups, group_id, unique_queries = self.create_condition_groups([dc])
        results = get_condition_group_results(condition_groups)

        present_percent_query, offset_percent_query = unique_queries

        assert results == {
            present_percent_query: {group_id: 2},
            offset_percent_query: {group_id: 1},
        }

    def test_count_percent_conditions_together(self) -> None:
        """
        Test that a percent and count condition are processed as expected.
        """
        count_dc = self.create_event_frequency_condition()
        percent_dc = self.create_event_frequency_condition(type=Condition.EVENT_FREQUENCY_PERCENT)
        condition_groups, group_id, all_queries = self.create_condition_groups(
            [count_dc, percent_dc]
        )

        results = get_condition_group_results(condition_groups)

        count_query, present_percent_query, offset_percent_query = all_queries
        # The count query and first percent query should be identical
        assert count_query == present_percent_query

        # We should only query twice b/c the count query and first percent query
        # share a single scan.
        assert results == {
            count_query: {group_id: 4},
            offset_percent_query: {group_id: 1},
        }

    def test_get_condition_group_results_exception_propagation(self) -> None:
        """
        When we get an exception from the handler, we should propagate it.
        We don't want to proceed with partial data.
        """
        mock_handler = Mock(spec=BaseEventFrequencyQueryHandler)
        mock_handler.get_rate_bulk.side_effect = ValueError("Escaping exception")
        mock_handler.intervals = {"1h": ("fake", timedelta(seconds=1))}

        unique_query = UniqueConditionQuery(
            handler=lambda: mock_handler,  # type: ignore[arg-type]
            interval="1h",
            environment_id=None,
        )

        condition_groups = {
            unique_query: GroupQueryParams(group_ids={1}, timestamp=None)
        }  # One group ID to query

        with pytest.raises(ValueError, match="Escaping exception"):
            get_condition_group_results(condition_groups)

    @patch("sentry.workflow_engine.processors.delayed_workflow.current_task")
    def test_get_condition_group_results_rate_limit_on_last_try(
        self, mock_current_task: MagicMock
    ) -> None:
        mock_task = Mock(spec=CurrentTaskState)
        mock_task.retries_remaining = False
        mock_current_task.return_value = mock_task

        mock_handler = Mock(spec=BaseEventFrequencyQueryHandler)
        mock_handler.get_rate_bulk.side_effect = RateLimitExceeded("Rate limited")
        mock_handler.intervals = {"1h": ("fake", timedelta(seconds=1))}

        unique_query = UniqueConditionQuery(
            handler=lambda: mock_handler,  # type: ignore[arg-type]
            interval="1h",
            environment_id=None,
        )

        condition_groups = {unique_query: GroupQueryParams(group_ids={1}, timestamp=None)}

        # Should not raise, returns empty results
        result = get_condition_group_results(condition_groups)
        assert result == {}


class TestGetGroupsToFire(TestDelayedWorkflowBase):
    def setUp(self) -> None:
        super().setUp()

        assert self.workflow1.when_condition_group
        assert self.workflow2.when_condition_group

        self.data_condition_groups: list[DataConditionGroup] = (
            [
                self.workflow1.when_condition_group,
                self.workflow2.when_condition_group,
            ]
            + self.workflow1_if_dcgs
            + self.workflow2_if_dcgs
        )

        self.workflows_to_envs = {self.workflow1.id: self.environment.id, self.workflow2.id: None}
        self.condition_group_results: dict[UniqueConditionQuery, QueryResult] = {
            UniqueConditionQuery(
                handler=EventFrequencyQueryHandler,
                interval="1h",
                environment_id=self.environment.id,
            ): {self.group1.id: 101, self.group2.id: 101},
            UniqueConditionQuery(
                handler=EventFrequencyQueryHandler,
                interval="1h",
                comparison_interval="1w",
                environment_id=self.environment.id,
            ): {self.group1.id: 50, self.group2.id: 50},
            UniqueConditionQuery(
                handler=EventFrequencyQueryHandler, interval="1h", environment_id=None
            ): {self.group1.id: 101, self.group2.id: 101},
            UniqueConditionQuery(
                handler=EventFrequencyQueryHandler,
                interval="1h",
                comparison_interval="1w",
                environment_id=None,
            ): {self.group1.id: 202, self.group2.id: 202},
            UniqueConditionQuery(
                handler=EventUniqueUserFrequencyQueryHandler,
                interval="1h",
                environment_id=self.environment.id,
            ): {self.group1.id: 101, self.group2.id: 101},
            UniqueConditionQuery(
                handler=EventUniqueUserFrequencyQueryHandler, interval="1h", environment_id=None
            ): {self.group1.id: 50, self.group2.id: 50},
        }

        # add slow condition to workflow1 slow condition IF dcg (ALL), passes
        self.create_data_condition(
            condition_group=self.workflow1_if_dcgs[0],
            type=Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
            comparison={"interval": "1h", "value": 100},
            condition_result=True,
        )

        # add slow condition to workflow2 WHEN dcg (ANY), passes
        self.create_data_condition(
            condition_group=self.workflow2.when_condition_group,
            type=Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
            comparison={"interval": "1h", "value": 20},
            condition_result=True,
        )

        self.event_data = EventRedisData(
            events={
                EventKey.from_redis_key(
                    f"{self.workflow1.id}:{self.group1.id}:{self.workflow1.when_condition_group_id}:{self.workflow1_if_dcgs[0].id}:{self.workflow1_if_dcgs[1].id}"
                ): EventInstance(event_id="test-event-1"),
                EventKey.from_redis_key(
                    f"{self.workflow2.id}:{self.group2.id}:{self.workflow2.when_condition_group_id}:{self.workflow2_if_dcgs[0].id}:{self.workflow2_if_dcgs[1].id}"
                ): EventInstance(event_id="test-event-2"),
            }
        )

        self.dcg_to_slow_conditions = get_slow_conditions_for_groups(list(self.event_data.dcg_ids))

    def test_simple(self) -> None:
        result, _ = get_groups_to_fire(
            self.data_condition_groups,
            self.workflows_to_envs,
            self.event_data,
            self.condition_group_results,
            self.dcg_to_slow_conditions,
        )

        # NOTE: no WHEN DCGs. We only collect IF DCGs here to fire their actions in the fire_actions_for_groups function
        assert result == {
            self.group1.id: set(self.workflow1_if_dcgs),
            self.group2.id: {
                self.workflow2_if_dcgs[1]
            },  # WHEN DCG passed so we have the passing if dcg here. IF DCG with slow condition did not pass
        }

    def test_missing_query_result_excludes_group(self) -> None:
        existing_query = UniqueConditionQuery(
            handler=EventUniqueUserFrequencyQueryHandler, interval="1h", environment_id=None
        )
        existing_result = self.condition_group_results[existing_query]
        assert self.group2.id in existing_result
        self.condition_group_results[existing_query] = {
            self.group1.id: existing_result[self.group1.id]
        }

        result, _ = get_groups_to_fire(
            self.data_condition_groups,
            self.workflows_to_envs,
            self.event_data,
            self.condition_group_results,
            self.dcg_to_slow_conditions,
        )

        # group2 should be excluded because it's missing from the query result
        assert result == {
            self.group1.id: set(self.workflow1_if_dcgs),
        }

    def test_dcg_all_fails(self) -> None:
        self.condition_group_results.update(
            {
                UniqueConditionQuery(
                    handler=EventUniqueUserFrequencyQueryHandler,
                    interval="1h",
                    environment_id=self.environment.id,
                ): {self.group1.id: 99}
            }
        )

        result, _ = get_groups_to_fire(
            self.data_condition_groups,
            self.workflows_to_envs,
            self.event_data,
            self.condition_group_results,
            self.dcg_to_slow_conditions,
        )

        assert result == {
            self.group1.id: {self.workflow1_if_dcgs[1]},
            self.group2.id: {self.workflow2_if_dcgs[1]},
        }

    def test_dcg_any_fails(self) -> None:
        self.condition_group_results.update(
            {
                UniqueConditionQuery(
                    handler=EventUniqueUserFrequencyQueryHandler, interval="1h", environment_id=None
                ): {self.group2.id: 10}
            }
        )

        result, _ = get_groups_to_fire(
            self.data_condition_groups,
            self.workflows_to_envs,
            self.event_data,
            self.condition_group_results,
            self.dcg_to_slow_conditions,
        )

        assert result == {
            self.group1.id: set(self.workflow1_if_dcgs),
        }

    def test_ignored_deleted_dcgs(self) -> None:
        self.workflow1_if_dcgs[0].delete()
        self.workflow2_if_dcgs[1].delete()

        assert self.workflow1.when_condition_group
        assert self.workflow2.when_condition_group

        self.data_condition_groups = (
            [
                self.workflow1.when_condition_group,
                self.workflow2.when_condition_group,
            ]
            + [self.workflow1_if_dcgs[1]]
            + [self.workflow2_if_dcgs[0]]
        )

        result, _ = get_groups_to_fire(
            self.data_condition_groups,
            self.workflows_to_envs,
            self.event_data,
            self.condition_group_results,
            self.dcg_to_slow_conditions,
        )

        # NOTE: same result as test_simple but without the deleted DCGs
        assert result == {
            self.group1.id: {self.workflow1_if_dcgs[1]},
        }

    def test_ignored_deleted_workflow(self) -> None:
        self.workflow1.delete()

        self.workflows_to_envs = {self.workflow2.id: None}

        result, _ = get_groups_to_fire(
            self.data_condition_groups,
            self.workflows_to_envs,
            self.event_data,
            self.condition_group_results,
            self.dcg_to_slow_conditions,
        )

        # NOTE: same result as test_simple but without the deleted workflow
        assert result == {self.group2.id: {self.workflow2_if_dcgs[1]}}

    def test_tainted_when_condition_doesnt_trigger(self) -> None:
        query_for_when = UniqueConditionQuery(
            handler=EventFrequencyQueryHandler,
            interval="1h",
            environment_id=self.environment.id,
        )
        self.condition_group_results[query_for_when] = {self.group2.id: 101}

        result, stats = get_groups_to_fire(
            self.data_condition_groups,
            self.workflows_to_envs,
            self.event_data,
            self.condition_group_results,
            self.dcg_to_slow_conditions,
        )

        assert result == {
            self.group2.id: {self.workflow2_if_dcgs[1]},
        }
        assert stats.tainted == 2
        assert stats.untainted == 2

    def test_when_untainted_doesnt_trigger(self) -> None:
        query_for_when = UniqueConditionQuery(
            handler=EventFrequencyQueryHandler,
            interval="1h",
            environment_id=self.environment.id,
        )
        self.condition_group_results[query_for_when] = {self.group1.id: 99, self.group2.id: 101}

        result, stats = get_groups_to_fire(
            self.data_condition_groups,
            self.workflows_to_envs,
            self.event_data,
            self.condition_group_results,
            self.dcg_to_slow_conditions,
        )

        assert result == {
            self.group2.id: {self.workflow2_if_dcgs[1]},
        }
        assert stats.tainted == 0
        assert stats.untainted == 4

    def test_tainted_if_condition_counts(self) -> None:
        query_for_if = UniqueConditionQuery(
            handler=EventUniqueUserFrequencyQueryHandler,
            interval="1h",
            environment_id=self.environment.id,
        )
        self.condition_group_results[query_for_if] = {self.group2.id: 101}

        result, stats = get_groups_to_fire(
            self.data_condition_groups,
            self.workflows_to_envs,
            self.event_data,
            self.condition_group_results,
            self.dcg_to_slow_conditions,
        )

        assert result == {
            self.group1.id: {self.workflow1_if_dcgs[1]},
            self.group2.id: {self.workflow2_if_dcgs[1]},
        }
        assert stats.tainted == 1
        assert stats.untainted == 3


class TestFireActionsForGroups(TestDelayedWorkflowBase):
    def setUp(self) -> None:
        super().setUp()

        action1 = self.create_action(
            type=Action.Type.DISCORD,
            integration_id="1234567890",
            config={"target_identifier": "channel456", "target_type": ActionTarget.SPECIFIC},
            data={"tags": "environment,user,my_tag"},
        )
        self.create_data_condition_group_action(
            condition_group=self.workflow1_if_dcgs[0], action=action1
        )

        action2 = self.create_action(
            type=Action.Type.SLACK,
            integration_id="1234567890",
            data={"tags": "environment,user", "notes": "Important alert"},
            config={
                "target_identifier": "channel789",
                "target_display": "#general",
                "target_type": ActionTarget.SPECIFIC,
            },
        )
        self.create_data_condition_group_action(
            condition_group=self.workflow2_if_dcgs[0], action=action2
        )

        self.groups_to_dcgs = {
            self.group1.id: set(self.workflow1_if_dcgs),
            self.group2.id: set(self.workflow2_if_dcgs),
        }

        self.group_to_groupevent: dict[Group, tuple[GroupEvent, datetime | None]] = {}
        self.group_to_groupevent[self.group1] = (
            self.event1.for_group(self.group1),
            None,
        )
        self.group_to_groupevent[self.group2] = (
            self.event2.for_group(self.group2),
            None,
        )

    def test_bulk_fetch_events(self) -> None:
        event_ids = [self.event1.event_id, self.event2.event_id]
        events = bulk_fetch_events(event_ids, self.project)

        for event in list(events.values()):
            assert event.event_id in event_ids
            # For perf reasons, we want to be sure the events have the project cached.
            assert event._project_cache == self.project

    def test_get_group_to_groupevent(self) -> None:
        self._push_base_events()
        buffer_data = self.batch_client.for_project(self.project.id).get_hash_data(batch_key=None)
        event_data = EventRedisData.from_redis_data(buffer_data, continue_on_error=False)
        group_to_groupevent = get_group_to_groupevent(
            event_data,
            self.groups_to_dcgs,
            self.project,
        )
        assert group_to_groupevent == self.group_to_groupevent

    @patch("sentry.workflow_engine.tasks.actions.trigger_action.apply_async")
    def test_fire_actions_for_groups__fire_actions(self, mock_trigger: MagicMock) -> None:
        fire_actions_for_groups(
            self.project.organization,
            self.groups_to_dcgs,
            self.group_to_groupevent,
        )

        assert mock_trigger.call_count == 2

        # First call should be for workflow1/group1
        first_call_kwargs = mock_trigger.call_args_list[0].kwargs["kwargs"]
        assert first_call_kwargs["event_id"] == self.event1.event_id
        assert first_call_kwargs["group_id"] == self.group1.id
        assert first_call_kwargs["workflow_id"] == self.workflow1.id

        # Second call should be for workflow2/group2
        second_call_kwargs = mock_trigger.call_args_list[1].kwargs["kwargs"]
        assert second_call_kwargs["event_id"] == self.event2.event_id
        assert second_call_kwargs["group_id"] == self.group2.id
        assert second_call_kwargs["workflow_id"] == self.workflow2.id

    @with_feature("organizations:workflow-engine-single-process-workflows")
    @patch("sentry.workflow_engine.processors.workflow.process_data_condition_group")
    @override_options({"workflow_engine.issue_alert.group.type_id.ga": [1]})
    def test_fire_actions_for_groups__workflow_fire_history(self, mock_process: MagicMock) -> None:
        mock_process.return_value = (
            ProcessedDataConditionGroup(logic_result=TriggerResult.TRUE, condition_results=[]),
            [],
        )

        self.groups_to_dcgs = {
            self.group1.id: {self.workflow1_if_dcgs[0]},
            self.group2.id: {self.workflow2_if_dcgs[0]},
        }

        fire_actions_for_groups(
            self.project.organization,
            self.groups_to_dcgs,
            self.group_to_groupevent,
        )

        assert WorkflowFireHistory.objects.filter(
            workflow=self.workflow2,
            group_id=self.group2.id,
            event_id=self.event2.event_id,
        ).exists()

        assert WorkflowFireHistory.objects.filter(
            workflow=self.workflow1,
            group_id=self.group1.id,
            event_id=self.event1.event_id,
        ).exists()

    @with_feature("projects:servicehooks")
    @patch("sentry.sentry_apps.tasks.service_hooks.process_service_hook")
    def test_fire_actions_for_groups__service_hooks(
        self, mock_process_service_hook: MagicMock
    ) -> None:
        hook = self.create_service_hook(
            project=self.project,
            organization=self.project.organization,
            actor=self.user,
            events=["event.alert"],
        )

        fire_actions_for_groups(
            self.project.organization,
            self.groups_to_dcgs,
            self.group_to_groupevent,
        )

        assert mock_process_service_hook.delay.call_count == 2

        mock_process_service_hook.delay.assert_has_calls(
            [
                call(
                    servicehook_id=hook.id,
                    project_id=self.project.id,
                    group_id=self.group1.id,
                    event_id=self.event1.event_id,
                ),
                call(
                    servicehook_id=hook.id,
                    project_id=self.project.id,
                    group_id=self.group2.id,
                    event_id=self.event2.event_id,
                ),
            ]
        )


class TestCleanupRedisBuffer(TestDelayedWorkflowBase):
    def test_cleanup_redis(self) -> None:
        self._push_base_events()

        project_client = self.batch_client.for_project(self.project.id)
        data = project_client.get_hash_data(batch_key=None)
        assert set(data.keys()) == self.workflow_group_dcg_mapping

        event_data = EventRedisData.from_redis_data(data, continue_on_error=False)
        cleanup_redis_buffer(project_client, event_data.events.keys(), None)
        data = project_client.get_hash_data(batch_key=None)
        assert data == {}


class TestEventKeyAndInstance:
    def test_event_key_from_redis_key(self) -> None:
        key = "123:456:789:1,2,3:10,9,8"
        event_key = EventKey.from_redis_key(key)
        assert event_key.workflow_id == 123
        assert event_key.group_id == 456
        assert event_key.when_dcg_id == 789
        assert event_key.if_dcg_ids == frozenset([1, 2, 3])
        assert event_key.passing_dcg_ids == frozenset([10, 9, 8])
        assert event_key.original_key == key

    def test_event_key_from_redis_key_invalid(self) -> None:
        # Test various invalid key formats
        invalid_cases = [
            "invalid-key",  # missing colons
            "1:2:3:4:5:6",  # too many parts
            "1:2",  # too few parts
            "1:2:3:invalid_type",  # invalid type
            "1:2:3:invalid_type:2",  # invalid dcg_ids format
            "not_a_number:2:3:4:5",  # non-numeric workflow_id
            "1:not_a_number:3:4:5,6",  # non-numeric group_id
        ]

        for key in invalid_cases:
            with pytest.raises(ValueError):
                EventKey.from_redis_key(key)

    def test_event_key_str_and_hash(self) -> None:
        key = "123:456:789:1,2,3:10,9,8"
        event_key = EventKey.from_redis_key(key)
        assert str(event_key) == key
        assert hash(event_key) == hash(key)
        assert event_key == EventKey.from_redis_key(key)
        assert event_key != EventKey.from_redis_key("122:456:789:1,2,3:10,9,8")

    def test_event_instance_validation(self) -> None:
        # Test valid event instance
        instance = EventInstance(event_id="test-event")
        assert instance.event_id == "test-event"
        assert instance.occurrence_id is None

        # Test with occurrence ID
        instance = EventInstance(event_id="test-event", occurrence_id="test-occurrence")
        assert instance.event_id == "test-event"
        assert instance.occurrence_id == "test-occurrence"

        # Test empty occurrence ID is converted to None
        instance = EventInstance(event_id="test-event", occurrence_id="")
        assert instance.event_id == "test-event"
        assert instance.occurrence_id is None

        # Test whitespace occurrence ID is converted to None
        instance = EventInstance(event_id="test-event", occurrence_id="   ")
        assert instance.event_id == "test-event"
        assert instance.occurrence_id is None

        # Test invalid cases
        invalid_cases = [
            ('{"occurrence_id": "test-occurrence"}', "event_id"),  # missing event_id
            ('{"event_id": ""}', "event_id"),  # empty event_id
            ('{"event_id": "   "}', "event_id"),  # whitespace event_id
            ('{"event_id": null}', "event_id"),  # null event_id
        ]

        for json_data, expected_error in invalid_cases:
            with pytest.raises(ValueError, match=expected_error):
                EventInstance.parse_raw(json_data)

        # Test that extra fields are ignored
        instance = EventInstance.parse_raw('{"event_id": "test", "extra": "field"}')
        assert instance.event_id == "test"
        assert instance.occurrence_id is None

        instance = EventInstance.parse_raw(
            '{"event_id": "test", "occurrence_id": "test", "extra": "field"}'
        )
        assert instance.event_id == "test"
        assert instance.occurrence_id == "test"

    @patch("sentry.workflow_engine.processors.delayed_workflow.logger")
    def test_from_redis_data_continue_on_error(self, mock_logger: MagicMock) -> None:
        # Create a mix of valid and invalid data
        redis_data = {
            "123:456:789:1,2,3:10,9,8": '{"event_id": "valid-1"}',  # valid
            "439:1:3487:134,6:34": '{"occurrence_id": "invalid-1"}',  # missing event_id
            "5:456:22:1:44,33": '{"event_id": "valid-2"}',  # valid
        }

        # With continue_on_error=True, should return valid entries and log errors
        result = EventRedisData.from_redis_data(redis_data, continue_on_error=True)
        assert len(result.events) == 2
        assert (
            result.events[EventKey.from_redis_key("123:456:789:1,2,3:10,9,8")].event_id == "valid-1"
        )
        assert result.events[EventKey.from_redis_key("5:456:22:1:44,33")].event_id == "valid-2"

        # Verify error was logged
        mock_logger.exception.assert_called_once_with(
            "Failed to parse workflow event data",
            extra={
                "key": "439:1:3487:134,6:34",
                "value": '{"occurrence_id": "invalid-1"}',
                "error": ANY,
            },
        )

        # With continue_on_error=False, should raise on first error
        with pytest.raises(ValueError, match="event_id"):
            EventRedisData.from_redis_data(redis_data, continue_on_error=False)

    @patch("sentry.workflow_engine.processors.delayed_workflow.logger")
    def test_from_redis_data_invalid_keys(self, mock_logger: MagicMock) -> None:
        # Create data with an invalid key structure
        redis_data = {
            "123:456:789:1,2,3:10,9,8": '{"event_id": "valid-1"}',  # valid
            "invalid-key": '{"event_id": "valid-2"}',  # invalid key format
            "5:456:22:1:44,33": '{"event_id": "valid-3"}',  # valid
        }

        # With continue_on_error=True, should return valid entries and log errors
        result = EventRedisData.from_redis_data(redis_data, continue_on_error=True)
        assert len(result.events) == 2
        assert (
            result.events[EventKey.from_redis_key("123:456:789:1,2,3:10,9,8")].event_id == "valid-1"
        )
        assert result.events[EventKey.from_redis_key("5:456:22:1:44,33")].event_id == "valid-3"

        # Verify error was logged
        mock_logger.exception.assert_called_once_with(
            "Failed to parse workflow event data",
            extra={
                "key": "invalid-key",
                "value": '{"event_id": "valid-2"}',
                "error": ANY,
            },
        )

        # With continue_on_error=False, should raise on first error
        with pytest.raises(ValueError):
            EventRedisData.from_redis_data(redis_data, continue_on_error=False)

    def test_dcg_to_timestamp(self) -> None:
        timestamp1 = timezone.now()
        timestamp2 = timestamp1 + timedelta(hours=1)
        timestamp3 = timestamp2 + timedelta(hours=1)

        redis_data = {
            # DCG 1 -> ts1
            "123:456:1::": json.dumps({"event_id": "event-1", "timestamp": timestamp1.isoformat()}),
            # DCG 1 -> ts2 (now latest)
            "123:457::1:": json.dumps({"event_id": "event-2", "timestamp": timestamp2.isoformat()}),
            # DCG 2 -> ts3
            "123:458::2:": json.dumps({"event_id": "event-3", "timestamp": timestamp3.isoformat()}),
            # DCG 3 -> no timestamp
            "123:459:::3": json.dumps({"event_id": "event-4"}),
        }

        event_data = EventRedisData.from_redis_data(redis_data, continue_on_error=True)
        dcg_to_timestamp = event_data.dcg_to_timestamp

        assert dcg_to_timestamp[1] == timestamp2
        assert dcg_to_timestamp[2] == timestamp3
        assert 3 not in dcg_to_timestamp

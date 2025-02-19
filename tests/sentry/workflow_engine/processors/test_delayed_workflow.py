from collections import defaultdict
from dataclasses import asdict
from datetime import timedelta
from unittest.mock import patch

from sentry import buffer
from sentry.eventstore.models import Event
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.rules.conditions.event_frequency import ComparisonType
from sentry.rules.processing.buffer_processing import process_in_batches
from sentry.rules.processing.delayed_processing import fetch_project
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.redis import mock_redis_buffer
from sentry.utils import json
from sentry.workflow_engine.handlers.condition.slow_condition_query_handlers import (
    EventFrequencyQueryHandler,
    EventUniqueUserFrequencyQueryHandler,
)
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    Detector,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import (
    PERCENT_CONDITIONS,
    SLOW_CONDITIONS,
    Condition,
)
from sentry.workflow_engine.processors.delayed_workflow import (
    DataConditionGroupEvent,
    DataConditionGroupGroups,
    UniqueConditionQuery,
    bulk_fetch_events,
    cleanup_redis_buffer,
    fetch_group_to_event_data,
    fetch_workflows_envs,
    fire_actions_for_groups,
    generate_unique_queries,
    get_condition_group_results,
    get_condition_query_groups,
    get_dcg_group_workflow_detector_data,
    get_group_to_groupevent,
    get_groups_to_fire,
    parse_dcg_group_event_data,
)
from sentry.workflow_engine.processors.workflow import (
    WORKFLOW_ENGINE_BUFFER_LIST_KEY,
    WorkflowDataConditionGroupType,
)
from sentry.workflow_engine.types import DataConditionHandlerType
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest
from tests.snuba.rules.conditions.test_event_frequency import BaseEventFrequencyPercentTest

FROZEN_TIME = before_now(days=1).replace(hour=1, minute=30, second=0, microsecond=0)


class TestDelayedWorkflowBase(BaseWorkflowTest, BaseEventFrequencyPercentTest):
    def setUp(self):
        super().setUp()

        self.workflow1, self.workflow1_dcgs = self.create_project_event_freq_workflow(
            self.project, self.environment
        )
        self.workflow2, self.workflow2_dcgs = self.create_project_event_freq_workflow(self.project)

        self.project2 = self.create_project()
        self.environment2 = self.create_environment(project=self.project2)
        self.workflow3, self.workflow3_dcgs = self.create_project_event_freq_workflow(
            self.project2, self.environment2
        )
        self.workflow4, self.workflow4_dcgs = self.create_project_event_freq_workflow(self.project2)

        self.event1, self.group1 = self.setup_event(self.project, self.environment, "group-1")
        self.create_event(self.project.id, FROZEN_TIME, "group-1", self.environment.name)

        self.event2, self.group2 = self.setup_event(self.project, self.environment, "group-2")
        self.create_event(self.project.id, FROZEN_TIME, "group-2", self.environment.name)

        self.workflow_group_dcg_mapping = {
            f"{self.workflow1.id}:{self.group1.id}:{self.workflow1_dcgs[0].id}:{DataConditionHandlerType.WORKFLOW_TRIGGER}",
            f"{self.workflow1.id}:{self.group1.id}:{self.workflow1_dcgs[1].id}:{DataConditionHandlerType.ACTION_FILTER}",
            f"{self.workflow2.id}:{self.group2.id}:{self.workflow2_dcgs[0].id}:{DataConditionHandlerType.WORKFLOW_TRIGGER}",
            f"{self.workflow2.id}:{self.group2.id}:{self.workflow2_dcgs[1].id}:{DataConditionHandlerType.ACTION_FILTER}",
        }

        self.event3, self.group3 = self.setup_event(self.project2, self.environment2, "group-3")
        self.create_event(self.project2.id, FROZEN_TIME, "group-3", self.environment.name)
        self.create_event(self.project2.id, FROZEN_TIME, "group-3", self.environment.name)
        self.create_event(self.project2.id, FROZEN_TIME, "group-3", self.environment.name)

        self.event4, self.group4 = self.setup_event(self.project2, self.environment2, "group-4")
        self.create_event(self.project2.id, FROZEN_TIME, "group-4")
        self._make_sessions(60, project=self.project2)

        self.workflow_group_dcg_mapping2 = {
            f"{self.workflow3.id}:{self.group3.id}:{self.workflow3_dcgs[0].id}:{DataConditionHandlerType.WORKFLOW_TRIGGER}",
            f"{self.workflow3.id}:{self.group3.id}:{self.workflow3_dcgs[1].id}:{DataConditionHandlerType.ACTION_FILTER}",
            f"{self.workflow4.id}:{self.group4.id}:{self.workflow4_dcgs[0].id}:{DataConditionHandlerType.WORKFLOW_TRIGGER}",
            f"{self.workflow4.id}:{self.group4.id}:{self.workflow4_dcgs[1].id}:{DataConditionHandlerType.ACTION_FILTER}",
        }

        self.dcg_to_groups: DataConditionGroupGroups = {
            dcg.id: {self.group1.id} for dcg in self.workflow1_dcgs
        } | {dcg.id: {self.group2.id} for dcg in self.workflow2_dcgs}
        self.trigger_type_to_dcg_model: dict[DataConditionHandlerType, dict[int, int]] = (
            defaultdict(dict)
        )

        self.workflow_dcgs = self.workflow1_dcgs + self.workflow2_dcgs
        for i, dcg in enumerate(self.workflow_dcgs):
            handler_type = (
                DataConditionHandlerType.WORKFLOW_TRIGGER
                if i % 2 == 0
                else DataConditionHandlerType.ACTION_FILTER
            )
            workflow_id = self.workflow1.id if i < len(self.workflow1_dcgs) else self.workflow2.id
            self.trigger_type_to_dcg_model[handler_type][dcg.id] = workflow_id

        self.detector = Detector.objects.get(project_id=self.project.id, type=ErrorGroupType.slug)
        self.detector_dcg = self.create_data_condition_group()
        self.detector.update(workflow_condition_group=self.detector_dcg)
        self.trigger_type_to_dcg_model[DataConditionHandlerType.DETECTOR_TRIGGER][
            self.detector_dcg.id
        ] = self.detector.id

        self.dcg_to_workflow = self.trigger_type_to_dcg_model[
            DataConditionHandlerType.WORKFLOW_TRIGGER
        ].copy()
        self.dcg_to_workflow.update(
            self.trigger_type_to_dcg_model[DataConditionHandlerType.ACTION_FILTER]
        )

        self.mock_redis_buffer = mock_redis_buffer()
        self.mock_redis_buffer.__enter__()

        buffer.backend.push_to_sorted_set(
            key=WORKFLOW_ENGINE_BUFFER_LIST_KEY, value=self.project.id
        )
        buffer.backend.push_to_sorted_set(
            key=WORKFLOW_ENGINE_BUFFER_LIST_KEY, value=self.project2.id
        )

    def tearDown(self):
        self.mock_redis_buffer.__exit__(None, None, None)

    def create_project_event_freq_workflow(
        self, project: Project, environment: Environment | None = None
    ) -> tuple[Workflow, list[DataConditionGroup]]:
        detector, _ = Detector.objects.get_or_create(
            project_id=project.id, type=ErrorGroupType.slug, defaults={"config": {}}
        )

        workflow_trigger_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT
        )
        self.create_data_condition(
            condition_group=workflow_trigger_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "1h", "value": 100},
            condition_result=True,
        )
        # TODO: add other conditions

        workflow = self.create_workflow(
            when_condition_group=workflow_trigger_group,
            organization=project.organization,
            environment=environment,
        )
        self.create_detector_workflow(
            detector=detector,
            workflow=workflow,
        )

        workflow_action_filter_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ALL
        )
        self.create_data_condition(
            condition_group=workflow_action_filter_group,
            type=Condition.EVENT_FREQUENCY_PERCENT,
            comparison={"interval": "1h", "value": 100, "comparison_interval": "1w"},
            condition_result=True,
        )
        # TODO: add other conditions

        self.create_workflow_data_condition_group(
            workflow=workflow, condition_group=workflow_action_filter_group
        )

        return workflow, [workflow_trigger_group, workflow_action_filter_group]

    def setup_event(self, project, environment, name) -> tuple[Event, Group]:
        event = self.create_event(project.id, FROZEN_TIME, name, environment.name)
        assert event.group
        return event, event.group

    def push_to_hash(
        self,
        project_id: int,
        workflow_id: int,
        group_id: int,
        dcg_ids: list[int],
        event_id: str | None = None,
        occurrence_id: str | None = None,
        dcg_type: DataConditionHandlerType = DataConditionHandlerType.WORKFLOW_TRIGGER,
    ) -> None:
        value = json.dumps({"event_id": event_id, "occurrence_id": occurrence_id})
        field = f"{workflow_id}:{group_id}:{','.join(map(str, dcg_ids))}:{dcg_type}"
        buffer.backend.push_to_hash(
            model=Workflow,
            filters={"project_id": project_id},
            field=field,
            value=value,
        )

    def _push_base_events(self) -> None:
        workflow_to_data = {
            self.workflow1: (self.project, self.workflow1_dcgs, self.event1, self.group1),
            self.workflow2: (self.project, self.workflow2_dcgs, self.event2, self.group2),
            self.workflow3: (self.project2, self.workflow3_dcgs, self.event3, self.group3),
            self.workflow4: (self.project2, self.workflow4_dcgs, self.event4, self.group4),
        }
        dcg_type = [
            DataConditionHandlerType.WORKFLOW_TRIGGER,
            DataConditionHandlerType.ACTION_FILTER,
        ]

        for workflow, (project, dcgs, event, group) in workflow_to_data.items():
            for i, dcg in enumerate(dcgs):
                self.push_to_hash(
                    project_id=project.id,
                    workflow_id=workflow.id,
                    group_id=group.id,
                    dcg_ids=[dcg.id],
                    event_id=event.event_id,
                    dcg_type=dcg_type[i],
                )


class TestDelayedWorkflowHelpers(TestDelayedWorkflowBase):
    def test_fetch_project(self):
        assert fetch_project(self.project.id) == self.project
        assert fetch_project(1) is None

    def test_fetch_group_to_event_data(self):
        # nothing in buffer
        assert fetch_group_to_event_data(self.project.id, Workflow) == {}

        self._push_base_events()
        buffer_data = fetch_group_to_event_data(self.project.id, Workflow)
        assert len(buffer_data) == 4
        assert set(buffer_data.keys()) == self.workflow_group_dcg_mapping

        buffer_data = fetch_group_to_event_data(self.project2.id, Workflow)
        assert len(buffer_data) == 4
        assert set(buffer_data.keys()) == self.workflow_group_dcg_mapping2

    def test_get_dcg_group_workflow_detector_data(self):
        self._push_base_events()

        self.push_to_hash(
            self.project.id,
            self.detector.id,
            self.group1.id,
            [self.detector_dcg.id],
            self.event1.event_id,
            dcg_type=DataConditionHandlerType.DETECTOR_TRIGGER,
        )
        self.dcg_to_groups[self.detector_dcg.id] = {self.group1.id}

        buffer_data = fetch_group_to_event_data(self.project.id, Workflow)
        dcg_to_groups, trigger_type_to_dcg_model = get_dcg_group_workflow_detector_data(buffer_data)

        assert dcg_to_groups == self.dcg_to_groups
        assert trigger_type_to_dcg_model == self.trigger_type_to_dcg_model

    def test_fetch_workflows_envs(self):
        workflow_ids_to_workflows, workflows_to_envs = fetch_workflows_envs(
            list(self.dcg_to_workflow.values())
        )
        assert workflows_to_envs == {
            self.workflow1.id: self.environment.id,
            self.workflow2.id: None,
        }
        assert workflow_ids_to_workflows == {
            self.workflow1.id: self.workflow1,
            self.workflow2.id: self.workflow2,
        }


class TestDelayedWorkflowQueries(BaseWorkflowTest):
    def setUp(self):
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

    def test_generate_unique_queries(self):
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

    def test_generate_unique_queries__invalid(self):
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

    def test_get_condition_query_groups(self):
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
        workflows_to_envs: dict[int, int | None] = {self.workflow.id: None}

        result = get_condition_query_groups(dcgs, dcg_to_groups, dcg_to_workflow, workflows_to_envs)

        count_query = generate_unique_queries(self.count_dc, None)[0]
        percent_only_query = generate_unique_queries(self.percent_dc, None)[1]
        different_query = generate_unique_queries(other_condition, None)[0]

        assert result[count_query] == {self.group.id, group2.id}  # count and percent condition
        assert result[percent_only_query] == {self.group.id}
        assert result[different_query] == {group3.id, group4.id}


@freeze_time(FROZEN_TIME)
class TestGetSnubaResults(BaseWorkflowTest):
    def tearDown(self):
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
        self, data_conditions: list[DataCondition]
    ) -> tuple[dict[UniqueConditionQuery, set[int]], int, list[UniqueConditionQuery]]:
        condition_groups = {}
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
            condition_groups.update({query: {event.group.id} for query in unique_queries})
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

    def test_empty_condition_groups(self):
        assert get_condition_group_results({}) == {}

    def test_count_comparison_condition(self):
        dc = self.create_event_frequency_condition()
        condition_groups, group_id, unique_queries = self.create_condition_groups([dc])

        results = get_condition_group_results(condition_groups)
        assert results == {
            unique_queries[0]: {group_id: 2},
        }

    def test_percent_comparison_condition(self):
        dc = self.create_event_frequency_condition(type=Condition.EVENT_FREQUENCY_PERCENT)
        condition_groups, group_id, unique_queries = self.create_condition_groups([dc])
        results = get_condition_group_results(condition_groups)

        present_percent_query, offset_percent_query = unique_queries

        assert results == {
            present_percent_query: {group_id: 2},
            offset_percent_query: {group_id: 1},
        }

    def test_count_percent_conditions_together(self):
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


class TestGetGroupsToFire(TestDelayedWorkflowBase):
    def setUp(self):
        super().setUp()

        self.data_condition_groups = self.workflow1_dcgs + self.workflow2_dcgs + [self.detector_dcg]
        self.dcg_to_groups[self.detector_dcg.id] = {self.group1.id}
        self.workflows_to_envs = {self.workflow1.id: self.environment.id, self.workflow2.id: None}
        self.condition_group_results = {
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

        # add slow condition to workflow1 IF dcg (ALL), passes
        self.create_data_condition(
            condition_group=self.workflow1_dcgs[1],
            type=Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
            comparison={"interval": "1h", "value": 100},
            condition_result=True,
        )
        # add slow condition to detector WHEN dcg (ANY), passes but not in result
        self.create_data_condition(
            condition_group=self.detector_dcg,
            type=Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
            comparison={"interval": "1h", "value": 100},
            condition_result=True,
        )
        # add slow condition to workflow2 WHEN dcg (ANY), fails but the DCG itself passes
        self.create_data_condition(
            condition_group=self.workflow2_dcgs[0],
            type=Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT,
            comparison={"interval": "1h", "value": 100},
            condition_result=True,
        )

    def test_simple(self):
        result = get_groups_to_fire(
            self.data_condition_groups,
            self.workflows_to_envs,
            self.dcg_to_workflow,
            self.dcg_to_groups,
            self.condition_group_results,
        )

        assert result == {
            self.group1.id: set(self.workflow1_dcgs),  # WHEN dcg (ANY-short), IF dcg (ALL)
            self.group2.id: {self.workflow2_dcgs[0]},  # WHEN dcg (ANY-short)
        }

    def test_dcg_all_fails(self):
        self.condition_group_results.update(
            {
                UniqueConditionQuery(
                    handler=EventUniqueUserFrequencyQueryHandler,
                    interval="1h",
                    environment_id=self.environment.id,
                ): {self.group1.id: 99}
            }
        )

        result = get_groups_to_fire(
            self.data_condition_groups,
            self.workflows_to_envs,
            self.dcg_to_workflow,
            self.dcg_to_groups,
            self.condition_group_results,
        )

        assert result == {
            self.group1.id: {self.workflow1_dcgs[0]},  # WHEN dcg (ANY-short)
            self.group2.id: {self.workflow2_dcgs[0]},  # WHEN dcg (ANY-short)
        }

    def test_dcg_any_fails(self):
        self.condition_group_results.update(
            {
                UniqueConditionQuery(
                    handler=EventFrequencyQueryHandler, interval="1h", environment_id=None
                ): {self.group2.id: 99}
            }
        )

        result = get_groups_to_fire(
            self.data_condition_groups,
            self.workflows_to_envs,
            self.dcg_to_workflow,
            self.dcg_to_groups,
            self.condition_group_results,
        )

        assert result == {
            self.group1.id: set(self.workflow1_dcgs),  # WHEN dcg (ANY-short), IF dcg (ALL)
        }

    def test_multiple_dcgs_per_group(self):
        for dcg in self.workflow1_dcgs:
            self.dcg_to_groups[dcg.id].add(self.group2.id)
        for dcg in self.workflow2_dcgs:
            self.dcg_to_groups[dcg.id].add(self.group1.id)

        result = get_groups_to_fire(
            self.data_condition_groups,
            self.workflows_to_envs,
            self.dcg_to_workflow,
            self.dcg_to_groups,
            self.condition_group_results,
        )

        # all dcgs except workflow 2 IF, which never passes
        assert result == {
            self.group1.id: set(self.workflow1_dcgs + [self.workflow2_dcgs[0]]),
            self.group2.id: set(
                self.workflow1_dcgs + [self.workflow2_dcgs[0]],
            ),
        }


class TestFireActionsForGroups(TestDelayedWorkflowBase):
    def setUp(self):
        super().setUp()

        action1 = self.create_action(
            type=Action.Type.DISCORD,
            integration_id="1234567890",
            target_identifier="channel456",
            data={"tags": "environment,user,my_tag"},
        )
        self.create_data_condition_group_action(
            condition_group=self.workflow1_dcgs[1], action=action1
        )

        action2 = self.create_action(
            type=Action.Type.SLACK,
            integration_id="1234567890",
            target_identifier="channel789",
            target_display="#general",
            data={"tags": "environment,user", "notes": "Important alert"},
        )
        self.create_data_condition_group_action(
            condition_group=self.workflow2_dcgs[1], action=action2
        )

        self.groups_to_dcgs = {
            self.group1.id: set(self.workflow1_dcgs),
            self.group2.id: set(self.workflow2_dcgs),
        }
        self.dcg_group_to_event_data: DataConditionGroupEvent = {}
        for i, dcg in enumerate(self.workflow_dcgs):
            if i < 2:
                group = self.group1
                event = self.event1
            else:
                group = self.group2
                event = self.event2

            self.dcg_group_to_event_data[(dcg.id, group.id)] = {
                "event_id": event.event_id,
                "occurrence_id": None,
            }

        self.group_to_groupevent = {
            self.group1: self.event1.for_group(self.group1),
            self.group2: self.event2.for_group(self.group2),
        }

    def test_parse_dcg_group_event_data(self):
        self._push_base_events()
        buffer_data = fetch_group_to_event_data(self.project.id, Workflow)
        dcg_group_to_event_data, event_ids, occurrence_ids = parse_dcg_group_event_data(
            buffer_data, self.groups_to_dcgs
        )

        assert dcg_group_to_event_data == self.dcg_group_to_event_data
        assert event_ids == {self.event1.event_id, self.event2.event_id}
        assert occurrence_ids == set()

    def test_bulk_fetch_events(self):
        event_ids = [self.event1.event_id, self.event2.event_id]
        events = bulk_fetch_events(event_ids, self.project.id)

        for event in list(events.values()):
            assert event.event_id in event_ids

    def test_get_group_to_groupevent(self):
        group_to_groupevent = get_group_to_groupevent(
            self.dcg_group_to_event_data,
            [self.group1.id, self.group2.id],
            {self.event1.event_id, self.event2.event_id},
            set(),
            self.project.id,
        )
        assert group_to_groupevent == self.group_to_groupevent

    @patch("sentry.workflow_engine.models.action.Action.trigger")
    def test_fire_actions_for_groups__fire_actions(self, mock_trigger):
        fire_actions_for_groups(
            self.groups_to_dcgs, self.trigger_type_to_dcg_model, self.group_to_groupevent
        )

        assert mock_trigger.call_count == 2
        assert mock_trigger.call_args_list[0][0] == (
            {"event": self.event1.for_group(self.group1)},
            self.detector,
        )
        assert mock_trigger.call_args_list[1][0] == (
            {"event": self.event2.for_group(self.group2)},
            self.detector,
        )

    @patch("sentry.workflow_engine.processors.workflow.enqueue_workflow")
    def test_fire_actions_for_groups__enqueue(self, mock_enqueue):
        # enqueue the IF DCGs with slow conditions!

        fire_actions_for_groups(
            self.groups_to_dcgs, self.trigger_type_to_dcg_model, self.group_to_groupevent
        )

        assert mock_enqueue.call_count == 2
        assert mock_enqueue.call_args_list[0][0] == (
            self.workflow1,
            [self.workflow1_dcgs[1].conditions.all()[0]],
            self.event1.for_group(self.group1),
            WorkflowDataConditionGroupType.ACTION_FILTER,
        )
        assert mock_enqueue.call_args_list[1][0] == (
            self.workflow2,
            [self.workflow2_dcgs[1].conditions.all()[0]],
            self.event2.for_group(self.group2),
            WorkflowDataConditionGroupType.ACTION_FILTER,
        )


class TestCleanupRedisBuffer(TestDelayedWorkflowBase):
    def test_cleanup_redis(self):
        self._push_base_events()

        data = buffer.backend.get_hash(Workflow, {"project_id": self.project.id})
        assert set(data.keys()) == self.workflow_group_dcg_mapping

        cleanup_redis_buffer(self.project.id, data, None)
        data = buffer.backend.get_hash(Workflow, {"project_id": self.project.id})
        assert data == {}

    @override_options({"delayed_processing.batch_size": 2})
    @patch("sentry.workflow_engine.processors.delayed_workflow.process_delayed_workflows.delay")
    def test_batched_cleanup(self, mock_process_delayed):
        self._push_base_events()
        all_data = buffer.backend.get_hash(Workflow, {"project_id": self.project.id})

        process_in_batches(self.project.id, "delayed_workflow")
        batch_one_key = mock_process_delayed.call_args_list[0][0][1]
        batch_two_key = mock_process_delayed.call_args_list[1][0][1]

        # Verify we removed the data from the buffer
        data = buffer.backend.get_hash(Workflow, {"project_id": self.project.id})
        assert data == {}

        first_batch = buffer.backend.get_hash(
            model=Workflow, field={"project_id": self.project.id, "batch_key": batch_one_key}
        )
        cleanup_redis_buffer(self.project.id, first_batch, batch_one_key)

        # Verify the batch we "executed" is removed
        data = buffer.backend.get_hash(
            Workflow, {"project_id": self.project.id, "batch_key": batch_one_key}
        )
        assert data == {}

        # Verify the batch we didn't execute is still in redis
        data = buffer.backend.get_hash(
            Workflow, {"project_id": self.project.id, "batch_key": batch_two_key}
        )
        for key in first_batch.keys():
            all_data.pop(key)
        assert data == all_data

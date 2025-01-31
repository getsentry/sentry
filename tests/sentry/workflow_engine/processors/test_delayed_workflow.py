from dataclasses import asdict

from sentry import buffer
from sentry.eventstore.models import Event
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.rules.processing.delayed_processing import fetch_project
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.redis import mock_redis_buffer
from sentry.utils import json
from sentry.workflow_engine.models import DataConditionGroup, Detector, Workflow
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.delayed_workflow import (
    UniqueConditionQuery,
    fetch_active_data_condition_groups,
    fetch_group_to_event_data,
    fetch_workflows_and_environments,
    generate_unique_queries,
    get_condition_query_groups,
    get_dcg_group_workflow_data,
)
from sentry.workflow_engine.processors.workflow import WORKFLOW_ENGINE_BUFFER_LIST_KEY
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
            f"{self.workflow1.id}:{self.group1.id}:{','.join(map(str, [dcg.id for dcg in self.workflow1_dcgs]))}",
            f"{self.workflow2.id}:{self.group2.id}:{','.join(map(str, [dcg.id for dcg in self.workflow2_dcgs]))}",
        }

        self.event3, self.group3 = self.setup_event(self.project2, self.environment2, "group-3")
        self.create_event(self.project2.id, FROZEN_TIME, "group-3", self.environment.name)
        self.create_event(self.project2.id, FROZEN_TIME, "group-3", self.environment.name)
        self.create_event(self.project2.id, FROZEN_TIME, "group-3", self.environment.name)

        self.event4, self.group4 = self.setup_event(self.project2, self.environment2, "group-4")
        self.create_event(self.project2.id, FROZEN_TIME, "group-4")
        self._make_sessions(60, project=self.project2)

        self.workflow_group_dcg_mapping2 = {
            f"{self.workflow3.id}:{self.group3.id}:{','.join(map(str, [dcg.id for dcg in self.workflow3_dcgs]))}",
            f"{self.workflow4.id}:{self.group4.id}:{','.join(map(str, [dcg.id for dcg in self.workflow4_dcgs]))}",
        }

        self.dcg_to_groups = {dcg.id: {self.group1.id} for dcg in self.workflow1_dcgs} | {
            dcg.id: {self.group2.id} for dcg in self.workflow2_dcgs
        }
        self.dcg_to_workflow = {dcg.id: self.workflow1.id for dcg in self.workflow1_dcgs} | {
            dcg.id: self.workflow2.id for dcg in self.workflow2_dcgs
        }

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
        if not Detector.objects.filter(project_id=project.id, type=ErrorGroupType.slug).exists():
            detector = self.create_detector(project=project, type=ErrorGroupType.slug)
        else:
            detector = Detector.objects.get(project_id=project.id, type=ErrorGroupType.slug)

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
    ) -> None:
        value = json.dumps({"event_id": event_id, "occurrence_id": occurrence_id})
        field = f"{workflow_id}:{group_id}:{','.join(map(str, dcg_ids))}"
        buffer.backend.push_to_hash(
            model=Workflow,
            filters={"project_id": project_id},
            field=field,
            value=value,
        )

    def _push_base_events(self) -> None:
        self.push_to_hash(
            self.project.id,
            self.workflow1.id,
            self.group1.id,
            [dcg.id for dcg in self.workflow1_dcgs],
            self.event1.event_id,
        )
        self.push_to_hash(
            self.project.id,
            self.workflow2.id,
            self.group2.id,
            [dcg.id for dcg in self.workflow2_dcgs],
            self.event2.event_id,
        )
        self.push_to_hash(
            self.project2.id,
            self.workflow3.id,
            self.group3.id,
            [dcg.id for dcg in self.workflow3_dcgs],
            self.event3.event_id,
        )
        self.push_to_hash(
            self.project2.id,
            self.workflow4.id,
            self.group4.id,
            [dcg.id for dcg in self.workflow4_dcgs],
            self.event4.event_id,
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
        assert len(buffer_data) == 2
        assert set(buffer_data.keys()) == self.workflow_group_dcg_mapping

        buffer_data = fetch_group_to_event_data(self.project2.id, Workflow)
        assert len(buffer_data) == 2
        assert set(buffer_data.keys()) == self.workflow_group_dcg_mapping2

    def test_get_dcg_group_workflow_data(self):
        self._push_base_events()
        buffer_data = fetch_group_to_event_data(self.project.id, Workflow)
        dcg_to_groups, dcg_to_workflow, all_event_data = get_dcg_group_workflow_data(buffer_data)

        assert dcg_to_groups == self.dcg_to_groups
        assert dcg_to_workflow == self.dcg_to_workflow
        assert all_event_data.count({"event_id": self.event1.event_id, "occurrence_id": None}) == 2
        assert all_event_data.count({"event_id": self.event2.event_id, "occurrence_id": None}) == 2

    def test_fetch_workflows_and_environments(self):
        workflow_ids_to_workflows, workflows_to_envs = fetch_workflows_and_environments(
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

    def test_fetch_active_data_condition_groups(self):
        workflow_ids_to_workflows = {
            self.workflow1.id: self.workflow1,
            self.workflow2.id: self.workflow2,
        }

        active_dcgs = fetch_active_data_condition_groups(
            list(self.dcg_to_groups.keys()), self.dcg_to_workflow, workflow_ids_to_workflows
        )
        assert set(active_dcgs) == set(self.workflow1_dcgs + self.workflow2_dcgs)

        self.workflow1.update(enabled=False)
        active_dcgs = fetch_active_data_condition_groups(
            list(self.dcg_to_groups.keys()), self.dcg_to_workflow, workflow_ids_to_workflows
        )
        assert set(active_dcgs) == set(self.workflow2_dcgs)


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

        dcgs = [self.workflow_triggers, self.workflow_filters, other_workflow_filters]
        dcg_to_groups = {
            self.workflow_triggers.id: {self.group.id},
            self.workflow_filters.id: {group2.id},
            other_workflow_filters.id: {group3.id},
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
        assert result[different_query] == {group3.id}

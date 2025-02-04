from collections import defaultdict
from collections.abc import Sequence
from copy import deepcopy
from datetime import datetime, timedelta
from typing import DefaultDict
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

import pytest

from sentry import buffer
from sentry.eventstore.models import Event, GroupEvent
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.rules.conditions.event_frequency import (
    ComparisonType,
    EventFrequencyCondition,
    EventFrequencyConditionData,
)
from sentry.rules.processing.buffer_processing import (
    bucket_num_groups,
    process_buffer,
    process_in_batches,
)
from sentry.rules.processing.delayed_processing import (
    DataAndGroups,
    UniqueConditionQuery,
    apply_delayed,
    bulk_fetch_events,
    cleanup_redis_buffer,
    generate_unique_queries,
    get_condition_group_results,
    get_condition_query_groups,
    get_group_to_groupevent,
    get_rules_to_fire,
    get_rules_to_groups,
    get_slow_conditions,
    parse_rulegroup_to_event_data,
)
from sentry.rules.processing.processor import PROJECT_ID_BUFFER_LIST_KEY, RuleProcessor
from sentry.testutils.cases import PerformanceIssueTestCase, RuleTestCase, TestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.redis import mock_redis_buffer
from sentry.utils import json
from sentry.utils.safe import safe_execute
from tests.snuba.rules.conditions.test_event_frequency import BaseEventFrequencyPercentTest

pytestmark = pytest.mark.sentry_metrics

FROZEN_TIME = before_now(days=1).replace(hour=1, minute=30, second=0, microsecond=0)
TEST_RULE_SLOW_CONDITION: EventFrequencyConditionData = {
    "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
    "value": 1,
    "interval": "1h",
}

TEST_RULE_FAST_CONDITION: EventFrequencyConditionData = {
    "id": "sentry.rules.conditions.every_event.EveryEventCondition",
    "value": 1,
    "interval": "1h",
}


def test_bucket_num_groups():
    assert bucket_num_groups(1) == "1"
    assert bucket_num_groups(50) == ">10"
    assert bucket_num_groups(101) == ">100"


def mock_get_condition_group(descending=False):
    """
    Mocks get_condition_groups to run with the passed in alert_rules in
    order of id (ascending by default).
    """

    def _callthrough_with_order(*args, **kwargs):
        if args:
            alert_rules = args[0]
            alert_rules.sort(key=lambda rule: rule.id, reverse=descending)
        return get_condition_query_groups(*args, **kwargs)

    return _callthrough_with_order


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


class BulkFetchEventsTest(CreateEventTestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.environment = self.create_environment(project=self.project)

        self.event = self.create_event(
            self.project.id, FROZEN_TIME, "group-1", self.environment.name
        )
        self.event_two = self.create_event(
            self.project.id, FROZEN_TIME, "group-1", self.environment.name
        )

        self.expected = {
            self.event.event_id: self.event,
            self.event_two.event_id: self.event_two,
        }

    def test_basic(self):
        event_ids: list[str] = [self.event.event_id, self.event_two.event_id]
        result = bulk_fetch_events(event_ids, self.project.id)

        assert len(result) == len(self.expected)
        for expected, fetched in zip(self.expected, result):
            assert expected == fetched

    def test_empty_list(self):
        event_ids: list[str] = []
        result = bulk_fetch_events(event_ids, self.project.id)
        assert len(result) == 0

    def test_invalid_project(self):
        event_ids: list[str] = [self.event.event_id, self.event_two.event_id]
        result = bulk_fetch_events(event_ids, 0)
        assert len(result) == 0

    def test_with_invalid_event_ids(self):
        event_ids: list[str] = ["-1", "0"]
        result = bulk_fetch_events(event_ids, self.project.id)
        assert len(result) == 0

    def test_event_ids_with_mixed_validity(self):
        event_ids: list[str] = ["-1", self.event.event_id, "0", self.event_two.event_id]
        result = bulk_fetch_events(event_ids, self.project.id)

        assert len(result) == len(self.expected)
        for expected, fetched in zip(self.expected, result):
            assert expected == fetched

    @patch("sentry.rules.processing.delayed_processing.ConditionalRetryPolicy")
    @patch("sentry.rules.processing.delayed_processing.EVENT_LIMIT", 2)
    def test_more_than_limit_event_ids(self, mock_retry_policy):
        """
        Test that when the number of event_ids exceeds the EVENT_LIMIT,
        batches into groups based on the EVENT_LIMT, and then merges results.
        """
        event_ids: list[str] = ["-1", self.event.event_id, "0", self.event_two.event_id]
        mock_retry_instance = MagicMock()
        mock_retry_policy.return_value = mock_retry_instance

        def mock_return_value(lambda_func):
            return lambda_func()

        mock_retry_instance.side_effect = mock_return_value

        results = bulk_fetch_events(event_ids, self.project.id)
        assert mock_retry_instance.call_count == 2
        assert len(results) == len(self.expected)
        for expected, fetched in zip(self.expected, results):
            assert expected == fetched


class GetConditionGroupResultsTest(CreateEventTestCase):
    interval = "1h"
    comparison_interval = "15m"

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
        self, condition_data_list: Sequence[EventFrequencyConditionData]
    ) -> tuple[dict[UniqueConditionQuery, DataAndGroups], int, list[UniqueConditionQuery]]:
        condition_groups = {}
        all_unique_queries = []
        for condition_data in condition_data_list:
            unique_queries = generate_unique_queries(condition_data, self.environment.id)
            event = self.create_events(condition_data["comparisonType"])
            assert event.group
            group = event.group
            data_and_groups = DataAndGroups(
                data=condition_data,
                group_ids={event.group.id},
            )
            condition_groups.update({query: data_and_groups for query in unique_queries})
            all_unique_queries.extend(unique_queries)
        return condition_groups, group.id, all_unique_queries

    def test_empty_condition_groups(self):
        assert get_condition_group_results({}, self.project) == {}

    @patch("sentry.rules.processing.delayed_processing.logger")
    def test_nonexistent_condition(self, mock_logger):
        nonexistent_cond_query = UniqueConditionQuery(
            cls_id="fake_id", interval="", environment_id=1
        )
        fake_data_groups = DataAndGroups(
            data=self.create_event_frequency_condition(id="fake_id"),
            group_ids={1},
        )

        results = get_condition_group_results(
            {nonexistent_cond_query: fake_data_groups}, self.project
        )
        assert results == {}
        mock_logger.warning.assert_called_once()

    @patch("sentry.rules.processing.delayed_processing.logger")
    def test_fast_condition(self, mock_logger):
        fast_cond_query = UniqueConditionQuery(
            cls_id="sentry.rules.conditions.every_event.EveryEventCondition",
            interval="",
            environment_id=1,
        )
        fake_data_groups = DataAndGroups(
            data=self.create_event_frequency_condition(id="fake_id"),
            group_ids={1},
        )

        results = get_condition_group_results({fast_cond_query: fake_data_groups}, self.project)
        assert results == {}
        mock_logger.warning.assert_called_once()

    def test_group_does_not_belong_to_project(self):
        """
        Test that when the passed in project does not contain the group
        referenced in condition_data, the function ignores this mismatch
        entirely and still queries for those events.
        """
        condition_data = self.create_event_frequency_condition(interval=self.interval)
        condition_groups, group_id, unique_queries = self.create_condition_groups([condition_data])

        results = get_condition_group_results(condition_groups, self.create_project())
        assert results == {
            unique_queries[0]: {group_id: 2},
        }

    def test_count_comparison_condition(self):
        condition_data = self.create_event_frequency_condition(interval=self.interval)
        condition_groups, group_id, unique_queries = self.create_condition_groups([condition_data])

        results = get_condition_group_results(condition_groups, self.project)
        assert results == {
            unique_queries[0]: {group_id: 2},
        }

    def test_percent_comparison_condition(self):
        condition_data = self.create_event_frequency_condition(
            interval=self.interval,
            comparison_type=ComparisonType.PERCENT,
            comparison_interval=self.comparison_interval,
        )
        condition_groups, group_id, unique_queries = self.create_condition_groups([condition_data])
        results = get_condition_group_results(condition_groups, self.project)

        present_percent_query, offset_percent_query = unique_queries

        assert results == {
            present_percent_query: {group_id: 2},
            offset_percent_query: {group_id: 1},
        }

    def test_count_percent_nonexistent_fast_conditions_together(self):
        """
        Test that a percent and count condition are processed as expected, and
        that nonexistent and fast conditions are ignored.
        """
        count_data = self.create_event_frequency_condition(interval=self.interval)
        percent_data = self.create_event_frequency_condition(
            interval=self.interval,
            comparison_type=ComparisonType.PERCENT,
            comparison_interval=self.comparison_interval,
        )
        condition_groups, group_id, unique_queries = self.create_condition_groups(
            [count_data, percent_data]
        )
        nonexistent_cond_query = UniqueConditionQuery(
            cls_id="fake_id", interval="", environment_id=1
        )
        fast_cond_query = UniqueConditionQuery(
            cls_id="sentry.rules.conditions.every_event.EveryEventCondition",
            interval="",
            environment_id=1,
        )
        fake_data_groups = DataAndGroups(
            data=self.create_event_frequency_condition(id="fake_id"),
            group_ids={1},
        )

        condition_groups.update(
            {nonexistent_cond_query: fake_data_groups, fast_cond_query: fake_data_groups}
        )
        results = get_condition_group_results(condition_groups, self.project)

        count_query, present_percent_query, offset_percent_query = unique_queries
        # The count query and first percent query should be identical
        assert count_query == present_percent_query
        # We should only query twice b/c the count query and first percent query
        # share a single scan.
        assert results == {
            count_query: {group_id: 4},
            offset_percent_query: {group_id: 1},
        }


class GetGroupToGroupEventTest(CreateEventTestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.rule = self.create_alert_rule(self.organization, [self.project])

        # Create some groups
        self.group1 = self.create_group(self.project)
        self.group2 = self.create_group(self.project)

        # Create some events
        e1 = self.create_event(self.project.id, FROZEN_TIME, "group-1", self.environment.name)
        e2 = self.create_event(self.project.id, FROZEN_TIME, "group-2", self.environment.name)

        # Turn events into GroupEvents
        self.event1 = GroupEvent(self.project.id, e1.event_id, self.group1, e1.data, e1._snuba_data)
        self.event2 = GroupEvent(self.project.id, e2.event_id, self.group2, e2.data, e2._snuba_data)

        self.occurrence1 = {"occurrence_id": "occ1"}
        self.occurrence2 = {"occurrence_id": "occ2"}

        self.parsed_data = {
            (self.rule.id, self.group1.id): {
                "event_id": self.event1.event_id,
                **self.occurrence1,
            },
            (self.rule.id, self.group2.id): {
                "event_id": self.event2.event_id,
                **self.occurrence2,
            },
        }
        self.group_ids = {self.group1.id, self.group2.id}

    def test_basic(self):
        self.parsed_data.pop((self.rule.id, self.group2.id))
        result = get_group_to_groupevent(self.parsed_data, self.project.id, {self.group1.id})

        assert len(result) == 1
        assert result[self.group1] == self.event1

    def test_many(self):
        result = get_group_to_groupevent(self.parsed_data, self.project.id, self.group_ids)

        assert len(result) == 2
        assert result[self.group1] == self.event1
        assert result[self.group2] == self.event2

    def test_missing_event(self):
        parsed_data = {
            (self.rule.id, self.group2.id): {
                "event_id": "0",
                **self.occurrence2,
            },
            (self.rule.id, self.group1.id): {
                "event_id": self.event1.event_id,
                **self.occurrence1,
            },
        }

        result = get_group_to_groupevent(parsed_data, self.project.id, self.group_ids)

        assert len(result) == 1
        assert result[self.group1] == self.event1

    def test_invalid_project_id(self):
        result = get_group_to_groupevent(self.parsed_data, 0, self.group_ids)
        assert len(result) == 0

    def test_empty_group_ids(self):
        result = get_group_to_groupevent({}, self.project.id, set())
        assert len(result) == 0

    def test_invalid_group_ids(self):
        result = get_group_to_groupevent(self.parsed_data, self.project.id, {0})
        assert len(result) == 0


class GetRulesToFireTest(TestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.project = self.create_project()
        self.environment = self.create_environment()

        self.rule1: Rule = self.create_project_rule(
            project=self.project,
            condition_data=[TEST_RULE_SLOW_CONDITION],
            environment_id=self.environment.id,
        )
        self.group1: Group = self.create_group(self.project)
        self.group2: Group = self.create_group(self.project)

        self.condition_group_results: dict[UniqueConditionQuery, dict[int, int]] = {
            UniqueConditionQuery(
                cls_id=TEST_RULE_SLOW_CONDITION["id"],
                interval=TEST_RULE_SLOW_CONDITION["interval"],
                environment_id=self.environment.id,
            ): {self.group1.id: 2, self.group2.id: 1}
        }

        self.rules_to_slow_conditions: DefaultDict[Rule, list[EventFrequencyConditionData]] = (
            defaultdict(list)
        )
        self.rules_to_slow_conditions[self.rule1].append(TEST_RULE_SLOW_CONDITION)

        self.rules_to_groups: DefaultDict[int, set[int]] = defaultdict(set)
        self.rules_to_groups[self.rule1.id].add(self.group1.id)
        self.rules_to_groups[self.rule1.id].add(self.group2.id)

        # Mock passes_comparison function
        self.patcher = patch("sentry.rules.processing.delayed_processing.passes_comparison")
        self.mock_passes_comparison = self.patcher.start()

    def tearDown(self):
        self.patcher.stop()

    def test_comparison(self):
        self.mock_passes_comparison.return_value = True

        result = get_rules_to_fire(
            self.condition_group_results,
            self.rules_to_slow_conditions,
            self.rules_to_groups,
            self.project.id,
        )

        assert result[self.rule1] == {self.group1.id, self.group2.id}

    def test_comparison_fail_all(self):
        self.mock_passes_comparison.return_value = False

        result = get_rules_to_fire(
            self.condition_group_results,
            self.rules_to_slow_conditions,
            self.rules_to_groups,
            self.project.id,
        )

        assert self.rule1 not in result

    def test_comparison_any(self):
        self.rule1.data["action_match"] = "any"
        self.mock_passes_comparison.return_value = True

        result = get_rules_to_fire(
            self.condition_group_results,
            self.rules_to_slow_conditions,
            self.rules_to_groups,
            self.project.id,
        )

        assert result[self.rule1] == {self.group1.id, self.group2.id}

    def test_comparison_any_fail(self):
        self.rule1.data["action_match"] = "any"
        self.mock_passes_comparison.return_value = False

        result = get_rules_to_fire(
            self.condition_group_results,
            self.rules_to_slow_conditions,
            self.rules_to_groups,
            self.project.id,
        )

        assert self.rule1 not in result

    def test_empty_input(self):
        result = get_rules_to_fire({}, defaultdict(list), defaultdict(set), self.project.id)
        assert len(result) == 0

    @patch("sentry.rules.processing.delayed_processing.passes_comparison", return_value=True)
    def test_multiple_rules_and_groups(self, mock_passes):
        rule2 = self.create_project_rule(
            project=self.project,
            condition_data=[TEST_RULE_SLOW_CONDITION],
            environment_id=self.environment.id,
        )
        self.rules_to_slow_conditions[rule2].append(TEST_RULE_SLOW_CONDITION)
        self.rules_to_groups[rule2.id].add(self.group2.id)

        result = get_rules_to_fire(
            self.condition_group_results,
            self.rules_to_slow_conditions,
            self.rules_to_groups,
            self.project.id,
        )

        assert len(result) == 2
        assert result[self.rule1] == {self.group1.id, self.group2.id}
        assert result[rule2] == {self.group2.id}


class GetRulesToGroupsTest(TestCase):
    def test_empty_input(self):
        result = get_rules_to_groups({})
        assert result == defaultdict(set)

    def test_single_rule_group(self):
        input_data = {"1:100": "event_data"}
        expected = defaultdict(set, {1: {100}})
        result = get_rules_to_groups(input_data)
        assert result == expected

    def test_multiple_rule_groups(self):
        input_data = {
            "1:100": "event_data1",
            "1:101": "event_data2",
            "2:200": "event_data3",
            "3:300": "event_data4",
            "3:301": "event_data5",
        }
        expected = defaultdict(set, {1: {100, 101}, 2: {200}, 3: {300, 301}})
        result = get_rules_to_groups(input_data)
        assert result == expected

    def test_invalid_input_format(self):
        input_data = {"invalid_key": "event_data"}
        with pytest.raises(ValueError):
            get_rules_to_groups(input_data)


class GetSlowConditionsTest(RuleTestCase):
    rule_cls = EventFrequencyCondition

    def setUp(self):
        self.rule = self.get_rule(data={"conditions": [TEST_RULE_SLOW_CONDITION]})

    def test_get_slow_conditions(self):
        results = get_slow_conditions(self.rule)
        assert results == [TEST_RULE_SLOW_CONDITION]

    def test_get_slow_conditions__only_fast(self):
        self.rule = self.get_rule(data={"conditions": [TEST_RULE_FAST_CONDITION]})

        results = get_slow_conditions(self.rule)
        assert results == []


class ParseRuleGroupToEventDataTest(TestCase):
    def setUp(self):
        self.project = self.create_project()
        self.group = self.create_group(self.project)
        self.group_two = self.create_group(self.project)
        self.rule = self.create_alert_rule(self.organization, [self.project])
        self.rule_two = self.create_alert_rule(self.organization, [self.project])

        self.event_data = {
            "event_id": "1",
            "occurrence_id": "1",
        }

    def test_parse_rulegroup(self):
        input_data = {
            f"{self.rule.id}:{self.group.id}": json.dumps(self.event_data),
            f"{self.rule_two.id}:{self.group_two.id}": json.dumps(self.event_data),
        }

        result = parse_rulegroup_to_event_data(input_data)
        assert result == {
            (self.rule.id, self.group.id): self.event_data,
            (self.rule_two.id, self.group_two.id): self.event_data,
        }

    def test_parse_rulegroup_empty(self):
        result = parse_rulegroup_to_event_data({})
        assert result == {}

    def test_parse_rulegroup_basic(self):
        input_data = {f"{self.rule.id}:{self.group.id}": json.dumps(self.event_data)}
        result = parse_rulegroup_to_event_data(input_data)
        assert result == {(self.rule.id, self.group.id): self.event_data}

    def test_parse_rulegroup_invalid_json(self):
        input_data = {f"{self.rule.id}:{self.group.id}": "}"}
        with pytest.raises(json.JSONDecodeError):
            parse_rulegroup_to_event_data(input_data)


class ProcessDelayedAlertConditionsTest(CreateEventTestCase, PerformanceIssueTestCase):
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

    def test_get_condition_groups(self):
        self._push_base_events()
        project_three = self.create_project(organization=self.organization)
        env3 = self.create_environment(project=project_three)
        rule_1 = self.create_project_rule(
            project=project_three,
            condition_data=[self.event_frequency_condition],
            filter_match=[self.tag_filter],
            environment_id=env3.id,
        )
        rule_2 = self.create_project_rule(
            project=project_three,
            condition_data=[self.event_frequency_condition2],
            environment_id=env3.id,
        )
        rules_to_groups = {rule_1.id: {1, 2, 3}, rule_2.id: {3, 4, 5}}
        orig_rules_to_groups = deepcopy(rules_to_groups)
        get_condition_query_groups([rule_1, rule_2], rules_to_groups)  # type: ignore[arg-type]
        assert orig_rules_to_groups == rules_to_groups

    @patch("sentry.rules.processing.delayed_processing.logger")
    def test_apply_delayed_nonexistent_project(self, mock_logger):
        self.push_to_hash(self.project.id, self.rule1.id, self.group1.id, self.event1.event_id)
        project_id = self.project.id
        self.project.delete()

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        apply_delayed(project_ids[0][0])

        assert RuleFireHistory.objects.count() == 0
        mock_logger.info.assert_called_once_with(
            "delayed_processing.project_does_not_exist",
            extra={"project_id": project_id},
        )

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_apply_delayed_rules_to_fire(self):
        """
        Test that rules of various event frequency conditions, projects,
        environments, etc. are properly fired.
        """
        self._push_base_events()
        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        apply_delayed(project_ids[0][0])
        rule_fire_histories = RuleFireHistory.objects.filter(
            rule__in=[self.rule1, self.rule2],
            group__in=[self.group1, self.group2],
            event_id__in=[self.event1.event_id, self.event2.event_id],
            project=self.project,
        ).values_list("rule", "group")
        assert len(rule_fire_histories) == 2
        assert (self.rule1.id, self.group1.id) in rule_fire_histories
        assert (self.rule2.id, self.group2.id) in rule_fire_histories
        self.assert_buffer_cleared(project_id=self.project.id)

        apply_delayed(project_ids[1][0])
        rule_fire_histories = RuleFireHistory.objects.filter(
            rule__in=[self.rule3, self.rule4],
            group__in=[self.group3, self.group4],
            event_id__in=[self.event3.event_id, self.event4.event_id],
            project=self.project_two,
        ).values_list("rule", "group")
        assert len(rule_fire_histories) == 2
        assert (self.rule3.id, self.group3.id) in rule_fire_histories
        assert (self.rule4.id, self.group4.id) in rule_fire_histories

        rule_group_data = buffer.backend.get_hash(Project, {"project_id": self.project_two.id})
        assert rule_group_data == {}

    def test_apply_delayed_issue_platform_event(self):
        """
        Test that we fire rules triggered from issue platform events
        """
        self._push_base_events()
        rule5 = self.create_project_rule(
            project=self.project,
            condition_data=[self.event_frequency_condition2],
        )
        tags = [["foo", "guux"], ["sentry:release", "releaseme"]]
        contexts = {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}}
        for i in range(3):
            event5 = self.create_performance_issue(
                tags=tags,
                fingerprint="group-5",
                contexts=contexts,
            )
        group5 = event5.group
        assert group5
        self.push_to_hash(
            self.project.id,
            rule5.id,
            group5.id,
            event5.event_id,
            occurrence_id=event5.occurrence_id,
        )
        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        apply_delayed(project_ids[0][0])
        rule_fire_histories = RuleFireHistory.objects.filter(
            rule__in=[self.rule1, rule5],
            group__in=[self.group1, group5],
            event_id__in=[self.event1.event_id, event5.event_id],
            project=self.project,
        ).values_list("rule", "group")
        assert len(rule_fire_histories) == 2
        assert (self.rule1.id, self.group1.id) in rule_fire_histories
        assert (rule5.id, group5.id) in rule_fire_histories
        self.assert_buffer_cleared(project_id=self.project.id)

    def test_apply_delayed_snoozed_rule(self):
        """
        Test that we do not fire a rule that's been snoozed (aka muted)
        """
        self._push_base_events()
        rule5 = self.create_project_rule(
            project=self.project,
            condition_data=[self.event_frequency_condition2],
            environment_id=self.environment.id,
        )
        self.snooze_rule(owner_id=self.user.id, rule=rule5)
        event5 = self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        assert event5.group
        group5 = event5.group
        self.push_to_hash(self.project.id, rule5.id, group5.id, event5.event_id)

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        apply_delayed(project_ids[0][0])
        rule_fire_histories = RuleFireHistory.objects.filter(
            rule__in=[rule5],
            group__in=[self.group1, group5],
            event_id__in=[self.event1.event_id, event5.event_id],
            project=self.project,
        ).values_list("rule", "group")
        assert len(rule_fire_histories) == 0
        self.assert_buffer_cleared(project_id=self.project.id)

    def test_apply_delayed_same_condition_diff_value(self):
        """
        Test that two rules with the same condition and interval but a
        different value are both fired.
        """
        self._push_base_events()
        rule5 = self.create_project_rule(
            project=self.project,
            condition_data=[self.event_frequency_condition2],
            environment_id=self.environment.id,
        )
        event5 = self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        assert event5.group
        group5 = event5.group
        self.push_to_hash(self.project.id, rule5.id, group5.id, event5.event_id)

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        apply_delayed(project_ids[0][0])
        rule_fire_histories = RuleFireHistory.objects.filter(
            rule__in=[self.rule1, rule5],
            group__in=[self.group1, group5],
            event_id__in=[self.event1.event_id, event5.event_id],
            project=self.project,
        ).values_list("rule", "group")
        assert len(rule_fire_histories) == 2
        assert (self.rule1.id, self.group1.id) in rule_fire_histories
        assert (rule5.id, group5.id) in rule_fire_histories
        self.assert_buffer_cleared(project_id=self.project.id)

    def test_apply_delayed_same_condition_diff_interval(self):
        """
        Test that two rules with the same condition and value but a
        different interval are both fired.
        """
        self._push_base_events()
        diff_interval_rule = self.create_project_rule(
            project=self.project,
            condition_data=[self.event_frequency_condition3],
            environment_id=self.environment.id,
        )
        event5 = self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        assert event5.group
        self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        group5 = event5.group
        self.push_to_hash(self.project.id, diff_interval_rule.id, group5.id, event5.event_id)

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        apply_delayed(project_ids[0][0])
        rule_fire_histories = RuleFireHistory.objects.filter(
            rule__in=[self.rule1, diff_interval_rule],
            group__in=[self.group1, group5],
            event_id__in=[self.event1.event_id, event5.event_id],
            project=self.project,
        ).values_list("rule", "group")
        assert len(rule_fire_histories) == 2
        assert (self.rule1.id, self.group1.id) in rule_fire_histories
        assert (diff_interval_rule.id, group5.id) in rule_fire_histories
        self.assert_buffer_cleared(project_id=self.project.id)

    def test_apply_delayed_same_condition_diff_env(self):
        """
        Test that two rules with the same condition, value, and interval
        but different environment are both fired.
        """
        self._push_base_events()
        environment3 = self.create_environment(project=self.project)
        diff_env_rule = self.create_project_rule(
            project=self.project,
            condition_data=[self.event_frequency_condition],
            environment_id=environment3.id,
        )
        event5 = self.create_event(self.project.id, FROZEN_TIME, "group-5", environment3.name)
        assert event5.group
        self.create_event(self.project.id, FROZEN_TIME, "group-5", environment3.name)
        group5 = event5.group
        self.push_to_hash(self.project.id, diff_env_rule.id, group5.id, event5.event_id)

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        apply_delayed(project_ids[0][0])
        rule_fire_histories = RuleFireHistory.objects.filter(
            rule__in=[self.rule1, diff_env_rule],
            group__in=[self.group1, group5],
            event_id__in=[self.event1.event_id, event5.event_id],
            project=self.project,
        ).values_list("rule", "group")
        assert len(rule_fire_histories) == 2
        assert (self.rule1.id, self.group1.id) in rule_fire_histories
        assert (diff_env_rule.id, group5.id) in rule_fire_histories
        self.assert_buffer_cleared(project_id=self.project.id)

    def test_apply_delayed_two_rules_one_fires(self):
        """
        Test that with two rules in one project where one rule hasn't met
        the trigger threshold, only one is fired
        """
        self._push_base_events()
        high_event_frequency_condition = {
            "interval": "1d",
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            "value": 100,
            "name": "The issue is seen more than 100 times in 1d",
        }
        no_fire_rule = self.create_project_rule(
            project=self.project,
            condition_data=[high_event_frequency_condition],
            environment_id=self.environment.id,
        )
        event5 = self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        assert event5.group
        self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        group5 = event5.group
        self.push_to_hash(self.project.id, no_fire_rule.id, group5.id, event5.event_id)

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        apply_delayed(project_ids[0][0])
        rule_fire_histories = RuleFireHistory.objects.filter(
            rule__in=[self.rule1, no_fire_rule],
            group__in=[self.group1, group5],
            event_id__in=[self.event1.event_id, event5.event_id],
            project=self.project,
        ).values_list("rule", "group")
        assert len(rule_fire_histories) == 1
        assert (self.rule1.id, self.group1.id) in rule_fire_histories
        self.assert_buffer_cleared(project_id=self.project.id)

    def test_apply_delayed_action_match_all(self):
        """
        Test that a rule with multiple conditions and an action match of
        'all' is fired.
        """
        self._push_base_events()
        two_conditions_match_all_rule = self.create_project_rule(
            project=self.project,
            condition_data=[self.event_frequency_condition, self.user_frequency_condition],
            environment_id=self.environment.id,
        )
        event5 = self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        assert event5.group
        self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        group5 = event5.group
        self.create_event(
            self.project.id,
            FROZEN_TIME,
            "group-6",
            self.environment.name,
        )
        self.create_event(
            self.project.id,
            FROZEN_TIME,
            "group-5",
            self.environment.name,
        )
        condition_wont_pass_rule = self.create_project_rule(
            project=self.project,
            condition_data=[self.create_event_frequency_condition(value=100)],
            environment_id=self.environment.id,
        )
        self.push_to_hash(
            self.project.id, two_conditions_match_all_rule.id, group5.id, event5.event_id
        )
        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        apply_delayed(project_ids[0][0])
        rule_fire_histories = RuleFireHistory.objects.filter(
            rule__in=[self.rule1, two_conditions_match_all_rule, condition_wont_pass_rule],
            group__in=[self.group1, group5],
            event_id__in=[self.event1.event_id, event5.event_id],
            project=self.project,
        ).values_list("rule", "group")
        assert len(rule_fire_histories) == 2
        assert (self.rule1.id, self.group1.id) in rule_fire_histories
        assert (two_conditions_match_all_rule.id, group5.id) in rule_fire_histories
        self.assert_buffer_cleared(project_id=self.project.id)

        assert (two_conditions_match_all_rule.id, group5.id) in rule_fire_histories
        self.assert_buffer_cleared(project_id=self.project.id)

    @with_feature("organizations:event-unique-user-frequency-condition-with-conditions")
    def test_special_event_frequency_condition(self):
        Rule.objects.all().delete()
        event_frequency_special_condition = Rule.objects.create(
            label="Event Frequency Special Condition",
            project=self.project,
            environment_id=self.environment.id,
            data={
                "filter_match": "all",
                "action_match": "all",
                "actions": [
                    {"id": "sentry.rules.actions.notify_event.NotifyEventAction"},
                    {
                        "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                        "service": "mail",
                    },
                ],
                "conditions": [
                    {
                        "id": "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyConditionWithConditions",
                        "value": 2,
                        "comparisonType": "count",
                        "interval": "1m",
                    },
                    {
                        "match": "eq",
                        "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                        "key": "region",
                        "value": "EU",
                    },
                ],
            },
        )

        self.create_event(
            self.project.id, FROZEN_TIME, "group-1", self.environment.name, tags=[["region", "US"]]
        )
        self.create_event(
            self.project.id, FROZEN_TIME, "group-1", self.environment.name, tags=[["region", "US"]]
        )
        evaluated_event = self.create_event(
            self.project.id, FROZEN_TIME, "group-1", self.environment.name, tags=[["region", "EU"]]
        )
        assert evaluated_event.group

        group1 = evaluated_event.group

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        rp = RuleProcessor(
            evaluated_event.for_group(evaluated_event.group),
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            has_reappeared=False,
        )
        rp.apply()

        apply_delayed(project_ids[0][0])
        rule_fire_histories = RuleFireHistory.objects.filter(
            rule__in=[event_frequency_special_condition],
            group__in=[group1],
            event_id__in=[evaluated_event.event_id],
            project=self.project,
        ).values_list("rule", "group")
        assert len(rule_fire_histories) == 0
        self.assert_buffer_cleared(project_id=self.project.id)

    @with_feature("organizations:event-unique-user-frequency-condition-with-conditions")
    def test_special_event_frequency_condition_passes(self):
        Rule.objects.all().delete()
        event_frequency_special_condition = Rule.objects.create(
            label="Event Frequency Special Condition",
            project=self.project,
            environment_id=self.environment.id,
            data={
                "filter_match": "all",
                "action_match": "all",
                "actions": [
                    {"id": "sentry.rules.actions.notify_event.NotifyEventAction"},
                    {
                        "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                        "service": "mail",
                    },
                ],
                "conditions": [
                    {
                        "id": "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyConditionWithConditions",
                        "value": 2,
                        "comparisonType": "count",
                        "interval": "1m",
                    },
                    {
                        "match": "eq",
                        "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                        "key": "region",
                        "value": "EU",
                    },
                ],
            },
        )

        self.create_event(
            self.project.id, FROZEN_TIME, "group-1", self.environment.name, tags=[["region", "EU"]]
        )
        self.create_event(
            self.project.id, FROZEN_TIME, "group-1", self.environment.name, tags=[["region", "EU"]]
        )
        evaluated_event = self.create_event(
            self.project.id, FROZEN_TIME, "group-1", self.environment.name, tags=[["region", "EU"]]
        )
        assert evaluated_event.group

        group1 = evaluated_event.group

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        rp = RuleProcessor(
            evaluated_event.for_group(evaluated_event.group),
            is_new=False,
            is_regression=False,
            is_new_group_environment=False,
            has_reappeared=False,
        )
        rp.apply()

        apply_delayed(project_ids[0][0])
        rule_fire_histories = RuleFireHistory.objects.filter(
            rule__in=[event_frequency_special_condition],
            group__in=[group1],
            event_id__in=[evaluated_event.event_id],
            project=self.project,
        ).values_list("rule", "group")
        assert len(rule_fire_histories) == 1
        assert (event_frequency_special_condition.id, group1.id) in rule_fire_histories
        self.assert_buffer_cleared(project_id=self.project.id)

    def test_apply_delayed_shared_condition_diff_filter(self):
        self._push_base_events()
        project_three = self.create_project(organization=self.organization)
        env3 = self.create_environment(project=project_three)
        buffer.backend.push_to_sorted_set(key=PROJECT_ID_BUFFER_LIST_KEY, value=project_three.id)
        rule_1 = self.create_project_rule(
            project=project_three,
            condition_data=[self.event_frequency_condition],
            filter_match=[self.tag_filter],
            environment_id=env3.id,
        )
        rule_2 = self.create_project_rule(
            project=project_three,
            condition_data=[self.event_frequency_condition],
            environment_id=env3.id,
        )
        event1 = self.create_event(
            project_three.id, FROZEN_TIME, "group-5", env3.name, tags=[["foo", "bar"]]
        )
        assert event1.group
        self.create_event(
            project_three.id, FROZEN_TIME, "group-5", env3.name, tags=[["foo", "bar"]]
        )
        group1 = event1.group

        event2 = self.create_event(project_three.id, FROZEN_TIME, "group-6", env3.name)
        assert event2.group
        self.create_event(project_three.id, FROZEN_TIME, "group-6", env3.name)
        group2 = event2.group

        self.push_to_hash(project_three.id, rule_1.id, group1.id, event1.event_id)
        self.push_to_hash(project_three.id, rule_2.id, group2.id, event2.event_id)

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        assert project_three.id == project_ids[2][0]
        apply_delayed(project_ids[2][0])
        rule_fire_histories = RuleFireHistory.objects.filter(
            rule__in=[rule_1, rule_2],
            group__in=[group1, group2],
            event_id__in=[event1.event_id, event2.event_id],
            project=project_three,
        ).values_list("rule", "group")
        assert len(rule_fire_histories) == 2
        assert (rule_1.id, group1.id) in rule_fire_histories
        assert (rule_2.id, group2.id) in rule_fire_histories
        self.assert_buffer_cleared(project_id=project_three.id)

    def test_apply_delayed_percent_comparison_condition_interval(self):
        """
        Test that a rule with a percent condition is querying backwards against
        the correct comparison interval, e.g. # events is ... compared to 1 hr ago
        """
        percent_condition = self.create_event_frequency_condition(
            interval="1h",
            value=50,
            comparison_type=ComparisonType.PERCENT,
            comparison_interval="15m",
        )
        percent_comparison_rule = self.create_project_rule(
            project=self.project,
            condition_data=[percent_condition],
        )

        incorrect_interval_time = FROZEN_TIME - timedelta(hours=1, minutes=30)
        correct_interval_time = FROZEN_TIME - timedelta(hours=1, minutes=10)

        event5 = self.create_event(self.project.id, FROZEN_TIME, "group-5")
        assert event5.group
        self.create_event(self.project.id, FROZEN_TIME, "group-5")
        # Create events for the incorrect interval that will not trigger the rule
        self.create_event(self.project.id, incorrect_interval_time, "group-5")
        self.create_event(self.project.id, incorrect_interval_time, "group-5")
        # Create an event for the correct interval that will trigger the rule
        self.create_event(self.project.id, correct_interval_time, "group-5")

        group5 = event5.group
        self.push_to_hash(self.project.id, percent_comparison_rule.id, group5.id, event5.event_id)

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        apply_delayed(project_ids[0][0])
        rule_fire_histories = RuleFireHistory.objects.filter(
            rule__in=[percent_comparison_rule],
            group__in=[group5],
            event_id__in=[event5.event_id],
            project=self.project,
        ).values_list("rule", "group")
        assert len(rule_fire_histories) == 1
        assert (percent_comparison_rule.id, group5.id) in rule_fire_histories
        self.assert_buffer_cleared(project_id=self.project.id)

    def test_apply_delayed_event_frequency_percent_comparison_interval(self):
        """
        Test that the event frequency percent condition with a percent
        comparison is using the COMPARISON_INTERVALS for it's
        comparison_interval and does not fail with a KeyError.
        """
        percent_condition = self.create_event_frequency_condition(
            id="EventFrequencyPercentCondition",
            interval="1h",
            value=50,
            comparison_type=ComparisonType.PERCENT,
            comparison_interval="1d",
        )
        percent_comparison_rule = self.create_project_rule(
            project=self.project,
            condition_data=[percent_condition],
        )

        event5 = self.create_event(self.project.id, FROZEN_TIME, "group-5")
        assert event5.group
        self.push_to_hash(
            self.project.id, percent_comparison_rule.id, event5.group.id, event5.event_id
        )

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        apply_delayed(project_ids[0][0])

        assert not RuleFireHistory.objects.filter(
            rule__in=[percent_comparison_rule],
            project=self.project,
        ).exists()
        self.assert_buffer_cleared(project_id=self.project.id)

    def _setup_count_percent_test(self) -> int:
        fires_percent_condition = self.create_event_frequency_condition(
            interval="1h",
            value=50,
            comparison_type=ComparisonType.PERCENT,
            comparison_interval="15m",
        )
        self.fires_percent_rule = self.create_project_rule(
            project=self.project,
            condition_data=[fires_percent_condition],
            environment_id=self.environment.id,
        )

        fires_count_condition = self.create_event_frequency_condition(
            interval="1h",
            value=1,
        )
        self.fires_count_rule = self.create_project_rule(
            project=self.project,
            condition_data=[fires_count_condition],
            environment_id=self.environment.id,
        )
        skips_count_condition = self.create_event_frequency_condition(
            interval="1h",
            value=75,
        )
        self.skips_count_rule = self.create_project_rule(
            project=self.project,
            condition_data=[skips_count_condition],
            environment_id=self.environment.id,
        )

        # Create events to trigger the fires count condition.
        self.event5 = self.create_event(
            self.project.id, FROZEN_TIME, "group-5", self.environment.name
        )
        assert self.event5.group
        self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        self.group5 = self.event5.group

        # Create a past event to trigger the fires percent condition.
        self.create_event(
            self.project.id,
            FROZEN_TIME - timedelta(hours=1, minutes=10),
            "group-5",
            self.environment.name,
        )

        for rule in [self.fires_percent_rule, self.fires_count_rule, self.skips_count_rule]:
            self.push_to_hash(self.project.id, rule.id, self.group5.id, self.event5.event_id)
        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        return project_ids[0][0]

    def _assert_count_percent_results(self, safe_execute_callthrough: Mock) -> None:
        rule_fire_histories = RuleFireHistory.objects.filter(
            rule__in=[self.fires_percent_rule, self.fires_count_rule, self.skips_count_rule],
            group__in=[self.group5],
            event_id__in=[self.event5.event_id],
            project=self.project,
        ).values_list("rule", "group")
        assert len(rule_fire_histories) == 2
        assert (self.fires_percent_rule.id, self.group5.id) in rule_fire_histories
        assert (self.fires_count_rule.id, self.group5.id) in rule_fire_histories
        self.assert_buffer_cleared(project_id=self.project.id)

        # Ensure we're only making two queries. The count query and first
        # percent query of both percent conditions can share one query, and
        # the second query of both percent conditions share the other query.
        assert safe_execute_callthrough.call_count == 2

    @patch("sentry.rules.processing.delayed_processing.safe_execute", side_effect=safe_execute)
    def test_apply_delayed_process_percent_then_count(self, safe_execute_callthrough):
        """
        Test that having both count and percent comparison type conditions do
        not affect each other and that processing the percent condition first
        does not matter.
        """

        # Have the percent condition be processed first. The calculated percent
        # value is 100, but the skips_count_rule with a threshold of 75 should
        # not be triggered.
        project_id = self._setup_count_percent_test()
        with patch(
            "sentry.rules.processing.delayed_processing.get_condition_query_groups",
            side_effect=mock_get_condition_group(descending=False),
        ):
            apply_delayed(project_id)
        self._assert_count_percent_results(safe_execute_callthrough)

    @patch("sentry.rules.processing.delayed_processing.safe_execute", side_effect=safe_execute)
    def test_apply_delayed_process_count_then_percent(self, safe_execute_callthrough):
        """
        Test that having both count and percent comparison type conditions do
        not affect each other and that processing the count condition first
        does not matter.
        """

        # Have a count condition be processed first. It's calculated value is 2,
        # but the fires_percent_rule with a 50 threshold should still be triggered.
        project_id = self._setup_count_percent_test()
        with patch(
            "sentry.rules.processing.delayed_processing.get_condition_query_groups",
            side_effect=mock_get_condition_group(descending=True),
        ):
            apply_delayed(project_id)
        self._assert_count_percent_results(safe_execute_callthrough)


class ProcessRuleGroupsInBatchesTest(CreateEventTestCase):
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


class UniqueConditionQueryTest(TestCase):
    """
    Tests for the UniqueConditionQuery class. Currently, this is just to pass codecov.
    """

    def test_repr(self):
        condition = UniqueConditionQuery(
            cls_id="1", interval="1d", environment_id=1, comparison_interval="1d"
        )
        assert (
            repr(condition)
            == "<UniqueConditionQuery:\nid: 1,\ninterval: 1d,\nenv id: 1,\ncomp interval: 1d\n>"
        )


class DataAndGroupsTest(TestCase):
    """
    Tests for the DataAndGroups class. Currently, this is just to pass codecov.
    """

    def test_repr(self):
        condition = DataAndGroups(data=TEST_RULE_SLOW_CONDITION, group_ids={1, 2}, rule_id=1)
        assert (
            repr(condition)
            == "<DataAndGroups data: {'id': 'sentry.rules.conditions.event_frequency.EventFrequencyCondition', 'value': 1, 'interval': '1h'} group_ids: {1, 2} rule_id: 1>"
        )


class CleanupRedisBufferTest(CreateEventTestCase):
    def setUp(self):
        super().setUp()

        self.project = self.create_project()
        self.group = self.create_group(self.project)
        self.rule = self.create_alert_rule()

    def test_cleanup_redis(self):
        self.push_to_hash(self.project.id, self.rule.id, self.group.id)
        rules_to_groups: defaultdict[int, set[int]] = defaultdict(set)
        rules_to_groups[self.rule.id].add(self.group.id)

        cleanup_redis_buffer(self.project.id, rules_to_groups, None)
        rule_group_data = buffer.backend.get_hash(Project, {"project_id": self.project.id})
        assert rule_group_data == {}

    @override_options({"delayed_processing.batch_size": 2})
    @patch("sentry.rules.processing.delayed_processing.apply_delayed.delay")
    def test_batched_cleanup(self, mock_apply_delayed):
        group_two = self.create_group(self.project)
        group_three = self.create_group(self.project)

        self.push_to_hash(self.project.id, self.rule.id, self.group.id)
        self.push_to_hash(self.project.id, self.rule.id, group_two.id)
        self.push_to_hash(self.project.id, self.rule.id, group_three.id)

        rules_to_groups: defaultdict[int, set[int]] = defaultdict(set)
        rules_to_groups[self.rule.id].add(self.group.id)
        rules_to_groups[self.rule.id].add(group_two.id)
        rules_to_groups[self.rule.id].add(group_three.id)

        process_in_batches(self.project.id, "delayed_processing")
        batch_one_key = mock_apply_delayed.call_args_list[0][0][1]
        batch_two_key = mock_apply_delayed.call_args_list[1][0][1]

        # Verify process_rulegroups_in_batches removed the data from the buffer
        rule_group_data = buffer.backend.get_hash(Project, {"project_id": self.project.id})
        assert rule_group_data == {}

        cleanup_redis_buffer(self.project.id, rules_to_groups, batch_one_key)

        # Verify the batch we "executed" is removed
        rule_group_data = buffer.backend.get_hash(
            Project, {"project_id": self.project.id, "batch_key": batch_one_key}
        )
        assert rule_group_data == {}

        # Verify the batch we didn't execute is still in redis
        rule_group_data = buffer.backend.get_hash(
            Project, {"project_id": self.project.id, "batch_key": batch_two_key}
        )
        assert rule_group_data == {
            f"{self.rule.id}:{group_three.id}": '{"event_id":null,"occurrence_id":null}',
        }

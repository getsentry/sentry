from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest

from sentry import buffer
from sentry.eventstore.models import GroupEvent
from sentry.models.project import Project
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.rules.conditions.event_frequency import (
    ComparisonType,
    EventFrequencyCondition,
    EventFrequencyConditionData,
)
from sentry.rules.processing.delayed_processing import (  # bulk_fetch_events; get_group_to_groupevent; parse_rulegroup_to_event_data,
    DataAndGroups,
    UniqueConditionQuery,
    apply_delayed,
    get_condition_group_results,
    get_condition_query_groups,
    get_rules_to_groups,
    get_rules_to_slow_conditions,
    get_slow_conditions,
    process_delayed_alert_conditions,
)
from sentry.rules.processing.processor import PROJECT_ID_BUFFER_LIST_KEY
from sentry.testutils.cases import APITestCase, PerformanceIssueTestCase, RuleTestCase, TestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.helpers.redis import mock_redis_buffer
from sentry.utils import json
from sentry.utils.safe import safe_execute
from tests.snuba.rules.conditions.test_event_frequency import BaseEventFrequencyPercentTest

pytestmark = pytest.mark.sentry_metrics

FROZEN_TIME = before_now(days=1).replace(hour=1, minute=30, second=0, microsecond=0)
TEST_RULE_SLOW_CONDITION = {"id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition"}
TEST_RULE_FAST_CONDITION = {"id": "sentry.rules.conditions.every_event.EveryEventCondition"}


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
class CreateEventTestCase(TestCase, APITestCase):
    def create_event(
        self,
        project_id: int,
        timestamp: datetime,
        fingerprint: str,
        environment=None,
        tags: list[list[str]] | None = None,
    ) -> GroupEvent:
        data = {
            "timestamp": iso_format(timestamp),
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
            data=data, project_id=project_id, assert_no_errors=False, event_type=EventType.ERROR
        )


class BuildGroupToGroupEventTest(TestCase):
    def test_build_group_to_groupevent(self):
        pass


class BulkFetchEventsTest(TestCase):
    def test_bulk_fetch_events(self):
        pass


class GetConditionGroupResultsTest(CreateEventTestCase):
    def test_get_condition_group_results(self):
        interval = "1h"
        condition_data: EventFrequencyConditionData = {
            "interval": interval,
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            "value": 50,
            "comparisonType": "percent",
            "comparisonInterval": "15m",
        }
        first_query = UniqueConditionQuery(
            cls_id="sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            interval=interval,
            environment_id=None,
            comparison_interval=None,
        )
        second_query = first_query._replace(comparison_interval="15m")

        # Create current events for the first query
        event = self.create_event(self.project.id, FROZEN_TIME, "group-1")
        self.create_event(self.project.id, FROZEN_TIME, "group-1")
        # Create a past event for the second query
        self.create_event(self.project.id, FROZEN_TIME - timedelta(hours=1, minutes=10), "group-1")

        data_and_groups = DataAndGroups(
            data=condition_data,
            group_ids={event.group.id},
        )

        condition_groups = {
            first_query: data_and_groups,
            second_query: data_and_groups,
        }

        results = get_condition_group_results(condition_groups, self.project)
        assert results == {
            first_query: {event.group.id: 2},
            second_query: {event.group.id: 1},
        }


class GetGroupToGroupEventTest(TestCase):
    def test_get_group_to_groupevent(self):
        pass


class GetRulesToFireTest(TestCase):
    def test_get_rules_to_fire(self):
        pass


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


class GetRulesToSlowConditionsTest(RuleTestCase):
    rule_cls = EventFrequencyCondition

    def setUp(self):
        self.rule = self.get_rule(data={"conditions": [TEST_RULE_SLOW_CONDITION]})

    def test_get_rules_to_slow_conditions(self):
        results = get_rules_to_slow_conditions([self.rule])
        assert results == {self.rule: [TEST_RULE_SLOW_CONDITION]}

    def test_get_rules_to_slow_conditions__with_fast_conditions(self):
        self.rule = self.get_rule(data={"conditions": [TEST_RULE_FAST_CONDITION]})
        results = get_rules_to_slow_conditions([self.rule])
        assert results == defaultdict(list)

    def test_get_rules_to_slow_conditions__with_multiple_slow_rules(self):
        self.rule_two = self.get_rule(data={"conditions": [TEST_RULE_SLOW_CONDITION]})
        results = get_rules_to_slow_conditions([self.rule, self.rule_two])
        assert results == {
            self.rule: [TEST_RULE_SLOW_CONDITION],
            self.rule_two: [TEST_RULE_SLOW_CONDITION],
        }


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
    def test_parse_rulegroup_to_event_data(self):
        pass


class ProcessDelayedAlertConditionsTest(
    CreateEventTestCase, BaseEventFrequencyPercentTest, PerformanceIssueTestCase
):
    buffer_timestamp = (FROZEN_TIME + timedelta(seconds=1)).timestamp()

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

    def push_to_hash(self, project_id, rule_id, group_id, event_id=None, occurrence_id=None):
        value = json.dumps({"event_id": event_id, "occurrence_id": occurrence_id})
        buffer.backend.push_to_hash(
            model=Project,
            filters={"project_id": project_id},
            field=f"{rule_id}:{group_id}",
            value=value,
        )

    def assert_buffer_cleared(self, project_id):
        rule_group_data = buffer.backend.get_hash(Project, {"project_id": project_id})
        assert rule_group_data == {}

    def setUp(self):
        super().setUp()
        self.mock_redis_buffer = mock_redis_buffer()
        self.mock_redis_buffer.__enter__()

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
            condition_match=[self.event_frequency_condition],
            environment_id=self.environment.id,
        )
        self.event1 = self.create_event(
            self.project.id, FROZEN_TIME, "group-1", self.environment.name
        )
        self.create_event(self.project.id, FROZEN_TIME, "group-1", self.environment.name)
        self.group1 = self.event1.group

        self.rule2 = self.create_project_rule(
            project=self.project, condition_match=[self.user_frequency_condition]
        )
        self.event2 = self.create_event(
            self.project.id, FROZEN_TIME, "group-2", self.environment.name
        )
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
            condition_match=[self.event_frequency_condition2],
            environment_id=self.environment2.id,
        )
        self.event3 = self.create_event(
            self.project_two.id, FROZEN_TIME, "group-3", self.environment2.name
        )
        self.create_event(self.project_two.id, FROZEN_TIME, "group-3", self.environment2.name)
        self.create_event(self.project_two.id, FROZEN_TIME, "group-3", self.environment2.name)
        self.create_event(self.project_two.id, FROZEN_TIME, "group-3", self.environment2.name)
        self.group3 = self.event3.group

        self.rule4 = self.create_project_rule(
            project=self.project_two, condition_match=[event_frequency_percent_condition]
        )
        self.event4 = self.create_event(self.project_two.id, FROZEN_TIME, "group-4")
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

    def tearDown(self):
        self.mock_redis_buffer.__exit__(None, None, None)

    @patch("sentry.rules.processing.delayed_processing.apply_delayed")
    def test_fetches_from_buffer_and_executes(self, mock_apply_delayed):
        self._push_base_events()
        # To get the correct mapping, we need to return the correct
        # rulegroup_event mapping based on the project_id input
        process_delayed_alert_conditions()

        for project, rule_group_event_mapping in (
            (self.project, self.rulegroup_event_mapping_one),
            (self.project_two, self.rulegroup_event_mapping_two),
        ):
            assert mock_apply_delayed.delay.call_count == 2

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
            condition_match=[self.event_frequency_condition],
            filter_match=[self.tag_filter],
            environment_id=env3.id,
        )
        rule_2 = self.create_project_rule(
            project=project_three,
            condition_match=[self.event_frequency_condition2],
            environment_id=env3.id,
        )
        rules_to_groups = {rule_1.id: {1, 2, 3}, rule_2.id: {3, 4, 5}}
        orig_rules_to_groups = deepcopy(rules_to_groups)
        get_condition_query_groups([rule_1, rule_2], rules_to_groups)  # type: ignore[arg-type]
        assert orig_rules_to_groups == rules_to_groups

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
            condition_match=[self.event_frequency_condition2],
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
            condition_match=[self.event_frequency_condition2],
            environment_id=self.environment.id,
        )
        self.snooze_rule(owner_id=self.user.id, rule=rule5)
        event5 = self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
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
            condition_match=[self.event_frequency_condition2],
            environment_id=self.environment.id,
        )
        event5 = self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
        self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
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
            condition_match=[self.event_frequency_condition3],
            environment_id=self.environment.id,
        )
        event5 = self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
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
            condition_match=[self.event_frequency_condition],
            environment_id=environment3.id,
        )
        event5 = self.create_event(self.project.id, FROZEN_TIME, "group-5", environment3.name)
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
            condition_match=[high_event_frequency_condition],
            environment_id=self.environment.id,
        )
        event5 = self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
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
            condition_match=[self.event_frequency_condition, self.user_frequency_condition],
            environment_id=self.environment.id,
        )
        event5 = self.create_event(self.project.id, FROZEN_TIME, "group-5", self.environment.name)
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
            condition_match=[self.create_event_frequency_condition(value=100)],
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

    def test_apply_delayed_shared_condition_diff_filter(self):
        self._push_base_events()
        project_three = self.create_project(organization=self.organization)
        env3 = self.create_environment(project=project_three)
        buffer.backend.push_to_sorted_set(key=PROJECT_ID_BUFFER_LIST_KEY, value=project_three.id)
        rule_1 = self.create_project_rule(
            project=project_three,
            condition_match=[self.event_frequency_condition],
            filter_match=[self.tag_filter],
            environment_id=env3.id,
        )
        rule_2 = self.create_project_rule(
            project=project_three,
            condition_match=[self.event_frequency_condition],
            environment_id=env3.id,
        )
        event1 = self.create_event(
            project_three.id, FROZEN_TIME, "group-5", env3.name, tags=[["foo", "bar"]]
        )
        self.create_event(
            project_three.id, FROZEN_TIME, "group-5", env3.name, tags=[["foo", "bar"]]
        )
        group1 = event1.group

        event2 = self.create_event(project_three.id, FROZEN_TIME, "group-6", env3.name)
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
            condition_match=[percent_condition],
        )

        incorrect_interval_time = FROZEN_TIME - timedelta(hours=1, minutes=30)
        correct_interval_time = FROZEN_TIME - timedelta(hours=1, minutes=10)

        event5 = self.create_event(self.project.id, FROZEN_TIME, "group-5")
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
            condition_match=[percent_condition],
        )

        event5 = self.create_event(self.project.id, FROZEN_TIME, "group-5")
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
            condition_match=[fires_percent_condition],
            environment_id=self.environment.id,
        )

        fires_count_condition = self.create_event_frequency_condition(
            interval="1h",
            value=1,
        )
        self.fires_count_rule = self.create_project_rule(
            project=self.project,
            condition_match=[fires_count_condition],
            environment_id=self.environment.id,
        )
        skips_count_condition = self.create_event_frequency_condition(
            interval="1h",
            value=75,
        )
        self.skips_count_rule = self.create_project_rule(
            project=self.project,
            condition_match=[skips_count_condition],
            environment_id=self.environment.id,
        )

        # Create events to trigger the fires count condition.
        self.event5 = self.create_event(
            self.project.id, FROZEN_TIME, "group-5", self.environment.name
        )
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

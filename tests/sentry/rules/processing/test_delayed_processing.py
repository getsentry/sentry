from copy import deepcopy
from datetime import UTC, datetime
from unittest.mock import patch
from uuid import uuid4

import pytest

from sentry import buffer
from sentry.eventstore.models import Event
from sentry.models.project import Project
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.rules.processing.delayed_processing import (
    apply_delayed,
    get_condition_groups,
    process_delayed_alert_conditions,
)
from sentry.rules.processing.processor import PROJECT_ID_BUFFER_LIST_KEY
from sentry.testutils.cases import APITestCase, PerformanceIssueTestCase, TestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import iso_format
from sentry.testutils.helpers.redis import mock_redis_buffer
from sentry.utils import json
from tests.snuba.rules.conditions.test_event_frequency import BaseEventFrequencyPercentTest

pytestmark = pytest.mark.sentry_metrics


class ProcessDelayedAlertConditionsTest(
    TestCase, APITestCase, BaseEventFrequencyPercentTest, PerformanceIssueTestCase
):
    def create_event(
        self,
        project_id,
        timestamp,
        fingerprint,
        environment=None,
        user: bool = True,
        tags: list[list[str]] | None = None,
    ) -> Event:
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

    def create_event_frequency_condition(
        self,
        interval="1d",
        id="EventFrequencyCondition",
        value=1,
    ):
        condition_id = f"sentry.rules.conditions.event_frequency.{id}"
        return {"interval": interval, "id": condition_id, "value": value}

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
        self.now = datetime.now(UTC)

        self.rule1 = self.create_project_rule(
            project=self.project,
            condition_match=[self.event_frequency_condition],
            environment_id=self.environment.id,
        )
        self.event1 = self.create_event(self.project.id, self.now, "group-1", self.environment.name)
        self.create_event(self.project.id, self.now, "group-1", self.environment.name)

        self.group1 = self.event1.group
        assert self.group1

        self.rule2 = self.create_project_rule(
            project=self.project, condition_match=[self.user_frequency_condition]
        )
        self.event2 = self.create_event(self.project, self.now, "group-2", self.environment.name)
        self.create_event(self.project, self.now, "group-2", self.environment.name)
        self.group2 = self.event2.group
        assert self.group2

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
            self.project_two, self.now, "group-3", self.environment2.name
        )
        self.create_event(self.project_two, self.now, "group-3", self.environment2.name)
        self.create_event(self.project_two, self.now, "group-3", self.environment2.name)
        self.create_event(self.project_two, self.now, "group-3", self.environment2.name)
        self.group3 = self.event3.group
        assert self.group3

        self.rule4 = self.create_project_rule(
            project=self.project_two, condition_match=[event_frequency_percent_condition]
        )
        self.event4 = self.create_event(self.project_two, self.now, "group-4")
        self.create_event(self.project_two, self.now, "group-4")
        self._make_sessions(60, project=self.project_two)
        self.group4 = self.event4.group
        assert self.group4

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

        self.push_to_hash(self.project.id, self.rule1.id, self.group1.id, self.event1.event_id)
        self.push_to_hash(self.project.id, self.rule2.id, self.group2.id, self.event2.event_id)
        self.push_to_hash(self.project_two.id, self.rule3.id, self.group3.id, self.event3.event_id)
        self.push_to_hash(self.project_two.id, self.rule4.id, self.group4.id, self.event4.event_id)

    def tearDown(self):
        self.mock_redis_buffer.__exit__(None, None, None)

    @patch("sentry.rules.processing.delayed_processing.apply_delayed")
    def test_fetches_from_buffer_and_executes(self, mock_apply_delayed):
        # To get the correct mapping, we need to return the correct
        # rulegroup_event mapping based on the project_id input
        process_delayed_alert_conditions()

        for project, rule_group_event_mapping in (
            (self.project, self.rulegroup_event_mapping_one),
            (self.project_two, self.rulegroup_event_mapping_two),
        ):
            assert mock_apply_delayed.delay.call_count == 2

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, datetime.now(UTC).timestamp()
        )
        assert project_ids == []

    def test_get_condition_groups(self):
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
        get_condition_groups([rule_1, rule_2], rules_to_groups)  # type: ignore[arg-type]
        assert orig_rules_to_groups == rules_to_groups

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_apply_delayed_rules_to_fire(self):
        """
        Test that rules of various event frequency conditions, projects, environments, etc. are properly fired
        """
        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, datetime.now(UTC).timestamp()
        )
        apply_delayed(project_ids[0][0])
        rule_fire_histories = RuleFireHistory.objects.filter(
            rule__in=[self.rule1, self.rule2],
            group__in=[self.group1, self.group2],
            event_id__in=[self.event1.event_id, self.event2.event_id],
            project=self.project,
        ).values_list("rule", "group")
        assert self.group1
        assert self.group2
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
        assert self.group3
        assert self.group4
        assert (self.rule3.id, self.group3.id) in rule_fire_histories
        assert (self.rule4.id, self.group4.id) in rule_fire_histories

        rule_group_data = buffer.backend.get_hash(Project, {"project_id": self.project_two.id})
        assert rule_group_data == {}

    def test_apply_delayed_issue_platform_event(self):
        """
        Test that we fire rules triggered from issue platform events
        """
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
        assert self.group1
        self.push_to_hash(
            self.project.id,
            rule5.id,
            group5.id,
            event5.event_id,
            occurrence_id=event5.occurrence_id,
        )
        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, datetime.now(UTC).timestamp()
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
        rule5 = self.create_project_rule(
            project=self.project,
            condition_match=[self.event_frequency_condition2],
            environment_id=self.environment.id,
        )
        self.snooze_rule(owner_id=self.user.id, rule=rule5)
        event5 = self.create_event(self.project, self.now, "group-5", self.environment.name)
        self.create_event(self.project, self.now, "group-5", self.environment.name)
        self.create_event(self.project, self.now, "group-5", self.environment.name)
        group5 = event5.group
        assert group5
        assert self.group1
        self.push_to_hash(self.project.id, rule5.id, group5.id, event5.event_id)

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, datetime.now(UTC).timestamp()
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
        Test that two rules with the same condition and interval but a different value are both fired
        """
        rule5 = self.create_project_rule(
            project=self.project,
            condition_match=[self.event_frequency_condition2],
            environment_id=self.environment.id,
        )
        event5 = self.create_event(self.project, self.now, "group-5", self.environment.name)
        self.create_event(self.project, self.now, "group-5", self.environment.name)
        self.create_event(self.project, self.now, "group-5", self.environment.name)
        group5 = event5.group
        assert group5
        assert self.group1
        self.push_to_hash(self.project.id, rule5.id, group5.id, event5.event_id)

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, datetime.now(UTC).timestamp()
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
        Test that two rules with the same condition and value but a different interval are both fired
        """
        diff_interval_rule = self.create_project_rule(
            project=self.project,
            condition_match=[self.event_frequency_condition3],
            environment_id=self.environment.id,
        )
        event5 = self.create_event(self.project.id, self.now, "group-5", self.environment.name)
        self.create_event(self.project.id, self.now, "group-5", self.environment.name)
        group5 = event5.group
        assert group5
        assert self.group1
        self.push_to_hash(self.project.id, diff_interval_rule.id, group5.id, event5.event_id)

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, datetime.now(UTC).timestamp()
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
        Test that two rules with the same condition, value, and interval but different environment are both fired
        """
        environment3 = self.create_environment(project=self.project)
        diff_env_rule = self.create_project_rule(
            project=self.project,
            condition_match=[self.event_frequency_condition],
            environment_id=environment3.id,
        )
        event5 = self.create_event(self.project.id, self.now, "group-5", environment3.name)
        self.create_event(self.project.id, self.now, "group-5", environment3.name)
        group5 = event5.group
        assert group5
        assert self.group1
        self.push_to_hash(self.project.id, diff_env_rule.id, group5.id, event5.event_id)

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, datetime.now(UTC).timestamp()
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
        Test that with two rules in one project where one rule hasn't met the trigger threshold, only one is fired
        """
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
        event5 = self.create_event(self.project.id, self.now, "group-5", self.environment.name)
        self.create_event(self.project.id, self.now, "group-5", self.environment.name)
        group5 = event5.group
        assert group5
        assert self.group1
        self.push_to_hash(self.project.id, no_fire_rule.id, group5.id, event5.event_id)

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, datetime.now(UTC).timestamp()
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
        Test that a rule with multiple conditions and an action match of 'all' is fired
        """
        two_conditions_match_all_rule = self.create_project_rule(
            project=self.project,
            condition_match=[self.event_frequency_condition, self.user_frequency_condition],
            environment_id=self.environment.id,
        )
        event5 = self.create_event(self.project.id, self.now, "group-5", self.environment.name)
        self.create_event(self.project.id, self.now, "group-5", self.environment.name)
        group5 = event5.group
        assert group5
        event6 = self.create_event(
            self.project.id, self.now, "group-6", self.environment.name, user=False
        )
        self.create_event(self.project.id, self.now, "group-5", self.environment.name, user=False)
        group6 = event6.group
        assert group6
        assert self.group1
        assert self.group2
        condition_wont_pass_rule = self.create_project_rule(
            project=self.project,
            condition_match=[self.create_event_frequency_condition(value=100)],
            environment_id=self.environment.id,
        )
        self.push_to_hash(
            self.project.id, two_conditions_match_all_rule.id, group5.id, event5.event_id
        )
        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, datetime.now(UTC).timestamp()
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
            project_three.id, self.now, "group-5", env3.name, tags=[["foo", "bar"]]
        )
        self.create_event(project_three.id, self.now, "group-5", env3.name, tags=[["foo", "bar"]])
        group1 = event1.group
        assert group1

        event2 = self.create_event(project_three.id, self.now, "group-6", env3.name)
        self.create_event(project_three.id, self.now, "group-6", env3.name)
        group2 = event2.group
        assert group2

        self.push_to_hash(project_three.id, rule_1.id, group1.id, event1.event_id)
        self.push_to_hash(project_three.id, rule_2.id, group2.id, event2.event_id)

        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, 0, datetime.now(UTC).timestamp()
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

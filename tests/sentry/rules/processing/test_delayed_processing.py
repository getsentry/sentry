import copy
from datetime import UTC, datetime
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest

from sentry.db import models
from sentry.eventstore.models import Event
from sentry.rules.processing.delayed_processing import (
    apply_delayed,
    process_delayed_alert_conditions,
)
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers.datetime import iso_format
from tests.snuba.rules.conditions.test_event_frequency import BaseEventFrequencyPercentTest

pytestmark = pytest.mark.sentry_metrics


class ProcessDelayedAlertConditionsTest(TestCase, APITestCase, BaseEventFrequencyPercentTest):
    def create_event(self, project_id, timestamp, fingerprint, environment=None) -> Event:
        data = {
            "timestamp": iso_format(timestamp),
            "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
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
        return self.store_event(
            data=data,
            project_id=project_id,
            assert_no_errors=False,
        )

    def create_event_frequency_condition(
        self,
        interval="1d",
        id="EventFrequencyCondition",
        value=1,
    ):
        condition_id = f"sentry.rules.conditions.event_frequency.{id}"
        return {"interval": interval, "id": condition_id, "value": value}

    def setUp(self):
        super().setUp()
        self.event_frequency_condition = self.create_event_frequency_condition()
        self.event_frequency_condition2 = self.create_event_frequency_condition(value=2)
        self.event_frequency_condition3 = self.create_event_frequency_condition(
            interval="1h", value=1
        )
        user_frequency_condition = self.create_event_frequency_condition(
            interval="1m",
            id="EventUniqueUserFrequencyCondition",
        )
        event_frequency_percent_condition = self.create_event_frequency_condition(
            interval="5m", id="EventFrequencyPercentCondition"
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
            project=self.project, condition_match=[user_frequency_condition]
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

        self.mock_buffer = Mock()

    def get_rulegroup_event_mapping_from_input(
        self, model: type[models.Model], field: dict[str, models.Model | str | int]
    ):
        # There will only be one event per rulegroup
        proj_id = field.popitem()[1]
        return self.buffer_mapping[proj_id]

    @patch("sentry.rules.processing.delayed_processing.apply_delayed")
    def test_fetches_from_buffer_and_executes(self, mock_apply_delayed):
        self.mock_buffer.get_set.return_value = self.buffer_mapping.keys()
        # To get the correct mapping, we need to return the correct
        # rulegroup_event mapping based on the project_id input
        self.mock_buffer.get_hash.side_effect = self.get_rulegroup_event_mapping_from_input

        process_delayed_alert_conditions(self.mock_buffer)

        for project, rule_group_event_mapping in (
            (self.project, self.rulegroup_event_mapping_one),
            (self.project_two, self.rulegroup_event_mapping_two),
        ):
            assert mock_apply_delayed.delay.call_count == 2

    @patch("sentry.rules.conditions.event_frequency.MIN_SESSIONS_TO_FIRE", 1)
    def test_apply_delayed_rules_to_fire(self):
        """
        Test that rules of various event frequency conditions, projects, environments, etc. are properly scheduled to fire
        """
        self.mock_buffer.get_hash.return_value = [self.rulegroup_event_mapping_one]

        rules = apply_delayed(self.project.id, self.mock_buffer)
        assert self.rule1 in rules
        assert self.rule2 in rules

        self.mock_buffer.get_hash.return_value = [self.rulegroup_event_mapping_two]

        rules = apply_delayed(self.project_two.id, self.mock_buffer)
        assert self.rule3 in rules
        assert self.rule4 in rules

    def test_apply_delayed_same_condition_diff_value(self):
        """
        Test that two rules with the same condition and interval but a different value are both scheduled to fire
        """
        rule5 = self.create_project_rule(
            project=self.project_two,
            condition_match=[self.event_frequency_condition2],
            environment_id=self.environment.id,
        )
        event5 = self.create_event(self.project_two, self.now, "group-5", self.environment.name)
        self.create_event(self.project_two, self.now, "group-5", self.environment.name)
        self.create_event(self.project_two, self.now, "group-5", self.environment.name)
        group5 = event5.group
        assert group5
        assert self.group1

        self.mock_buffer.get_hash.return_value = [
            {
                f"{self.rule1.id}:{self.group1.id}": {self.event1.event_id},
                f"{rule5.id}:{group5.id}": {event5.event_id},
            },
        ]

        rules = apply_delayed(self.project.id, self.mock_buffer)
        assert self.rule1 in rules
        assert rule5 in rules

    def test_apply_delayed_same_condition_diff_interval(self):
        """
        Test that two rules with the same condition and value but a different interval are both scheduled to fire
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

        self.mock_buffer.get_hash.return_value = [
            {
                f"{self.rule1.id}:{self.group1.id}": {self.event1.event_id},
                f"{diff_interval_rule.id}:{group5.id}": {event5.event_id},
            },
        ]

        rules = apply_delayed(self.project.id, self.mock_buffer)
        assert self.rule1 in rules
        assert diff_interval_rule in rules

    def test_apply_delayed_same_condition_diff_env(self):
        """
        Test that two rules with the same condition, value, and interval but different environment are both scheduled to fire
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

        self.mock_buffer.get_hash.return_value = [
            {
                f"{self.rule1.id}:{self.group1.id}": {self.event1.event_id},
                f"{diff_env_rule.id}:{group5.id}": {event5.event_id},
            },
        ]

        rules = apply_delayed(self.project.id, self.mock_buffer)
        assert self.rule1 in rules
        assert diff_env_rule in rules

    def test_apply_delayed_two_rules_one_fires(self):
        """
        Test that with two rules in one project where one rule hasn't met the trigger threshold, only one is scheduled to fire
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

        self.mock_buffer.get_hash.return_value = [
            {
                f"{self.rule1.id}:{self.group1.id}": {self.event1.event_id},
                f"{no_fire_rule.id}:{group5.id}": {event5.event_id},
            },
        ]

        rules = apply_delayed(self.project.id, self.mock_buffer)
        assert self.rule1 in rules
        assert no_fire_rule not in rules

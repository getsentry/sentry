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

pytestmark = pytest.mark.sentry_metrics


class ProcessDelayedAlertConditionsTest(TestCase, APITestCase):
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

    def setUp(self):
        event_frequency_condition = {
            "interval": "1d",
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            "value": 1,
            "name": "The issue is seen more than 1 times in 1d",
        }
        event_frequency_condition2 = {
            "interval": "1d",
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            "value": 2,
            "name": "The issue is seen more than 2 times in 1d",
        }
        self.event_frequency_condition3 = {
            "interval": "1h",
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            "value": 1,
            "name": "The issue is seen more than 1 times in 1h",
        }
        user_frequency_condition = {
            "id": "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition",
            "value": 1,
            "interval": "1m",
        }
        event_frequency_percent_condition = {
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
            "interval": "1m",
            "value": "1",
            "comparisonType": "count",
        }
        self.now = datetime.now(UTC)

        self.rule1 = self.create_project_rule(
            project=self.project,
            condition_match=[event_frequency_condition],
            environment_id=self.environment.id,
        )
        self.event1 = self.create_event(self.project.id, self.now, "group-1", self.environment.name)
        self.create_event(self.project.id, self.now, "group-1", self.environment.name)

        self.group1 = self.event1.group

        self.rule2 = self.create_project_rule(
            project=self.project, condition_match=[user_frequency_condition]
        )
        self.event2 = self.create_event(self.project, self.now, "group-2", self.environment.name)
        self.create_event(self.project, self.now, "group-2", self.environment.name)
        self.group2 = self.event2.group

        self.rulegroup_event_mapping_one = {
            f"{self.rule1.id}:{self.group1.id}": {self.event1.event_id},
            f"{self.rule2.id}:{self.group2.id}": {self.event2.event_id},
        }

        self.project_two = self.create_project(organization=self.organization)
        self.environment2 = self.create_environment(project=self.project_two)

        self.rule3 = self.create_project_rule(
            project=self.project_two,
            condition_match=[event_frequency_condition2],
            environment_id=self.environment2.id,
        )
        self.event3 = self.create_event(
            self.project_two, self.now, "group-3", self.environment2.name
        )
        self.create_event(self.project_two, self.now, "group-3", self.environment2.name)
        self.create_event(self.project_two, self.now, "group-3", self.environment2.name)
        self.create_event(self.project_two, self.now, "group-3", self.environment2.name)
        self.group3 = self.event3.group

        self.rule4 = self.create_project_rule(
            project=self.project_two, condition_match=[event_frequency_percent_condition]
        )
        self.event4 = self.create_event(self.project_two, self.now, "group-4")
        self.create_event(self.project_two, self.now, "group-4")
        self.group4 = self.event4.group

        self.rulegroup_event_mapping_two = {
            f"{self.rule3.id}:{self.group3.id}": {self.event3.event_id},
            f"{self.rule4.id}:{self.group4.id}": {self.event4.event_id},
        }
        self.buffer_mapping = {
            self.project.id: self.rulegroup_event_mapping_one,
            self.project_two.id: self.rulegroup_event_mapping_two,
        }

    def get_rulegroup_event_mapping_from_input(
        self, model: type[models.Model], field: dict[str, models.Model | str | int]
    ):
        # There will only be one event per rulegroup
        proj_id = field.popitem()[1]
        return self.buffer_mapping[proj_id]

    @patch("sentry.rules.processing.delayed_processing.apply_delayed")
    def test_fetches_from_buffer_and_executes(self, mock_apply_delayed):
        mock_buffer = Mock()
        mock_buffer.get_set.return_value = self.buffer_mapping.keys()
        # To get the correct mapping, we need to return the correct
        # rulegroup_event mapping based on the project_id input
        mock_buffer.get_hash.side_effect = self.get_rulegroup_event_mapping_from_input

        process_delayed_alert_conditions(mock_buffer)

        for project, rule_group_event_mapping in (
            (self.project, self.rulegroup_event_mapping_one),
            (self.project_two, self.rulegroup_event_mapping_two),
        ):
            assert mock_apply_delayed.delay.call_count == 2

    def test_apply_delayed(self):
        mock_buffer = Mock()
        mock_buffer.get_set.return_value = self.buffer_mapping.keys()
        mock_buffer.get_hash.return_value = [
            self.rulegroup_event_mapping_one,
            self.rulegroup_event_mapping_two,
        ]
        for proj in [self.project, self.project_two]:
            events = apply_delayed(proj, mock_buffer)
            for event in events:
                assert event in [self.event1, self.event2]

        # TODO check RuleFireHistory after adding firing code in

    def test_apply_delayed_same_condition_diff_value(self):
        # XXX: CEO the only difference between UniqueCondition and DataAndGroup's data is the condition value
        # does this still work when we have 2 of the same condition ids with different values?
        # I made 2 EventFrequencyCondition with the same interval but different values and only see 1 shown
        # it does properly handle same condition ids with different intervals
        pass

    def test_apply_delayed_same_condition_diff_interval(self):
        pass

    def test_apply_delayed_two_rules_one_fires(self):
        pass

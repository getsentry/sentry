from unittest.mock import Mock, patch

from sentry.db import models
from sentry.eventstore.models import Event
from sentry.models.project import Project
from sentry.rules.processing.delayed_processing import (
    apply_delayed,
    process_delayed_alert_conditions,
)
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class ProcessDelayedAlertConditionsTest(TestCase, APITestCase):
    def create_event(self, project: Project) -> Event:
        return self.store_event(
            data={
                "event_id": "0" * 32,
                "environment": self.environment.name,
                "timestamp": iso_format(before_now(days=1)),
                "fingerprint": ["part-1"],
                "stacktrace": {"frames": [{"filename": "flow/spice.js"}]},
            },
            project_id=project.id,
        )

    def setUp(self):
        event_frequency_condition = {
            "interval": "1h",
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            "value": 666,
            "name": "The issue is seen more than 30 times in 1m",
        }
        user_frequency_condition = {
            "id": "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition",
            "value": 2,
            "interval": "5m",
        }
        event_frequency_percent_condition = {
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
            "interval": "1h",
            "value": "100",
            "comparisonType": "count",
        }
        self.rule1 = self.create_project_rule(
            project=self.project, condition_match=[event_frequency_condition]
        )
        self.rule2 = self.create_project_rule(
            project=self.project, condition_match=[user_frequency_condition]
        )
        self.event1 = self.create_event(self.project)
        self.group1 = self.event1.group
        self.event2 = self.create_event(self.project)
        self.group2 = self.event2.group
        self.rulegroup_event_mapping_one = {
            f"{self.rule1.id}:{self.group1.id}": {self.event1.event_id},
            f"{self.rule2.id}:{self.group2.id}": {self.event2.event_id},
        }

        self.project_two = self.create_project(organization=self.organization)
        self.rule3 = self.create_project_rule(
            project=self.project_two, condition_match=[event_frequency_condition]
        )
        self.rule4 = self.create_project_rule(
            project=self.project_two, condition_match=[event_frequency_percent_condition]
        )
        self.event3 = self.create_event(self.project_two)
        self.group3 = self.event3.group
        self.event4 = self.create_event(self.project_two)
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
            apply_delayed(proj, mock_buffer)

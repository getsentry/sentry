from unittest.mock import Mock, patch

from sentry.db import models
from sentry.rules.processing.delayed_processing import (
    apply_delayed,
    process_delayed_alert_conditions,
)
from sentry.testutils.cases import TestCase


class ProcessDelayedAlertConditionsTest(TestCase):
    def get_rulegroup_event_mapping_from_input(
        self, model: type[models.Model], field: dict[str, models.Model | str | int]
    ):
        # There will only be one event per rulegroup
        proj_id = field.popitem()[1]
        return self.buffer_mapping[proj_id]

    @patch("sentry.rules.processing.delayed_processing.safe_execute")
    def test_fetches_from_buffer_and_executes(self, mock_safe_execute):
        project_two = self.create_project()

        rulegroup_event_mapping_one = {
            f"{self.project.id}:1": "event_1",
            f"{project_two.id}:2": "event_2",
        }
        rulegroup_event_mapping_two = {
            f"{self.project.id}:3": "event_3",
            f"{project_two.id}:4": "event_4",
        }
        self.buffer_mapping = {
            self.project.id: rulegroup_event_mapping_one,
            project_two.id: rulegroup_event_mapping_two,
        }

        mock_buffer = Mock()
        mock_buffer.get_set.return_value = self.buffer_mapping.keys()
        # To get the correct mapping, we need to return the correct
        # rulegroup_event mapping based on the project_id input
        mock_buffer.get_hash.side_effect = self.get_rulegroup_event_mapping_from_input

        process_delayed_alert_conditions(mock_buffer)

        for project, rule_group_event_mapping in (
            (self.project, rulegroup_event_mapping_one),
            (project_two, rulegroup_event_mapping_two),
        ):
            mock_safe_execute.assert_any_call(
                apply_delayed,
                project,
                rule_group_event_mapping,
                _with_transaction=False,
            )

from unittest.mock import Mock, patch

from sentry.rules.processing.delayed_processing import (
    apply_delayed,
    process_delayed_alert_conditions,
)
from sentry.testutils.cases import TestCase


class ProcessDelayedAlertConditionsTest(TestCase):
    def get_rulegroup_event_mapping_from_input(self, proj_model, proj_id_map):
        proj_id = proj_id_map.popitem()[1]
        return self.buffer_mapping[proj_id]

    @patch("sentry.rules.processing.delayed_processing.safe_execute")
    def test_fetches_from_buffer_and_executes(self, mock_safe_execute):
        self.project_two = self.create_project()

        project_id_mapping = {
            self.project.id: self.project,
            self.project_two.id: self.project_two,
        }
        rulegroup_event_mapping_one = {"1:1": 1, "2:2": 2}
        rulegroup_event_mapping_two = {"3:3": 3, "4:4": 4}
        self.buffer_mapping = {
            self.project.id: rulegroup_event_mapping_one,
            self.project_two.id: rulegroup_event_mapping_two,
        }

        mock_buffer = Mock()
        mock_buffer.get_list.return_value = self.buffer_mapping.keys()
        # To get the correct mapping, we need to return the correct
        # rulegroup_event mapping based on the project_id input
        mock_buffer.get_queue.side_effect = self.get_rulegroup_event_mapping_from_input

        process_delayed_alert_conditions(mock_buffer)

        for project_id, rule_group_event_mapping in self.buffer_mapping.items():
            project = project_id_mapping[project_id]
            mock_safe_execute.assert_any_call(
                apply_delayed,
                project,
                rule_group_event_mapping,
                _with_transaction=False,
            )

from sentry.models.rule import Rule
from sentry.notifications.utils.rules import get_key_from_rule_data, get_rule_or_workflow_id
from sentry.testutils.cases import TestCase


class GetKeyFromRuleDataTest(TestCase):
    def test_reads_key_from_first_action(self):
        rule = Rule(id=1, data={"actions": [{"legacy_rule_id": "99"}]})
        assert get_key_from_rule_data(rule, "legacy_rule_id") == "99"

    def test_empty_actions_raises_assertion_error(self):
        rule = Rule(id=1, data={"actions": []})
        with self.assertRaises(AssertionError):
            get_key_from_rule_data(rule, "legacy_rule_id")

    def test_missing_actions_raises_assertion_error(self):
        rule = Rule(id=1, data={})
        with self.assertRaises(AssertionError):
            get_key_from_rule_data(rule, "workflow_id")


class GetRuleOrWorkflowIdTest(TestCase):
    def test_empty_actions_falls_back_to_rule_id(self):
        rule = Rule(id=42, data={"actions": []})
        assert get_rule_or_workflow_id(rule) == ("legacy_rule_id", "42")

    def test_workflow_id_from_action(self):
        rule = Rule(id=42, data={"actions": [{"workflow_id": "7"}]})
        assert get_rule_or_workflow_id(rule) == ("workflow_id", "7")

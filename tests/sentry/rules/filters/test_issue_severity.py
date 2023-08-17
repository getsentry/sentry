from sentry.issues.grouptype import GroupCategory
from sentry.rules import MatchType
from sentry.rules.filters.issue_severity import IssueSeverityFilter
from sentry.testutils.cases import RuleTestCase


class IssueSeverityFilterTest(RuleTestCase):
    rule_cls = IssueSeverityFilter

    def test_valid_input_values(self):
        event = self.get_event()
        event.group.data["metadata"] = {"severity": "0.7"}

        self.assertPasses(
            self.get_rule(data={"match": MatchType.GREATER_OR_EQUAL, "value": 0.5}), event
        )
        self.assertPasses(
            self.get_rule(data={"match": MatchType.GREATER_OR_EQUAL, "value": 0.7}), event
        )
        self.assertPasses(
            self.get_rule(data={"match": MatchType.GREATER_OR_EQUAL, "value": "0.5"}), event
        )
        self.assertPasses(
            self.get_rule(data={"match": MatchType.LESS_OR_EQUAL, "value": 0.9}), event
        )

    def test_no_group_does_not_pass(self):
        event = self.get_event()
        event.group_id = None
        event.groups = None

        self.assertDoesNotPass(
            self.get_rule(data={"match": MatchType.GREATER_OR_EQUAL, "value": 0.5}), event
        )

    def test_fail_on_invalid_data(self):
        event = self.get_event()
        event.group.data["metadata"] = {"severity": "0.7"}

        data_cases = [
            {"match": MatchType.GREATER_OR_EQUAL, "value": 0.9},
            {"match": MatchType.GREATER_OR_EQUAL, "value": "0.9"},
            {"match": MatchType.LESS_OR_EQUAL, "value": "0.5"},
            {"match": MatchType.LESS_OR_EQUAL, "value": 0.5},
            {"value": GroupCategory.ERROR.name},
            {"match": MatchType.GREATER_OR_EQUAL},
            {},
        ]

        for data_case in data_cases:
            rule = self.get_rule(data=data_case)
            self.assertDoesNotPass(rule, event)

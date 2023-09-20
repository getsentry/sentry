from unittest.mock import patch

from sentry.rules import MatchType
from sentry.rules.filters.issue_severity import IssueSeverityFilter
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class IssueSeverityFilterTest(RuleTestCase):
    rule_cls = IssueSeverityFilter

    @patch("sentry.models.Group.objects.get_from_cache")
    @with_feature("projects:first-event-severity-alerting")
    def test_valid_input_values(self, mock_group):
        event = self.get_event()
        event.group.data["metadata"] = {"severity": "0.7"}
        mock_group.return_value = event.group

        data_cases = [
            {"match": MatchType.GREATER_OR_EQUAL, "value": 0.5},
            {"match": MatchType.GREATER_OR_EQUAL, "value": 0.7},
            {"match": MatchType.LESS_OR_EQUAL, "value": 0.7},
            {"match": MatchType.LESS_OR_EQUAL, "value": 0.9},
            {"match": MatchType.LESS_OR_EQUAL, "value": "0.9"},
        ]

        for data_case in data_cases:
            rule = self.get_rule(data=data_case)
            self.assertPasses(rule, event)
            assert self.passes_activity(rule) is True

    @with_feature("projects:first-event-severity-alerting")
    def test_fail_on_no_group(self):
        event = self.get_event()
        event.group_id = None
        event.groups = None

        self.assertDoesNotPass(
            self.get_rule(data={"match": MatchType.GREATER_OR_EQUAL, "value": 0.5}), event
        )

    @with_feature("projects:first-event-severity-alerting")
    def test_fail_on_no_severity(self):
        event = self.get_event()

        assert not event.group.get_event_metadata().get("severity")
        self.assertDoesNotPass(
            self.get_rule(data={"match": MatchType.GREATER_OR_EQUAL, "value": 0.5}), event
        )

    @patch("sentry.models.Group.objects.get_from_cache")
    @with_feature("projects:first-event-severity-alerting")
    def test_failing_input_values(self, mock_group):
        event = self.get_event()
        event.group.data["metadata"] = {"severity": "0.7"}
        mock_group.return_value = event.group

        data_cases = [
            {"match": MatchType.GREATER_OR_EQUAL, "value": 0.9},
            {"match": MatchType.GREATER_OR_EQUAL, "value": "0.9"},
            {"match": MatchType.LESS_OR_EQUAL, "value": "0.5"},
            {"match": MatchType.LESS_OR_EQUAL, "value": 0.5},
            {"value": 0.5},
            {"match": MatchType.GREATER_OR_EQUAL},
            {},
        ]

        for data_case in data_cases:
            rule = self.get_rule(data=data_case)
            self.assertDoesNotPass(rule, event)
            assert self.passes_activity(rule) is False

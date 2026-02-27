from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.rules.filters.issue_type import IssueTypeFilter
from sentry.testutils.cases import PerformanceIssueTestCase, RuleTestCase, SnubaTestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class IssueTypeFilterErrorTest(RuleTestCase):
    rule_cls = IssueTypeFilter

    def test_valid_input_values(self) -> None:
        event = self.get_event()

        self.assertPasses(self.get_rule(data={"value": ErrorGroupType.slug}), event)

    def test_no_group_does_not_pass(self) -> None:
        event = self.get_event()
        event.group_id = None
        event.groups = None

        self.assertDoesNotPass(self.get_rule(data={"value": ErrorGroupType.slug}), event)

    def test_fail_on_invalid_data(self) -> None:
        event = self.get_event()
        data_cases = [
            {"value": None},
            {},
            {"value": "ERROR"},
            {"value": "invalid_slug"},
            {"value": 123},
        ]

        for data_case in data_cases:
            rule = self.get_rule(data=data_case)
            self.assertDoesNotPass(rule, event)

    def test_group_event(self) -> None:
        event = self.get_event()
        assert event.group is not None
        group_event = event.for_group(event.group)

        self.assertPasses(self.get_rule(data={"value": ErrorGroupType.slug}), event)
        self.assertPasses(self.get_rule(data={"value": ErrorGroupType.slug}), group_event)

    def test_exclude(self) -> None:
        event = self.get_event()
        assert event.group is not None
        group_event = event.for_group(event.group)

        self.assertDoesNotPass(
            self.get_rule(data={"value": ErrorGroupType.slug, "include": "false"}),
            event,
        )
        self.assertDoesNotPass(
            self.get_rule(data={"value": ErrorGroupType.slug, "include": "false"}),
            group_event,
        )

        self.assertPasses(
            self.get_rule(data={"value": MetricIssue.slug, "include": "false"}),
            event,
        )
        self.assertPasses(
            self.get_rule(data={"value": MetricIssue.slug, "include": "false"}),
            group_event,
        )

    def test_include_defaults_to_true(self) -> None:
        event = self.get_event()

        self.assertPasses(
            self.get_rule(data={"value": ErrorGroupType.slug}),
            event,
        )
        self.assertDoesNotPass(
            self.get_rule(data={"value": MetricIssue.slug}),
            event,
        )

    def test_include_explicit_true(self) -> None:
        event = self.get_event()

        self.assertPasses(
            self.get_rule(data={"value": ErrorGroupType.slug, "include": "true"}),
            event,
        )
        self.assertDoesNotPass(
            self.get_rule(data={"value": MetricIssue.slug, "include": "true"}),
            event,
        )


class IssueTypeFilterPerformanceTest(
    RuleTestCase,
    SnubaTestCase,
    PerformanceIssueTestCase,
):
    rule_cls = IssueTypeFilter

    def test_performance_issue_type(self) -> None:
        tx_event = self.create_performance_issue()
        assert tx_event.group
        assert tx_event.group.issue_type
        slug = tx_event.group.issue_type.slug
        self.assertPasses(self.get_rule(data={"value": slug}), tx_event)

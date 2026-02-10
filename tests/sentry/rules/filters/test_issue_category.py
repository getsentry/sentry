from sentry.issues.grouptype import GroupCategory
from sentry.rules.filters.issue_category import IssueCategoryFilter
from sentry.testutils.cases import PerformanceIssueTestCase, RuleTestCase, SnubaTestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class IssueCategoryFilterErrorTest(RuleTestCase):
    rule_cls = IssueCategoryFilter

    def test_valid_input_values(self) -> None:
        event = self.get_event()

        self.assertPasses(self.get_rule(data={"value": 1}), event)
        self.assertPasses(self.get_rule(data={"value": str(GroupCategory.ERROR.value)}), event)
        self.assertPasses(self.get_rule(data={"value": GroupCategory.ERROR.value}), event)

    def test_no_group_does_not_pass(self) -> None:
        event = self.get_event()
        event.group_id = None
        event.groups = None

        self.assertDoesNotPass(self.get_rule(data={"value": GroupCategory.ERROR.value}), event)

    def test_fail_on_invalid_data(self) -> None:
        event = self.get_event()
        data_cases = [
            {"value": None},
            {},
            {"value": GroupCategory.ERROR.name},
            {"value": "ERROR"},
            {"value": "error"},
        ]

        for data_case in data_cases:
            rule = self.get_rule(data=data_case)
            self.assertDoesNotPass(rule, event)

    def test_group_event(self) -> None:
        event = self.get_event()
        assert event.group is not None
        group_event = event.for_group(event.group)

        self.assertPasses(self.get_rule(data={"value": GroupCategory.ERROR.value}), event)
        self.assertPasses(self.get_rule(data={"value": GroupCategory.ERROR.value}), group_event)

    def test_exclude(self) -> None:
        event = self.get_event()
        assert event.group is not None
        group_event = event.for_group(event.group)

        self.assertDoesNotPass(
            self.get_rule(data={"value": GroupCategory.ERROR.value, "include": False}), event
        )
        self.assertDoesNotPass(
            self.get_rule(data={"value": GroupCategory.ERROR.value, "include": False}), group_event
        )

        self.assertPasses(
            self.get_rule(data={"value": GroupCategory.PERFORMANCE.value, "include": False}), event
        )
        self.assertPasses(
            self.get_rule(data={"value": GroupCategory.PERFORMANCE.value, "include": False}),
            group_event,
        )

    def test_exclude_string_value(self) -> None:
        event = self.get_event()
        self.assertDoesNotPass(
            self.get_rule(data={"value": GroupCategory.ERROR.value, "include": "0"}), event
        )


class IssueCategoryFilterPerformanceTest(
    RuleTestCase,
    SnubaTestCase,
    PerformanceIssueTestCase,
):
    rule_cls = IssueCategoryFilter

    def test_transaction_category(self) -> None:
        tx_event = self.create_performance_issue()
        assert tx_event.group
        self.assertPasses(self.get_rule(data={"value": GroupCategory.PERFORMANCE.value}), tx_event)

    def test_transaction_category_v2(self) -> None:
        tx_event = self.create_performance_issue()
        assert tx_event.group
        self.assertPasses(self.get_rule(data={"value": GroupCategory.DB_QUERY.value}), tx_event)

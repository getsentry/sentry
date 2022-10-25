from sentry.eventstore.models import Event, GroupEvent
from sentry.rules.filters.issue_category import IssueCategoryFilter
from sentry.testutils import RuleTestCase, SnubaTestCase
from sentry.testutils.performance_issues.store_transaction import PerfIssueTransactionTestMixin
from sentry.types.issues import GroupCategory, GroupType


class IssueCategoryFilterErrorTest(RuleTestCase):
    rule_cls = IssueCategoryFilter

    def test_valid_input_values(self):
        event = self.get_event()

        self.assertPasses(self.get_rule(data={"value": 1}), event)
        self.assertPasses(self.get_rule(data={"value": str(GroupCategory.ERROR.value)}), event)
        self.assertPasses(self.get_rule(data={"value": GroupCategory.ERROR.value}), event)

    def test_no_group_does_not_pass(self):
        event = self.get_event()
        event.group_id = None
        event.groups = None

        self.assertDoesNotPass(self.get_rule(data={"value": GroupCategory.ERROR.value}), event)

    def test_fail_on_invalid_data(self):
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

    def test_group_event(self):
        event: Event = self.get_event()
        group_event: GroupEvent = event.for_group(event.group)

        self.assertPasses(self.get_rule(data={"value": GroupCategory.ERROR.value}), event)
        self.assertPasses(self.get_rule(data={"value": GroupCategory.ERROR.value}), group_event)


class IssueCategoryFilterPerformanceTest(
    RuleTestCase, SnubaTestCase, PerfIssueTransactionTestMixin
):
    rule_cls = IssueCategoryFilter

    def test_transaction_category(self):
        tx_event = self.store_transaction(
            self.project.id,
            "test_transaction_category",
            [f"{GroupType.PERFORMANCE_SLOW_SPAN.value}-group1"],
        )

        group_events = list(tx_event.build_group_events())
        assert len(group_events) == 1

        self.assertPasses(
            self.get_rule(data={"value": GroupCategory.PERFORMANCE.value}), group_events[0]
        )

from sentry.eventstore.models import Event, GroupEvent
from sentry.rules.filters.issue_type import IssueTypeFilter
from sentry.testutils import RuleTestCase, SnubaTestCase
from sentry.testutils.perfomance_issues.store_transaction import PerfIssueTransactionTestMixin
from sentry.types.issues import GroupType


class IssueTypeFilterErrorTest(RuleTestCase):
    rule_cls = IssueTypeFilter

    def test_valid_input_values(self):
        event = self.get_event()

        self.assertPasses(self.get_rule(data={"value": 1}), event)
        self.assertPasses(self.get_rule(data={"value": str(GroupType.ERROR.value)}), event)
        self.assertPasses(self.get_rule(data={"value": GroupType.ERROR.value}), event)

    def test_no_group_does_not_pass(self):
        event = self.get_event()
        event.group_id = None
        event.groups = None

        self.assertDoesNotPass(self.get_rule(data={"value": GroupType.ERROR.value}), event)

    def test_fail_on_invalid_data(self):
        event = self.get_event()
        data_cases = [
            {"value": None},
            {},
            {"value": GroupType.ERROR.name},
            {"value": "ERROR"},
            {"value": "error"},
        ]

        for data_case in data_cases:
            rule = self.get_rule(data=data_case)
            self.assertDoesNotPass(rule, event)

    def test_group_event(self):
        event: Event = self.get_event()
        group_event: GroupEvent = event.for_group(event.group)

        self.assertPasses(self.get_rule(data={"value": GroupType.ERROR.value}), event)
        self.assertPasses(self.get_rule(data={"value": GroupType.ERROR.value}), group_event)


class IssueTypeFilterPerformanceTest(RuleTestCase, SnubaTestCase, PerfIssueTransactionTestMixin):
    rule_cls = IssueTypeFilter

    def test_transaction_types(self):
        for i, perf_type in enumerate(
            [
                GroupType.PERFORMANCE_SLOW_SPAN,
                GroupType.PERFORMANCE_N_PLUS_ONE,
                GroupType.PERFORMANCE_SEQUENTIAL_SLOW_SPANS,
                GroupType.PERFORMANCE_LONG_TASK_SPANS,
                GroupType.PERFORMANCE_RENDER_BLOCKING_ASSET_SPAN,
                GroupType.PERFORMANCE_DUPLICATE_SPANS,
                GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
            ]
        ):
            tx_event = self.store_transaction(
                self.project.id,
                "test_transaction_category",
                [f"{perf_type.value}-group{i}"],
            )
            self.assertPasses(self.get_rule(data={"value": perf_type.value}), tx_event)

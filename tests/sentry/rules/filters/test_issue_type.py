from sentry.eventstore.models import Event, GroupEvent
from sentry.rules.filters.issue_type import ENABLED_GROUP_TYPES, IssueTypeFilter
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

    def test_enabled_transaction_types(self):
        for i, perf_type in enumerate(ENABLED_GROUP_TYPES):
            tx_event = self.store_transaction(
                self.project.id,
                "test_enabled_transaction_types",
                [f"{perf_type.value}-group{i}"],
            )

            group_events = list(tx_event.build_group_events())
            assert len(group_events) == 1

            self.assertPasses(self.get_rule(data={"value": perf_type.value}), group_events[0])

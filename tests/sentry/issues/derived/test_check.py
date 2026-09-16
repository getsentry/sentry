from sentry.issues.derived.check import (
    StatusInconsistency,
    _log_redundant_reconciles,
    check_status_consistency,
)
from sentry.issues.derived.features import IssueStatus
from sentry.issues.derived.processing import PIPELINE
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.models.group import GroupStatus
from sentry.testutils.cases import TestCase


class CheckStatusConsistencyTest(TestCase):
    def test_expected_closed_but_derived_open(self) -> None:
        group = self.create_group(status=GroupStatus.IGNORED)
        derived = self.create_group_derived_data(group=group, data={"status": "open"})

        assert check_status_consistency(group, derived) == StatusInconsistency(
            derived=IssueStatus.OPEN,
            actual=IssueStatus.CLOSED,
        )

    def test_expected_open_but_derived_closed(self) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        derived = self.create_group_derived_data(group=group, data={"status": "closed"})

        assert check_status_consistency(group, derived) == StatusInconsistency(
            derived=IssueStatus.CLOSED,
            actual=IssueStatus.OPEN,
        )

    def test_consistent(self) -> None:
        group = self.create_group(status=GroupStatus.RESOLVED)
        derived = self.create_group_derived_data(group=group, data={"status": "closed"})

        assert check_status_consistency(group, derived) is None

    def test_status_without_derived_equivalent(self) -> None:
        group = self.create_group(status=GroupStatus.PENDING_DELETION)
        derived = self.create_group_derived_data(group=group, data={"status": "open"})

        assert check_status_consistency(group, derived) is None

    def test_logs_redundant_reconcile(self) -> None:
        group = self.create_group()
        derived = self.create_group_derived_data(
            group=group,
            data={"status": "open", "no_change_reconcile_ids": [42, 43]},
        )
        state = GroupDerivedDataStore.load(PIPELINE, derived)

        with self.assertLogs("sentry.issues.derived.check", level="INFO") as logs:
            _log_redundant_reconciles(derived, state)

        assert any("check_derived_data.redundant_reconcile" in message for message in logs.output)

    def test_skips_log_without_redundant_reconcile(self) -> None:
        group = self.create_group()
        derived = self.create_group_derived_data(group=group, data={"status": "open"})
        state = GroupDerivedDataStore.load(PIPELINE, derived)

        with self.assertNoLogs("sentry.issues.derived.check", level="INFO"):
            _log_redundant_reconciles(derived, state)

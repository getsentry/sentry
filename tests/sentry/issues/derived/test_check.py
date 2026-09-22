from typing import Any
from unittest.mock import call, patch

import pytest

from sentry.issues.derived.check import (
    StatusInconsistency,
    _log_redundant_reconciles,
    check_status_consistency,
    record_status_consistency,
)
from sentry.issues.derived.features import IssueStatus
from sentry.issues.derived.framework import DerivedDataError
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

    def test_invalid_status_is_not_reported_as_aligned(self) -> None:
        self._assert_corrupt_status({"status": "invalid"})

    def test_null_status_is_not_treated_as_missing(self) -> None:
        self._assert_corrupt_status({"status": None})

    def test_non_object_data_does_not_abort_status_reporting(self) -> None:
        self._assert_corrupt_status([])

    def _assert_corrupt_status(self, data: Any) -> None:
        group = self.create_group()
        derived = self.create_group_derived_data(group, data=data)
        with pytest.raises(DerivedDataError):
            check_status_consistency(group, derived)
        with patch("sentry.issues.derived.check.metrics.incr") as incr:
            assert record_status_consistency(group, derived, source="read_path") is None
        assert incr.call_args_list == [
            call(
                "issues.derived.feature_error",
                sample_rate=1.0,
                tags={"operation": "status_check", "stage": "decode"},
            ),
            call(
                "issues.status_reconciliation.error", sample_rate=1.0, tags={"source": "read_path"}
            ),
        ]

    def test_missing_status_keeps_default(self) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        derived = self.create_group_derived_data(group, data={})
        assert check_status_consistency(group, derived) is None

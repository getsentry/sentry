from __future__ import annotations

from sentry.preprod.api.models.snapshots.snapshot_status import (
    SnapshotStatusInput,
    derive_snapshot_status,
)
from sentry.preprod.models import PreprodComparisonApproval
from sentry.preprod.snapshots.constants import MISSING_BASE_GRACE_PERIOD_SECONDS
from sentry.preprod.snapshots.models import PreprodSnapshotComparison
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


def _make_input(
    latest_comparison: PreprodSnapshotComparison | None = None,
    latest_approval: PreprodComparisonApproval | None = None,
    has_base_sha: bool = False,
    artifact_age_seconds: float = 0.0,
    base_artifact_exists: bool | None = None,
) -> SnapshotStatusInput:
    return SnapshotStatusInput(
        latest_comparison=latest_comparison,
        latest_approval=latest_approval,
        has_base_sha=has_base_sha,
        artifact_age_seconds=artifact_age_seconds,
        base_artifact_exists=base_artifact_exists,
    )


@cell_silo_test
class TestDeriveSnapshotStatusComparisonState(TestCase):
    def _create_comparison(
        self, state: int = PreprodSnapshotComparison.State.SUCCESS
    ) -> PreprodSnapshotComparison:
        artifact = self.create_preprod_artifact(project=self.project)
        head_metrics = self.create_preprod_snapshot_metrics(
            preprod_artifact=artifact, image_count=1
        )
        base_artifact = self.create_preprod_artifact(project=self.project)
        base_metrics = self.create_preprod_snapshot_metrics(
            preprod_artifact=base_artifact, image_count=1
        )
        return self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            state=state,
        )

    def test_comparison_state_mapping(self) -> None:
        for state, expected in [
            (PreprodSnapshotComparison.State.PENDING, "pending"),
            (PreprodSnapshotComparison.State.PROCESSING, "processing"),
            (PreprodSnapshotComparison.State.SUCCESS, "success"),
            (PreprodSnapshotComparison.State.FAILED, "failed"),
        ]:
            comparison = self._create_comparison(state=state)
            result = derive_snapshot_status(_make_input(latest_comparison=comparison))
            assert result.comparison_state == expected

    def test_failed_state_with_error_message(self) -> None:
        comparison = self._create_comparison(state=PreprodSnapshotComparison.State.FAILED)
        comparison.error_message = "Something went wrong"
        comparison.save(update_fields=["error_message"])
        result = derive_snapshot_status(_make_input(latest_comparison=comparison))
        assert result.comparison_state == "failed"
        assert result.comparison_error_message == "Something went wrong"

    def test_no_comparison_no_base_sha(self) -> None:
        result = derive_snapshot_status(_make_input())
        assert result.comparison_state is None

    def test_no_comparison_has_base_sha_within_grace_period(self) -> None:
        result = derive_snapshot_status(_make_input(has_base_sha=True, artifact_age_seconds=0.0))
        assert result.comparison_state == "waiting_for_base"

    def test_no_comparison_has_base_sha_past_grace_period_no_base_artifact(self) -> None:
        result = derive_snapshot_status(
            _make_input(
                has_base_sha=True,
                artifact_age_seconds=MISSING_BASE_GRACE_PERIOD_SECONDS + 1,
                base_artifact_exists=False,
            )
        )
        assert result.comparison_state == "no_base_build"

    def test_no_comparison_has_base_sha_past_grace_period_base_artifact_exists(self) -> None:
        result = derive_snapshot_status(
            _make_input(
                has_base_sha=True,
                artifact_age_seconds=MISSING_BASE_GRACE_PERIOD_SECONDS + 1,
                base_artifact_exists=True,
            )
        )
        assert result.comparison_state == "waiting_for_base"


@cell_silo_test
class TestDeriveSnapshotStatusApprovalStatus(TestCase):
    def _create_approval(
        self,
        approval_status: int = PreprodComparisonApproval.ApprovalStatus.APPROVED,
        extras: dict | None = None,
    ) -> PreprodComparisonApproval:
        artifact = self.create_preprod_artifact(project=self.project)
        return self.create_preprod_comparison_approval(
            preprod_artifact=artifact,
            approval_status=approval_status,
            extras=extras,
        )

    def test_no_approval_returns_none(self) -> None:
        result = derive_snapshot_status(_make_input())
        assert result.approval_status is None

    def test_manual_approval(self) -> None:
        approval = self._create_approval()
        result = derive_snapshot_status(_make_input(latest_approval=approval))
        assert result.approval_status == "approved"

    def test_auto_approval(self) -> None:
        approval = self._create_approval(extras={"auto_approval": True})
        result = derive_snapshot_status(_make_input(latest_approval=approval))
        assert result.approval_status == "auto_approved"

    def test_extras_none_treated_as_manual(self) -> None:
        approval = self._create_approval(extras=None)
        result = derive_snapshot_status(_make_input(latest_approval=approval))
        assert result.approval_status == "approved"

    def test_needs_approval(self) -> None:
        approval = self._create_approval(
            approval_status=PreprodComparisonApproval.ApprovalStatus.NEEDS_APPROVAL,
        )
        result = derive_snapshot_status(_make_input(latest_approval=approval))
        assert result.approval_status == "requires_approval"

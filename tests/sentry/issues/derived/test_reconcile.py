from datetime import timedelta
from typing import cast
from unittest.mock import patch

from sentry.hybridcloud.models.outbox import CellOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    ActionSource,
    ReconcileStatusAction,
)
from sentry.issues.derived.check import StatusInconsistency
from sentry.issues.derived.features import IssueStatus
from sentry.issues.derived.processing import PIPELINE
from sentry.issues.derived.reconcile import reconcile_group_status
from sentry.issues.models.groupactionlogoutbox import GroupActionLogOutbox
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.locks import locks
from sentry.models.group import Group, GroupStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.action_log import CapturedAction, capture_action_log
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.types.group import GroupSubStatus


@with_feature("projects:issue-status-reconciliation")
class ReconcileGroupStatusTest(TestCase):
    def _create_divergent_group(
        self,
        *,
        group_status: int = GroupStatus.RESOLVED,
        derived_status: str = "open",
        pipeline_hash: str | None = PIPELINE.pipeline_hash,
    ) -> tuple[Group, GroupDerivedData]:
        if group_status == GroupStatus.RESOLVED:
            group = self.create_group(status=group_status, substatus=None)
        elif group_status == GroupStatus.IGNORED:
            group = self.create_group(status=group_status, substatus=GroupSubStatus.FOREVER)
        else:
            group = self.create_group(status=group_status, substatus=GroupSubStatus.ONGOING)

        derived = self.create_group_derived_data(
            group=group,
            data={"status": derived_status},
            pipeline_hash=pipeline_hash,
        )
        return group, derived

    def _seed_outbox(self, group_id: int, *, dedicated: bool = False) -> None:
        model = GroupActionLogOutbox if dedicated else CellOutbox
        with outbox_context(flush=False):
            model(
                shard_scope=OutboxScope.GROUP_SCOPE,
                shard_identifier=group_id,
                category=OutboxCategory.GROUP_ACTION_LOG_EVENT,
                object_identifier=model.next_object_identifier(),
                payload={"group_id": group_id},
            ).save()

    def test_aligned_no_action(self) -> None:
        group, _ = self._create_divergent_group(
            group_status=GroupStatus.RESOLVED, derived_status="closed"
        )

        with (
            capture_action_log() as log,
            patch("sentry.issues.derived.reconcile.metrics.incr") as mock_incr,
        ):
            reconcile_group_status(group.id)

        log.assert_not_logged(ReconcileStatusAction)
        mock_incr.assert_any_call(
            "issues.derived.reconcile_group_status.result",
            sample_rate=1.0,
            tags={"result": "aligned"},
        )

    def test_divergent_publishes_action(self) -> None:
        group, _ = self._create_divergent_group(
            group_status=GroupStatus.RESOLVED, derived_status="open"
        )

        with (
            capture_action_log() as log,
            patch("sentry.issues.derived.reconcile.metrics.incr") as mock_incr,
        ):
            reconcile_group_status(group.id)

        captured = cast(
            CapturedAction,
            log.assert_logged(
                ReconcileStatusAction,
                group_id=group.id,
                source=ActionSource.SYSTEM,
                actor=SYSTEM_ACTOR,
                status="closed",
            ),
        )
        assert isinstance(captured.action, ReconcileStatusAction)
        assert captured.action.reason == "group_status:Resolved"
        mock_incr.assert_any_call(
            "issues.derived.reconcile_group_status.result",
            sample_rate=1.0,
            tags={"result": "published", "target_status": "closed"},
        )

    def test_divergent_open_publishes_action(self) -> None:
        group, _ = self._create_divergent_group(
            group_status=GroupStatus.UNRESOLVED, derived_status="closed"
        )

        with capture_action_log() as log:
            reconcile_group_status(group.id)

        log.assert_logged(ReconcileStatusAction, group_id=group.id, status="open")

    def test_pending_cell_outbox_bails(self) -> None:
        group, _ = self._create_divergent_group()
        self._seed_outbox(group.id, dedicated=False)

        with (
            capture_action_log() as log,
            patch("sentry.issues.derived.reconcile.metrics.incr") as mock_incr,
        ):
            reconcile_group_status(group.id)

        log.assert_not_logged(ReconcileStatusAction)
        mock_incr.assert_any_call(
            "issues.derived.reconcile_group_status.result",
            sample_rate=1.0,
            tags={"result": "pending_outbox"},
        )

    def test_pending_dedicated_outbox_bails(self) -> None:
        group, _ = self._create_divergent_group()
        self._seed_outbox(group.id, dedicated=True)

        with (
            capture_action_log() as log,
            patch("sentry.issues.derived.reconcile.metrics.incr") as mock_incr,
        ):
            reconcile_group_status(group.id)

        log.assert_not_logged(ReconcileStatusAction)
        mock_incr.assert_any_call(
            "issues.derived.reconcile_group_status.result",
            sample_rate=1.0,
            tags={"result": "pending_outbox"},
        )

    def test_stale_pipeline_hash_bails(self) -> None:
        group, _ = self._create_divergent_group(pipeline_hash=None)

        with (
            capture_action_log() as log,
            patch("sentry.issues.derived.reconcile.metrics.incr") as mock_incr,
        ):
            reconcile_group_status(group.id)

        log.assert_not_logged(ReconcileStatusAction)
        mock_incr.assert_any_call(
            "issues.derived.reconcile_group_status.result",
            sample_rate=1.0,
            tags={"result": "stale_hash"},
        )

    def test_mismatched_pipeline_hash_bails(self) -> None:
        group, _ = self._create_divergent_group(pipeline_hash="stale-hash-value")

        with (
            capture_action_log() as log,
            patch("sentry.issues.derived.reconcile.metrics.incr") as mock_incr,
        ):
            reconcile_group_status(group.id)

        log.assert_not_logged(ReconcileStatusAction)
        mock_incr.assert_any_call(
            "issues.derived.reconcile_group_status.result",
            sample_rate=1.0,
            tags={"result": "stale_hash"},
        )

    def test_no_derived_data_bails(self) -> None:
        group = self.create_group(status=GroupStatus.RESOLVED, substatus=None)

        with (
            capture_action_log() as log,
            patch("sentry.issues.derived.reconcile.metrics.incr") as mock_incr,
        ):
            reconcile_group_status(group.id)

        log.assert_not_logged(ReconcileStatusAction)
        mock_incr.assert_any_call(
            "issues.derived.reconcile_group_status.result",
            sample_rate=1.0,
            tags={"result": "no_derived_data"},
        )

    @override_options({"issues.derived_data.read_path_checks.killswitch": True})
    def test_killswitch_bails(self) -> None:
        group, _ = self._create_divergent_group()

        with (
            capture_action_log() as log,
            patch("sentry.issues.derived.reconcile.metrics.incr") as mock_incr,
        ):
            reconcile_group_status(group.id)

        log.assert_not_logged(ReconcileStatusAction)
        mock_incr.assert_any_call(
            "issues.derived.reconcile_group_status.result",
            sample_rate=1.0,
            tags={"result": "killswitched"},
        )

    def test_lock_held_bails(self) -> None:
        group, _ = self._create_divergent_group()
        lock = locks.get(
            f"reconcile_group_status:{group.id}",
            duration=30,
            name="reconcile_group_status",
        )

        with (
            lock.acquire(),
            capture_action_log() as log,
            patch("sentry.issues.derived.reconcile.metrics.incr") as mock_incr,
        ):
            reconcile_group_status(group.id)

        log.assert_not_logged(ReconcileStatusAction)
        mock_incr.assert_any_call(
            "issues.derived.reconcile_group_status.result",
            sample_rate=1.0,
            tags={"result": "locked_out"},
        )

    def test_group_status_changed_during_check_bails(self) -> None:
        group, _ = self._create_divergent_group(
            group_status=GroupStatus.RESOLVED, derived_status="open"
        )

        with (
            patch(
                "sentry.issues.derived.reconcile.check_status_consistency",
                side_effect=[
                    StatusInconsistency(derived=IssueStatus.OPEN, actual=IssueStatus.CLOSED),
                    None,
                ],
            ),
            capture_action_log() as log,
            patch("sentry.issues.derived.reconcile.metrics.incr") as mock_incr,
        ):
            reconcile_group_status(group.id)

        log.assert_not_logged(ReconcileStatusAction)
        mock_incr.assert_any_call(
            "issues.derived.reconcile_group_status.result",
            sample_rate=1.0,
            tags={"result": "changed_during_check"},
        )

    def test_gdd_generated_at_changed_during_check_bails(self) -> None:
        group, derived = self._create_divergent_group()
        original_generated_at = derived.generated_at

        def bump_generated_at(group_id: int) -> bool:
            GroupDerivedData.objects.filter(group_id=group_id).update(
                generated_at=original_generated_at + timedelta(seconds=1)
            )
            return False

        with (
            patch(
                "sentry.issues.derived.reconcile._has_pending_group_action_log_outbox",
                side_effect=bump_generated_at,
            ),
            capture_action_log() as log,
            patch("sentry.issues.derived.reconcile.metrics.incr") as mock_incr,
        ):
            reconcile_group_status(group.id)

        log.assert_not_logged(ReconcileStatusAction)
        mock_incr.assert_any_call(
            "issues.derived.reconcile_group_status.result",
            sample_rate=1.0,
            tags={"result": "changed_during_check"},
        )

    def test_outbox_appears_between_checks_bails(self) -> None:
        group, _ = self._create_divergent_group()
        calls = {"n": 0}

        def outbox_side_effect(group_id: int) -> bool:
            calls["n"] += 1
            return calls["n"] > 1

        with (
            patch(
                "sentry.issues.derived.reconcile._has_pending_group_action_log_outbox",
                side_effect=outbox_side_effect,
            ),
            capture_action_log() as log,
            patch("sentry.issues.derived.reconcile.metrics.incr") as mock_incr,
        ):
            reconcile_group_status(group.id)

        log.assert_not_logged(ReconcileStatusAction)
        mock_incr.assert_any_call(
            "issues.derived.reconcile_group_status.result",
            sample_rate=1.0,
            tags={"result": "pending_outbox"},
        )

    @with_feature(
        {
            "projects:issue-status-reconciliation": False,
            "projects:issue-action-log-write-to-db": False,
        }
    )
    def test_not_gated_bails(self) -> None:
        group, _ = self._create_divergent_group()

        with (
            capture_action_log() as log,
            patch("sentry.issues.derived.reconcile.metrics.incr") as mock_incr,
        ):
            reconcile_group_status(group.id)

        log.assert_not_logged(ReconcileStatusAction)
        mock_incr.assert_any_call(
            "issues.derived.reconcile_group_status.result",
            sample_rate=1.0,
            tags={"result": "not_gated"},
        )

    def test_group_not_found_bails(self) -> None:
        with patch("sentry.issues.derived.reconcile.metrics.incr") as mock_incr:
            reconcile_group_status(999_999_999)

        mock_incr.assert_any_call(
            "issues.derived.reconcile_group_status.result",
            sample_rate=1.0,
            tags={"result": "group_not_found"},
        )

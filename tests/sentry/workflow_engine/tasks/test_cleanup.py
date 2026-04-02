from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils.query import bulk_delete_objects
from sentry.workflow_engine.models import WorkflowFireHistory
from sentry.workflow_engine.tasks.cleanup import (
    FIRE_HISTORY_RETENTION_DAYS,
    prune_old_fire_history,
)


class TestPruneOldFireHistory(TestCase):
    def _create_fire_history(self, days_ago: int) -> WorkflowFireHistory:
        workflow = self.create_workflow(organization=self.organization)
        group = self.create_group(project=self.project)
        obj = WorkflowFireHistory.objects.create(workflow=workflow, group=group, event_id="abc123")
        if days_ago > 0:
            backdated = timezone.now() - timedelta(days=days_ago)
            WorkflowFireHistory.objects.filter(id=obj.id).update(date_added=backdated)
            obj.refresh_from_db()
        return obj

    def test_noop_when_nothing_to_delete(self) -> None:
        with patch("sentry.workflow_engine.tasks.cleanup.metrics") as mock_metrics:
            prune_old_fire_history()

        mock_metrics.incr.assert_called_once_with(
            "workflow_engine.tasks.prune_old_fire_history.batches_deleted",
            amount=0,
            sample_rate=1.0,
        )

    def test_deletes_rows_older_than_retention(self) -> None:
        old = self._create_fire_history(days_ago=FIRE_HISTORY_RETENTION_DAYS + 1)
        recent = self._create_fire_history(days_ago=FIRE_HISTORY_RETENTION_DAYS - 1)

        prune_old_fire_history()

        assert not WorkflowFireHistory.objects.filter(id=old.id).exists()
        assert WorkflowFireHistory.objects.filter(id=recent.id).exists()

    def test_preserves_recent_rows(self) -> None:
        rows = [
            self._create_fire_history(days_ago=1),
            self._create_fire_history(days_ago=30),
            self._create_fire_history(days_ago=FIRE_HISTORY_RETENTION_DAYS - 1),
        ]

        prune_old_fire_history()

        for row in rows:
            assert WorkflowFireHistory.objects.filter(id=row.id).exists()

    @override_options({"workflow_engine.fire_history_cleanup.batch_size": 10})
    def test_multiple_batches(self) -> None:
        old_ids = []
        for _ in range(25):
            obj = self._create_fire_history(days_ago=FIRE_HISTORY_RETENTION_DAYS + 1)
            old_ids.append(obj.id)

        with patch("sentry.workflow_engine.tasks.cleanup.metrics") as mock_metrics:
            prune_old_fire_history()

        assert WorkflowFireHistory.objects.filter(id__in=old_ids).count() == 0
        mock_metrics.incr.assert_called_once()
        assert mock_metrics.incr.call_args.kwargs["amount"] >= 2

    @override_options(
        {
            "workflow_engine.fire_history_cleanup.batch_size": 10,
            "workflow_engine.fire_history_cleanup.time_limit_seconds": 5.0,
        }
    )
    @patch("sentry.workflow_engine.tasks.cleanup.time")
    def test_time_bounded_leaves_remaining_rows(self, mock_time: MagicMock) -> None:
        # start=0, first check=0 (run batch), second check=6 (exit)
        mock_time.time.side_effect = [0.0, 0.0, 6.0]

        old_ids = []
        for _ in range(25):
            obj = self._create_fire_history(days_ago=FIRE_HISTORY_RETENTION_DAYS + 1)
            old_ids.append(obj.id)

        with patch("sentry.workflow_engine.tasks.cleanup.metrics"):
            prune_old_fire_history()

        remaining = WorkflowFireHistory.objects.filter(id__in=old_ids).count()
        assert remaining == 15  # only one batch of 10 was deleted

    @override_options({"workflow_engine.fire_history_cleanup.batch_size": 5})
    def test_options_honored(self) -> None:
        old_ids = []
        for _ in range(12):
            obj = self._create_fire_history(days_ago=FIRE_HISTORY_RETENTION_DAYS + 1)
            old_ids.append(obj.id)

        with patch(
            "sentry.workflow_engine.tasks.cleanup.bulk_delete_objects",
            wraps=bulk_delete_objects,
        ) as spy:
            prune_old_fire_history()

        for call in spy.call_args_list:
            assert call.kwargs["limit"] == 5

        assert WorkflowFireHistory.objects.filter(id__in=old_ids).count() == 0

    def test_metrics_emitted(self) -> None:
        self._create_fire_history(days_ago=FIRE_HISTORY_RETENTION_DAYS + 1)

        with patch("sentry.workflow_engine.tasks.cleanup.metrics") as mock_metrics:
            prune_old_fire_history()

        mock_metrics.incr.assert_called_once_with(
            "workflow_engine.tasks.prune_old_fire_history.batches_deleted",
            amount=1,  # 1 row fits in a single batch
            sample_rate=1.0,
        )

from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity, OpenPeriodActivityType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils.query import bulk_delete_objects
from sentry.workflow_engine.tasks.cleanup import (
    OPEN_PERIOD_ACTIVITY_RETENTION_DAYS,
    prune_old_open_period_activity,
)


class TestPruneOldOpenPeriodActivity(TestCase):
    def _create_activity(self, days_ago: int) -> GroupOpenPeriodActivity:
        group = self.create_group(project=self.project)
        open_period = GroupOpenPeriod.objects.get(group=group)
        obj = GroupOpenPeriodActivity.objects.create(
            group_open_period=open_period,
            type=OpenPeriodActivityType.OPENED,
        )
        if days_ago > 0:
            backdated = timezone.now() - timedelta(days=days_ago)
            GroupOpenPeriodActivity.objects.filter(id=obj.id).update(date_added=backdated)
            obj.refresh_from_db()
        return obj

    def test_noop_when_nothing_to_delete(self) -> None:
        with patch("sentry.workflow_engine.tasks.cleanup.metrics") as mock_metrics:
            prune_old_open_period_activity()

        mock_metrics.incr.assert_called_once_with(
            "workflow_engine.tasks.prune_old_open_period_activity.batches_deleted",
            amount=0,
            sample_rate=1.0,
        )

    def test_deletes_rows_older_than_retention(self) -> None:
        old = self._create_activity(days_ago=OPEN_PERIOD_ACTIVITY_RETENTION_DAYS + 1)
        recent = self._create_activity(days_ago=OPEN_PERIOD_ACTIVITY_RETENTION_DAYS - 1)

        prune_old_open_period_activity()

        assert not GroupOpenPeriodActivity.objects.filter(id=old.id).exists()
        assert GroupOpenPeriodActivity.objects.filter(id=recent.id).exists()

    def test_preserves_recent_rows(self) -> None:
        rows = [
            self._create_activity(days_ago=1),
            self._create_activity(days_ago=30),
            self._create_activity(days_ago=OPEN_PERIOD_ACTIVITY_RETENTION_DAYS - 1),
        ]

        prune_old_open_period_activity()

        for row in rows:
            assert GroupOpenPeriodActivity.objects.filter(id=row.id).exists()

    @override_options({"workflow_engine.open_period_activity_cleanup.batch_size": 10})
    def test_multiple_batches(self) -> None:
        old_ids = []
        for _ in range(25):
            obj = self._create_activity(days_ago=OPEN_PERIOD_ACTIVITY_RETENTION_DAYS + 1)
            old_ids.append(obj.id)

        with patch("sentry.workflow_engine.tasks.cleanup.metrics") as mock_metrics:
            prune_old_open_period_activity()

        assert GroupOpenPeriodActivity.objects.filter(id__in=old_ids).count() == 0
        mock_metrics.incr.assert_called_once()
        assert mock_metrics.incr.call_args.kwargs["amount"] >= 2

    @override_options(
        {
            "workflow_engine.open_period_activity_cleanup.batch_size": 10,
            "workflow_engine.open_period_activity_cleanup.time_limit_seconds": 5.0,
        }
    )
    @patch("sentry.workflow_engine.tasks.cleanup.time")
    def test_time_bounded_leaves_remaining_rows(self, mock_time: MagicMock) -> None:
        # start=0, first check=0 (run batch), second check=6 (exit)
        mock_time.time.side_effect = [0.0, 0.0, 6.0]

        old_ids = []
        for _ in range(25):
            obj = self._create_activity(days_ago=OPEN_PERIOD_ACTIVITY_RETENTION_DAYS + 1)
            old_ids.append(obj.id)

        with patch("sentry.workflow_engine.tasks.cleanup.metrics"):
            prune_old_open_period_activity()

        remaining = GroupOpenPeriodActivity.objects.filter(id__in=old_ids).count()
        assert remaining == 15  # only one batch of 10 was deleted

    @override_options({"workflow_engine.open_period_activity_cleanup.batch_size": 5})
    def test_options_honored(self) -> None:
        old_ids = []
        for _ in range(12):
            obj = self._create_activity(days_ago=OPEN_PERIOD_ACTIVITY_RETENTION_DAYS + 1)
            old_ids.append(obj.id)

        with patch(
            "sentry.workflow_engine.tasks.cleanup.bulk_delete_objects",
            wraps=bulk_delete_objects,
        ) as spy:
            prune_old_open_period_activity()

        for call in spy.call_args_list:
            assert call.kwargs["limit"] == 5

        assert GroupOpenPeriodActivity.objects.filter(id__in=old_ids).count() == 0

    def test_metrics_emitted(self) -> None:
        self._create_activity(days_ago=OPEN_PERIOD_ACTIVITY_RETENTION_DAYS + 1)

        with patch("sentry.workflow_engine.tasks.cleanup.metrics") as mock_metrics:
            prune_old_open_period_activity()

        mock_metrics.incr.assert_called_once_with(
            "workflow_engine.tasks.prune_old_open_period_activity.batches_deleted",
            amount=1,  # 1 row fits in a single batch
            sample_rate=1.0,
        )

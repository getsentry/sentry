from unittest.mock import patch

from django.db import IntegrityError

from sentry.issues.grouptype import MonitorIncidentType
from sentry.monitors.types import DATA_SOURCE_CRON_MONITOR
from sentry.monitors.utils import ensure_cron_detector, get_detector_for_monitor
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataSource, Detector


class EnsureCronDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self.monitor = self.create_monitor(owner_user_id=None)

    def test_creates_data_source_and_detector_for_new_monitor(self):
        assert not get_detector_for_monitor(self.monitor)
        ensure_cron_detector(self.monitor)
        detector = get_detector_for_monitor(self.monitor)
        assert detector is not None
        assert detector.type == "monitor_check_in_failure"
        assert detector.project_id == self.monitor.project_id
        assert detector.name == self.monitor.name
        assert detector.owner_user_id == self.monitor.owner_user_id
        assert detector.owner_team_id == self.monitor.owner_team_id

    def test_idempotent_for_existing_data_source(self):
        ensure_cron_detector(self.monitor)
        detector = get_detector_for_monitor(self.monitor)
        assert detector
        ensure_cron_detector(self.monitor)
        detector_after = get_detector_for_monitor(self.monitor)
        assert detector_after is not None
        assert detector.id == detector_after.id

    def test_with_owner_user(self):
        self.monitor.owner_user_id = self.user.id
        self.monitor.save()
        ensure_cron_detector(self.monitor)
        detector = Detector.objects.get(
            type=MonitorIncidentType.slug,
            project_id=self.monitor.project_id,
        )
        assert detector.owner_user_id == self.user.id
        assert detector.owner_team_id is None

    def test_with_no_owner(self):
        ensure_cron_detector(self.monitor)

        detector = Detector.objects.get(
            type=MonitorIncidentType.slug,
            project_id=self.monitor.project_id,
        )
        assert detector.owner_user_id is None
        assert detector.owner_team_id is None

    def test_handles_database_errors_gracefully(self):
        with (
            patch("sentry.monitors.utils.logger") as mock_logger,
            patch("sentry.monitors.utils.DataSource.objects.get_or_create") as mock_get_or_create,
        ):
            mock_get_or_create.side_effect = IntegrityError("Database error")

            ensure_cron_detector(self.monitor)
            mock_logger.exception.assert_called_once_with("Error creating cron detector")
        assert not DataSource.objects.filter(
            type=DATA_SOURCE_CRON_MONITOR, source_id=str(self.monitor.id)
        ).exists()

    def test_atomic_transaction_rollback(self):
        with patch("sentry.monitors.utils.Detector.objects.create") as mock_create:
            mock_create.side_effect = IntegrityError("Cannot create detector")

            ensure_cron_detector(self.monitor)
        assert not DataSource.objects.filter(
            type=DATA_SOURCE_CRON_MONITOR, source_id=str(self.monitor.id)
        ).exists()


class GetDetectorForMonitorTest(TestCase):
    def setUp(self):
        super().setUp()
        self.monitor = self.create_monitor()

    def test_returns_none_when_no_detector_exists(self):
        detector = get_detector_for_monitor(self.monitor)
        assert detector is None

    def test_returns_detector_when_exists(self):
        ensure_cron_detector(self.monitor)

        detector = get_detector_for_monitor(self.monitor)
        assert detector is not None
        assert detector.type == "monitor_check_in_failure"
        assert detector.project_id == self.monitor.project_id
        assert detector.name == self.monitor.name

    def test_returns_correct_detector_for_specific_monitor(self):
        monitor1 = self.monitor
        monitor2 = self.create_monitor(name="Monitor 2")

        ensure_cron_detector(monitor1)
        ensure_cron_detector(monitor2)

        detector1 = get_detector_for_monitor(monitor1)
        detector2 = get_detector_for_monitor(monitor2)

        assert detector1 is not None
        assert detector2 is not None
        assert detector1.id != detector2.id
        assert detector1.name == monitor1.name
        assert detector2.name == monitor2.name

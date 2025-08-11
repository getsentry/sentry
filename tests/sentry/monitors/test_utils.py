from unittest.mock import patch

from django.db import IntegrityError

from sentry.issues.grouptype import MonitorIncidentType
from sentry.monitors.types import DATA_SOURCE_CRON_MONITOR
from sentry.monitors.utils import ensure_cron_detector
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataSource, DataSourceDetector, Detector


class EnsureCronDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self.monitor = self.create_monitor(owner_user_id=None)

    def test_creates_data_source_and_detector_for_new_monitor(self):
        assert not DataSource.objects.filter(
            type=DATA_SOURCE_CRON_MONITOR,
            organization_id=self.monitor.organization_id,
            source_id=str(self.monitor.id),
        ).exists()

        ensure_cron_detector(self.monitor)
        data_source = DataSource.objects.get(
            type=DATA_SOURCE_CRON_MONITOR,
            organization_id=self.monitor.organization_id,
            source_id=str(self.monitor.id),
        )
        assert data_source is not None
        detector = Detector.objects.get(
            type=MonitorIncidentType.slug,
            project_id=self.monitor.project_id,
            name=self.monitor.name,
        )
        assert detector is not None
        assert detector.owner_user_id == self.monitor.owner_user_id
        assert detector.owner_team_id == self.monitor.owner_team_id
        assert DataSourceDetector.objects.filter(
            data_source=data_source,
            detector=detector,
        ).exists()

    def test_idempotent_for_existing_data_source(self):
        ensure_cron_detector(self.monitor)
        data_source = DataSource.objects.get(
            type=DATA_SOURCE_CRON_MONITOR,
            organization_id=self.monitor.organization_id,
            source_id=str(self.monitor.id),
        )
        detector = Detector.objects.get(
            type=MonitorIncidentType.slug,
            project_id=self.monitor.project_id,
            name=self.monitor.name,
        )
        link = DataSourceDetector.objects.get(
            data_source=data_source,
            detector=detector,
        )
        ensure_cron_detector(self.monitor)
        data_source_after = DataSource.objects.get(
            type=DATA_SOURCE_CRON_MONITOR,
            organization_id=self.monitor.organization_id,
            source_id=str(self.monitor.id),
        )
        detector_after = Detector.objects.get(
            type=MonitorIncidentType.slug,
            project_id=self.monitor.project_id,
            name=self.monitor.name,
        )
        link_after = DataSourceDetector.objects.get(
            data_source=data_source,
            detector=detector,
        )
        assert data_source.id == data_source_after.id
        assert detector.id == detector_after.id
        assert link.id == link_after.id

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

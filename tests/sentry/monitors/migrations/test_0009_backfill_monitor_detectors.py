from typing import Any

from django.conf import settings

from sentry.monitors.utils import ensure_cron_detector, get_detector_for_monitor
from sentry.testutils.cases import TestMigrations
from sentry.utils import redis
from sentry.workflow_engine.models import DataSource, DataSourceDetector, Detector


def _get_cluster() -> Any:
    return redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)


class BackfillMonitorDetectorsTest(TestMigrations):
    migrate_from = "0008_fix_processing_error_keys"
    migrate_to = "0009_backfill_monitor_detectors"
    app = "monitors"
    connection = "secondary"

    def setup_initial_state(self):
        self.no_detector = self.create_monitor()
        self.has_detector = self.create_monitor()
        ensure_cron_detector(self.has_detector)
        assert get_detector_for_monitor(self.no_detector) is None
        self.existing_detector = get_detector_for_monitor(self.has_detector)
        assert self.existing_detector is not None

    def test(self):
        new_detector = get_detector_for_monitor(self.no_detector)
        assert new_detector is not None
        assert new_detector.id != self.existing_detector.id
        assert get_detector_for_monitor(self.has_detector).id == self.existing_detector.id
        assert DataSourceDetector.objects.all().count() == 2
        assert DataSource.objects.all().count() == 2
        assert Detector.objects.all().count() == 2

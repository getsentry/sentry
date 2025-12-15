from typing import Any

import pytest
from django.conf import settings

from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.monitors.utils import ensure_cron_detector, get_detector_for_monitor
from sentry.testutils.cases import TestMigrations
from sentry.utils import redis
from sentry.workflow_engine.models import DataSource, DataSourceDetector, Detector


def _get_cluster() -> Any:
    return redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)


@pytest.mark.skip(reason="Already run, fails when defaulting dual write in workflow engine")
class BackfillMonitorDetectorsTest(TestMigrations):
    migrate_from = "0008_fix_processing_error_keys"
    migrate_to = "0009_backfill_monitor_detectors"
    app = "monitors"
    connection = "secondary"

    def setup_initial_state(self) -> None:
        self.no_detector = self.create_monitor()
        self.has_detector = self.create_monitor()
        self.invalid_project = self.create_monitor(project=Project(id=40000000000))
        self.invalid_team = self.create_monitor(owner_team_id=4560090495334, owner_user_id=None)
        self.invalid_status = self.create_monitor(status=ObjectStatus.PENDING_DELETION)
        ensure_cron_detector(self.has_detector)
        assert get_detector_for_monitor(self.no_detector) is None
        assert get_detector_for_monitor(self.invalid_project) is None
        assert get_detector_for_monitor(self.invalid_status) is None
        self.existing_detector = get_detector_for_monitor(self.has_detector)

    def test(self) -> None:
        assert get_detector_for_monitor(self.invalid_project) is None
        assert get_detector_for_monitor(self.invalid_team) is None
        assert get_detector_for_monitor(self.invalid_status) is None
        new_detector = get_detector_for_monitor(self.no_detector)
        assert new_detector is not None
        assert self.existing_detector is not None
        assert new_detector.id != self.existing_detector.id
        new_existing_detector = get_detector_for_monitor(self.has_detector)
        assert (
            new_existing_detector is not None
            and new_existing_detector.id == self.existing_detector.id
        )
        assert DataSourceDetector.objects.all().count() == 2
        assert DataSource.objects.all().count() == 2
        assert Detector.objects.all().count() == 2

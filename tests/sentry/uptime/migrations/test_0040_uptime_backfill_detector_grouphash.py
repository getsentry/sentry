from hashlib import md5

import pytest

from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.testutils.cases import TestMigrations, UptimeTestCaseMixin
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.uptime.issue_platform import (
    build_detector_fingerprint_component,
    create_issue_platform_occurrence,
)
from sentry.uptime.types import DATA_SOURCE_UPTIME_SUBSCRIPTION, ProjectUptimeSubscriptionMode
from sentry.workflow_engine.models import DataSource, DataSourceDetector


@pytest.mark.skip(reason="Causes problems in pipeline")
class TestUptimeBackfillDetectorGrouphash(TestMigrations, UptimeTestCaseMixin):
    app = "uptime"
    migrate_from = "0039_uptime_drop_project_subscription_uptime_status_db"
    migrate_to = "0040_uptime_backfill_detector_grouphash"

    def setup_before_migration(self, apps):
        self.proj_sub_no_hash = self.create_project_uptime_subscription(project=self.project)
        self.proj_sub_one_hash = self.create_project_uptime_subscription(project=self.project)
        self.proj_sub_both_hash = self.create_project_uptime_subscription(project=self.project)

        DataSource.objects.all().delete()
        self.data_source_no_hash = self.create_data_source(
            type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
            source_id=str(self.proj_sub_no_hash.uptime_subscription_id),
        )
        self.detector_no_hash = self.create_detector(
            type=UptimeDomainCheckFailure.slug,
            config={"mode": ProjectUptimeSubscriptionMode.MANUAL, "environment": None},
            project=self.project,
        )
        DataSourceDetector.objects.create(
            data_source=self.data_source_no_hash, detector=self.detector_no_hash
        )

        self.data_source_one_hash = self.create_data_source(
            type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
            source_id=str(self.proj_sub_one_hash.uptime_subscription_id),
        )
        self.detector_one_hash = self.create_detector(
            type=UptimeDomainCheckFailure.slug,
            config={"mode": ProjectUptimeSubscriptionMode.MANUAL, "environment": None},
            project=self.project,
        )
        DataSourceDetector.objects.create(
            data_source=self.data_source_one_hash, detector=self.detector_one_hash
        )

        self.data_source_both_hash = self.create_data_source(
            type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
            source_id=str(self.proj_sub_both_hash.uptime_subscription_id),
        )
        self.detector_both_hash = self.create_detector(
            type=UptimeDomainCheckFailure.slug,
            config={"mode": ProjectUptimeSubscriptionMode.MANUAL, "environment": None},
            project=self.project,
        )
        DataSourceDetector.objects.create(
            data_source=self.data_source_both_hash, detector=self.detector_both_hash
        )

        with self.tasks(), self.feature(UptimeDomainCheckFailure.build_ingest_feature_name()):
            create_issue_platform_occurrence(self.create_uptime_result(), self.detector_both_hash)
            create_issue_platform_occurrence(self.create_uptime_result(), self.detector_one_hash)

        # Remove the hash for the detector
        self.group_one_hash = Group.objects.last()
        GroupHash.objects.filter(
            group=self.group_one_hash,
            hash=md5(
                build_detector_fingerprint_component(self.detector_one_hash).encode("utf-8")
            ).hexdigest(),
        ).delete()

    def test(self):
        assert GroupHash.objects.filter(
            group=self.group_one_hash,
            hash=md5(
                build_detector_fingerprint_component(self.detector_one_hash).encode("utf-8")
            ).hexdigest(),
        ).exists()
        assert not GroupHash.objects.filter(
            project=self.detector_no_hash.project,
            hash=md5(
                build_detector_fingerprint_component(self.detector_no_hash).encode("utf-8")
            ).hexdigest(),
        ).exists()
        both_group = GroupHash.objects.get(
            project=self.detector_both_hash.project,
            hash=md5(
                build_detector_fingerprint_component(self.detector_both_hash).encode("utf-8")
            ).hexdigest(),
        ).group
        assert GroupHash.objects.filter(group=both_group).count() == 2

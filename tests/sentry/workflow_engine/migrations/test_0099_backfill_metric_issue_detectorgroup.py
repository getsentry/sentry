from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.issues.ingest import save_issue_occurrence
from sentry.testutils.cases import TestMigrations
from sentry.testutils.helpers.datetime import before_now
from sentry.workflow_engine.models import Detector, DetectorGroup
from tests.sentry.issues.test_utils import OccurrenceTestMixin


class BackfillMetricIssueDetectorGroupTest(TestMigrations, OccurrenceTestMixin):
    migrate_from = "0098_detectorgroup_detector_set_null"
    migrate_to = "0099_backfill_metric_issue_detectorgroup"
    app = "workflow_engine"

    def setup_initial_state(self) -> None:
        self.detector = Detector.objects.create(
            project=self.project,
            name="Test Detector",
            type=MetricIssue.slug,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
        )

        occurrence_data = self.build_occurrence_data(
            event_id=self.event.event_id,
            project_id=self.project.id,
            fingerprint=[f"detector-{self.detector.id}"],
            evidence_data={"detector_id": self.detector.id},
            type=MetricIssue.type_id,
        )

        self.occurrence, group_info = save_issue_occurrence(occurrence_data, self.event)
        assert group_info is not None
        self.metric_issue = group_info.group

        deleted_detector = Detector.objects.create(
            project=self.project,
            name="Test Detector 2",
            type=MetricIssue.slug,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
        )
        event = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": before_now(seconds=1).isoformat(),
            },
            project_id=self.project.id,
        )
        occurrence_data = self.build_occurrence_data(
            event_id=event.event_id,
            project_id=self.project.id,
            fingerprint=[f"detector-{deleted_detector.id}"],
            evidence_data={"detector_id": deleted_detector.id},
            type=MetricIssue.type_id,
        )

        _, group_info = save_issue_occurrence(occurrence_data, event)
        assert group_info is not None
        self.metric_issue_deleted_detector = group_info.group
        deleted_detector.delete()

        self.metric_issue_no_occurrence = self.create_group(
            project=self.project, type=MetricIssue.type_id
        )

        self.metric_issue_existing_detectorgroup = self.create_group(
            project=self.project, type=MetricIssue.type_id
        )
        self.detector2 = Detector.objects.create(
            project=self.project,
            name="Test Detector 2",
            type=MetricIssue.slug,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
        )
        DetectorGroup.objects.all().delete()
        DetectorGroup.objects.create(
            group=self.metric_issue_existing_detectorgroup,
            detector=self.detector2,
        )

    def test_migration(self) -> None:
        assert DetectorGroup.objects.filter(
            group=self.metric_issue, detector=self.detector
        ).exists()

        assert DetectorGroup.objects.filter(
            group=self.metric_issue_deleted_detector, detector=None
        ).exists()

        assert DetectorGroup.objects.filter(
            group=self.metric_issue_no_occurrence,
            detector=None,
        ).exists()

        assert DetectorGroup.objects.filter(
            group=self.metric_issue_existing_detectorgroup, detector=self.detector2
        ).exists()

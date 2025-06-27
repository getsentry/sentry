from datetime import datetime, timedelta
from itertools import cycle
from unittest import mock

import pytest
from jsonschema import ValidationError
from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
    CHECKSTATUS_FAILURE,
    CHECKSTATUS_SUCCESS,
    CheckResult,
    CheckStatus,
)

from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.testutils.cases import TestCase, UptimeTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.uptime.grouptype import (
    UptimeDetectorHandler,
    UptimeDomainCheckFailure,
    UptimePacketValue,
    build_detector_fingerprint_component,
    build_event_data,
    build_evidence_display,
    build_fingerprint,
)
from sentry.uptime.models import UptimeStatus, UptimeSubscription, get_detector
from sentry.uptime.types import UptimeMonitorMode
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.types import DetectorPriorityLevel


class BuildDetectorFingerprintComponentTest(UptimeTestCase):
    def test_build_detector_fingerprint_component(self):
        project_subscription = self.create_project_uptime_subscription()
        detector = get_detector(project_subscription.uptime_subscription)
        assert detector

        fingerprint_component = build_detector_fingerprint_component(detector)
        assert fingerprint_component == f"uptime-detector:{detector.id}"


class BuildFingerprintForProjectSubscriptionTest(UptimeTestCase):
    def test_build_fingerprint_for_project_subscription(self):
        project_subscription = self.create_project_uptime_subscription()
        detector = get_detector(project_subscription.uptime_subscription)
        assert detector

        fingerprint = build_fingerprint(detector)
        expected_fingerprint = [build_detector_fingerprint_component(detector)]
        assert fingerprint == expected_fingerprint


class BuildEvidenceDisplayTest(UptimeTestCase):
    def test_build_evidence_display(self):
        result = self.create_uptime_result()
        assert build_evidence_display(result) == [
            IssueEvidence(name="Failure reason", value="timeout - it timed out", important=True),
            IssueEvidence(name="Duration", value="100ms", important=False),
            IssueEvidence(name="Method", value="HEAD", important=False),
            IssueEvidence(name="Status Code", value="500", important=False),
        ]


@freeze_time()
class BuildEventDataTest(UptimeTestCase):
    def test_build_event_data(self):
        result = self.create_uptime_result()
        project_subscription = self.create_project_uptime_subscription()
        detector = get_detector(project_subscription.uptime_subscription)
        assert detector

        assert build_event_data(result, detector) == {
            "environment": "development",
            "platform": "other",
            "project_id": detector.project_id,
            "received": datetime.now().replace(microsecond=0),
            "sdk": None,
            "tags": {"uptime_rule": str(project_subscription.id)},
            "contexts": {
                "trace": {"trace_id": result["trace_id"], "span_id": result.get("span_id")}
            },
        }


class TestUptimeHandler(UptimeTestCase):
    def handle_result(self, detector: Detector, sub: UptimeSubscription, check_result: CheckResult):
        handler = UptimeDetectorHandler(detector)

        value = UptimePacketValue(
            check_result=check_result,
            subscription=sub,
            metric_tags={},
        )
        data_packet = DataPacket[UptimePacketValue](
            source_id=str(sub.id),
            packet=value,
        )
        evaluation = handler.evaluate(data_packet)

        if None not in evaluation:
            return None

        return evaluation[None]

    def test_simple_evaluate(self):
        project_subscription = self.create_project_uptime_subscription()
        uptime_subscription = project_subscription.uptime_subscription
        detector = get_detector(project_subscription.uptime_subscription)
        assert detector

        assert uptime_subscription.uptime_status == UptimeStatus.OK

        now = datetime.now()

        features = [
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-create-issues",
        ]

        with (
            self.feature(features),
            mock.patch("sentry.uptime.grouptype.get_active_failure_threshold", return_value=2),
        ):
            evaluation = self.handle_result(
                detector,
                uptime_subscription,
                self.create_uptime_result(scheduled_check_time=now - timedelta(minutes=5)),
            )
            assert evaluation is None

            # Second evaluation produces a DetectorEvaluationResult
            evaluation = self.handle_result(
                detector,
                uptime_subscription,
                self.create_uptime_result(scheduled_check_time=now - timedelta(minutes=4)),
            )
            assert evaluation is not None
            assert evaluation.priority == DetectorPriorityLevel.HIGH
            assert isinstance(evaluation.result, IssueOccurrence)
            assert (
                evaluation.result.issue_title == f"Downtime detected for {uptime_subscription.url}"
            )

            # Fingerprint includes the existing uptime fingerprints, without
            # this we would create new issues instead of reusing the existing
            # issues.
            fingerprint = set(build_fingerprint(detector))
            assert fingerprint & set(evaluation.result.fingerprint) == fingerprint

            # Update the uptime_status. In the future this will be removed and
            # we'll just use the DetectorState models to represent this
            assert uptime_subscription.uptime_status == UptimeStatus.FAILED

    def test_issue_creation_disabled(self):
        project_subscription = self.create_project_uptime_subscription()
        uptime_subscription = project_subscription.uptime_subscription
        detector = get_detector(project_subscription.uptime_subscription)
        assert detector

        assert uptime_subscription.uptime_status == UptimeStatus.OK

        with (
            # Only uptime-create-issues enabled, will not create issues because
            # uptime-detector-create-issues is not enabled
            self.feature(["organizations:uptime-create-issues"]),
            mock.patch("sentry.uptime.grouptype.get_active_failure_threshold", return_value=1),
            mock.patch("sentry.uptime.grouptype.logger") as logger,
        ):
            check_result = self.create_uptime_result()
            evaluation = self.handle_result(detector, uptime_subscription, check_result)
            assert evaluation is None

            # Produces a log that we can use to validate that it _would_ create
            # an issue.
            logger.info.assert_called_with(
                "uptime.detector.will_create_issue",
                extra={
                    "project_id": detector.project_id,
                    "url": uptime_subscription.url,
                    **check_result,
                },
            )

            # the uptime_status does NOT change even though we did a full
            # evaluation. This should only be updated when detectors are also
            # creating issues
            assert uptime_subscription.uptime_status == UptimeStatus.OK

        with (
            # Only uptime-detector-create-issues enabled, will not create
            # issues because uptime-create-issues is not enabled
            self.feature(["organizations:uptime-detector-create-issues"]),
            mock.patch("sentry.uptime.grouptype.get_active_failure_threshold", return_value=1),
        ):
            evaluation = self.handle_result(
                detector,
                uptime_subscription,
                self.create_uptime_result(),
            )
            assert evaluation is None

        features = [
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-create-issues",
        ]
        options = {
            "uptime.restrict-issue-creation-by-hosting-provider-id": [
                uptime_subscription.host_provider_id
            ]
        }

        with (
            # All features enabled, but the host provider is disabled
            self.feature(features),
            self.options(options),
            mock.patch("sentry.uptime.grouptype.get_active_failure_threshold", return_value=1),
        ):
            evaluation = self.handle_result(
                detector,
                uptime_subscription,
                self.create_uptime_result(),
            )
            assert evaluation is None

    def test_flapping_evaluate(self):
        """
        Test that a uptime monitor that flaps between failure, success success,
        failure, etc does not produce any evaluations.
        """
        project_subscription = self.create_project_uptime_subscription()
        uptime_subscription = project_subscription.uptime_subscription
        detector = get_detector(project_subscription.uptime_subscription)
        assert detector

        assert uptime_subscription.uptime_status == UptimeStatus.OK

        now = datetime.now()

        features = [
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-create-issues",
        ]

        with (
            self.feature(features),
            mock.patch("sentry.uptime.grouptype.get_active_failure_threshold", return_value=3),
        ):
            status_cycle: cycle[CheckStatus] = cycle(
                [CHECKSTATUS_FAILURE, CHECKSTATUS_SUCCESS, CHECKSTATUS_SUCCESS]
            )

            for idx in range(12, 0, -1):
                result = self.create_uptime_result(
                    status=next(status_cycle),
                    scheduled_check_time=now - timedelta(minutes=idx),
                )
                evaluation = self.handle_result(detector, uptime_subscription, result)
                assert evaluation is None


class TestUptimeDomainCheckFailureDetectorConfig(TestCase):
    def setUp(self):
        super().setUp()
        self.uptime_monitor = self.create_project_uptime_subscription()

    def test_detector_correct_schema(self):
        self.create_detector(
            name=self.uptime_monitor.name,
            project_id=self.project.id,
            type=UptimeDomainCheckFailure.slug,
            config={
                "mode": UptimeMonitorMode.MANUAL,
                "environment": "hi",
            },
        )

    def test_incorrect_config(self):
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config=["some", "stuff"],
            )

    def test_mismatched_schema(self):
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config={
                    "mode": "hi",
                    "environment": "hi",
                },
            )
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config={
                    "mode": UptimeMonitorMode.MANUAL,
                    "environment": 1,
                },
            )

        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config={
                    "mode": 0,
                    "environment": "hi",
                },
            )
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config={
                    "bad_mode": UptimeMonitorMode.MANUAL,
                    "environment": "hi",
                },
            )
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config={
                    "mode": UptimeMonitorMode.MANUAL,
                    "environment": "hi",
                    "junk": "hi",
                },
            )

    def test_missing_required(self):
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config={},
            )

        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
            )

        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config={
                    "mode": UptimeMonitorMode.MANUAL,
                },
            )

        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config={"environment": "hi"},
            )

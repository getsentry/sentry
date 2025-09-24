import uuid
from datetime import datetime, timedelta, timezone
from hashlib import md5
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
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.group import Group, GroupStatus
from sentry.testutils.cases import TestCase, UptimeTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.uptime.grouptype import (
    UptimeDetectorHandler,
    UptimeDomainCheckFailure,
    UptimePacketValue,
    build_event_data,
    build_evidence_display,
)
from sentry.uptime.models import UptimeStatus, UptimeSubscription, get_uptime_subscription
from sentry.uptime.subscriptions.subscriptions import (
    build_detector_fingerprint_component,
    build_fingerprint,
    resolve_uptime_issue,
)
from sentry.uptime.types import UptimeMonitorMode
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.types import DetectorEvaluationResult, DetectorPriorityLevel


class ResolveUptimeIssueTest(UptimeTestCase):
    def test(self) -> None:
        subscription = self.create_uptime_subscription(subscription_id=uuid.uuid4().hex)
        detector = self.create_uptime_detector(uptime_subscription=subscription)
        result = self.create_uptime_result(subscription.subscription_id)

        fingerprint = build_detector_fingerprint_component(detector)

        with self.feature(UptimeDomainCheckFailure.build_ingest_feature_name()):
            occurrence = IssueOccurrence(
                id=uuid.uuid4().hex,
                resource_id=None,
                project_id=detector.project_id,
                event_id=uuid.uuid4().hex,
                fingerprint=[fingerprint],
                type=UptimeDomainCheckFailure,
                issue_title=f"Downtime detected for {subscription.url}",
                subtitle="Your monitored domain is down",
                evidence_display=[],
                evidence_data={},
                culprit="",
                detection_time=datetime.now(timezone.utc),
                level="error",
                assignee=detector.owner,
            )
            produce_occurrence_to_kafka(
                payload_type=PayloadType.OCCURRENCE,
                occurrence=occurrence,
                event_data={
                    **build_event_data(result, detector),
                    "event_id": occurrence.event_id,
                    "fingerprint": occurrence.fingerprint,
                    "timestamp": occurrence.detection_time.isoformat(),
                },
            )

        hashed_detector_fingerprint = md5(fingerprint.encode("utf-8")).hexdigest()
        group_detector = Group.objects.get(grouphash__hash=hashed_detector_fingerprint)
        assert group_detector.status == GroupStatus.UNRESOLVED

        resolve_uptime_issue(detector)
        group_detector.refresh_from_db()
        assert group_detector.status == GroupStatus.RESOLVED


class BuildDetectorFingerprintComponentTest(UptimeTestCase):
    def test_build_detector_fingerprint_component(self) -> None:
        detector = self.create_uptime_detector()

        fingerprint_component = build_detector_fingerprint_component(detector)
        assert fingerprint_component == f"uptime-detector:{detector.id}"


class BuildFingerprintTest(UptimeTestCase):
    def test_build_fingerprint(self) -> None:
        detector = self.create_uptime_detector()

        fingerprint = build_fingerprint(detector)
        expected_fingerprint = [build_detector_fingerprint_component(detector)]
        assert fingerprint == expected_fingerprint


class BuildEvidenceDisplayTest(UptimeTestCase):
    def test_build_evidence_display(self) -> None:
        result = self.create_uptime_result()
        assert build_evidence_display(result) == [
            IssueEvidence(name="Failure reason", value="timeout - it timed out", important=True),
            IssueEvidence(name="Duration", value="100ms", important=False),
            IssueEvidence(name="Method", value="HEAD", important=False),
            IssueEvidence(name="Status Code", value="500", important=False),
        ]


@freeze_time()
class BuildEventDataTest(UptimeTestCase):
    def test_build_event_data(self) -> None:
        result = self.create_uptime_result()
        detector = self.create_uptime_detector()

        assert build_event_data(result, detector) == {
            "environment": "development",
            "platform": "other",
            "project_id": detector.project_id,
            "received": datetime.now().replace(microsecond=0),
            "sdk": None,
            "contexts": {
                "trace": {"trace_id": result["trace_id"], "span_id": result.get("span_id")}
            },
        }


class TestUptimeHandler(UptimeTestCase):
    def handle_result(
        self, detector: Detector, sub: UptimeSubscription, check_result: CheckResult
    ) -> DetectorEvaluationResult | None:
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

    def test_simple_evaluate(self) -> None:
        detector = self.create_uptime_detector(downtime_threshold=2, recovery_threshold=1)
        uptime_subscription = get_uptime_subscription(detector)

        assert uptime_subscription.uptime_status == UptimeStatus.OK

        now = datetime.now()

        with self.feature("organizations:uptime-create-issues"):
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

    def test_issue_creation_disabled(self) -> None:
        detector = self.create_uptime_detector(downtime_threshold=1, recovery_threshold=1)
        uptime_subscription = get_uptime_subscription(detector)

        assert uptime_subscription.uptime_status == UptimeStatus.OK

        with (
            # uptime-create-issues flag not enabled. No issue created
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

            # uptime_status is updated even when issue creation is disabled.
            # This keeps the uptime_status in sync with DetectorState (until we
            # remove it)
            assert uptime_subscription.uptime_status == UptimeStatus.FAILED

        options = {
            "uptime.restrict-issue-creation-by-hosting-provider-id": [
                uptime_subscription.host_provider_id
            ]
        }

        with (
            # All features enabled, but the host provider is disabled
            self.feature(["organizations:uptime-create-issues"]),
            self.options(options),
        ):
            evaluation = self.handle_result(
                detector,
                uptime_subscription,
                self.create_uptime_result(),
            )
            assert evaluation is None

    def test_flapping_evaluate(self) -> None:
        """
        Test that a uptime monitor that flaps between failure, success success,
        failure, etc does not produce any evaluations.
        """
        detector = self.create_uptime_detector(downtime_threshold=3, recovery_threshold=1)
        uptime_subscription = get_uptime_subscription(detector)

        assert uptime_subscription.uptime_status == UptimeStatus.OK

        now = datetime.now()

        with self.feature(["organizations:uptime-create-issues"]):
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
    def setUp(self) -> None:
        super().setUp()
        self.uptime_monitor = self.create_uptime_detector()

    def test_detector_correct_schema(self) -> None:
        self.create_detector(
            name=self.uptime_monitor.name,
            project_id=self.project.id,
            type=UptimeDomainCheckFailure.slug,
            config={
                "mode": UptimeMonitorMode.MANUAL,
                "environment": "hi",
                "recovery_threshold": 1,
                "downtime_threshold": 3,
            },
        )

    def test_incorrect_config(self) -> None:
        with pytest.raises(ValidationError):
            self.create_detector(
                name=self.uptime_monitor.name,
                project_id=self.project.id,
                type=UptimeDomainCheckFailure.slug,
                config=["some", "stuff"],
            )

    def test_mismatched_schema(self) -> None:
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

    def test_missing_required(self) -> None:
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

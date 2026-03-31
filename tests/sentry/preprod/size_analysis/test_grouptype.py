from __future__ import annotations

from typing import Any
from unittest import mock

import pytest

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.size_analysis.grouptype import (
    PreprodSizeAnalysisDetectorHandler,
    PreprodSizeAnalysisDetectorValidator,
    PreprodSizeAnalysisGroupType,
    SizeAnalysisDataPacket,
    SizeAnalysisValue,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.detector import process_detectors
from sentry.workflow_engine.types import DetectorPriorityLevel


@cell_silo_test
class PreprodSizeAnalysisDetectorValidatorTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.context = {
            "organization": self.project.organization,
            "project": self.project,
            "request": self.make_request(),
        }

    def test_create_detector(self) -> None:
        condition_group = self.create_data_condition_group(organization=self.project.organization)
        data = {
            "name": "Test Detector",
            "type": PreprodSizeAnalysisGroupType.slug,
            "conditionGroup": {
                "logicType": condition_group.logic_type,
                "conditions": [
                    {
                        "type": Condition.GREATER,
                        "comparison": 100,
                        "conditionResult": DetectorPriorityLevel.HIGH,
                    },
                ],
            },
            "config": {
                "threshold_type": "absolute",
                "measurement": "install_size",
            },
        }
        detector = PreprodSizeAnalysisDetectorValidator(data=data, context=self.context)
        assert detector.is_valid(), detector.errors
        detector.save()


@cell_silo_test
class PreprodSizeAnalysisDetectorHandlerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=self.condition_group,
            type=Condition.GREATER,
            comparison=1000000,
            condition_result=DetectorPriorityLevel.HIGH,
        )

    def test_evaluate_creates_occurrence_when_condition_met(self) -> None:
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute", "measurement": "install_size"},
            workflow_condition_group=self.condition_group,
        )

        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert None in evaluation_result
        result = evaluation_result[None]
        assert result.priority == DetectorPriorityLevel.HIGH
        assert result.result is not None

    def test_evaluate_no_occurrence_when_condition_not_met(self) -> None:
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute", "measurement": "install_size"},
            workflow_condition_group=self.condition_group,
        )

        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 500,
                "head_download_size_bytes": 200,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert evaluation_result == {}

    def test_evaluate_returns_highest_matched_priority(self) -> None:
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=500000,
            condition_result=DetectorPriorityLevel.MEDIUM,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=1000000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        # Value exceeds both thresholds — should return HIGH (the max)
        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert None in evaluation_result
        assert evaluation_result[None].priority == DetectorPriorityLevel.HIGH

    def test_evaluate_returns_medium_when_only_medium_condition_met(self) -> None:
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=500000,
            condition_result=DetectorPriorityLevel.MEDIUM,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=10000000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        # Value exceeds MEDIUM threshold but not HIGH
        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 750000,
                "head_download_size_bytes": 200,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert None in evaluation_result
        assert evaluation_result[None].priority == DetectorPriorityLevel.MEDIUM

    def test_evaluate_no_occurrence_when_no_condition_group(self) -> None:
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute", "measurement": "install_size"},
        )

        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert evaluation_result == {}

    def test_evaluate_absolute_diff(self) -> None:
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute_diff", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        # head - base = 5000000 - 4000000 = 1000000 > 100000
        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
                "base_install_size_bytes": 4000000,
                "base_download_size_bytes": 1800000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert None in evaluation_result
        assert evaluation_result[None].priority == DetectorPriorityLevel.HIGH

    def test_evaluate_absolute_diff_no_trigger_when_below_threshold(self) -> None:
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute_diff", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        # head - base = 5000000 - 4950000 = 50000 < 100000
        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
                "base_install_size_bytes": 4950000,
                "base_download_size_bytes": 1800000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert evaluation_result == {}

    def test_evaluate_relative_diff(self) -> None:
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        # Trigger when relative diff > 10 (10%)
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=10,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "relative_diff", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        # (5000000 - 4000000) / 4000000 = 25% > 10%
        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
                "base_install_size_bytes": 4000000,
                "base_download_size_bytes": 1800000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert None in evaluation_result
        assert evaluation_result[None].priority == DetectorPriorityLevel.HIGH

    def test_evaluate_relative_diff_no_trigger_when_below_threshold(self) -> None:
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        # Trigger when relative diff > 10 (10%)
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=10,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "relative_diff", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        # (5000000 - 4900000) / 4900000 ≈ 2.04% < 10%
        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
                "base_install_size_bytes": 4900000,
                "base_download_size_bytes": 1800000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        evaluation_result = handler.evaluate(data_packet)

        assert evaluation_result == {}

    def test_evaluate_diff_raises_when_base_missing(self) -> None:
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute_diff", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        with pytest.raises(ValueError, match="Missing base value"):
            handler.evaluate(data_packet)


@cell_silo_test
class PreprodSizeAnalysisDetectorQueryFilterTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=self.condition_group,
            type=Condition.GREATER,
            comparison=1000000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        self.head_artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )
        self.head_artifact = PreprodArtifact.objects.select_related("mobile_app_info").get(
            id=self.head_artifact.id
        )
        self.base_artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )
        self.base_artifact = PreprodArtifact.objects.select_related("mobile_app_info").get(
            id=self.base_artifact.id
        )

    def _make_data_packet(self) -> SizeAnalysisDataPacket:
        return DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
                "metadata": {
                    "platform": "android",
                    "head_metric_id": 100,
                    "base_metric_id": 200,
                    "head_artifact_id": self.head_artifact.id,
                    "base_artifact_id": self.base_artifact.id,
                    "head_artifact": self.head_artifact,
                    "base_artifact": self.base_artifact,
                },
            },
        )

    def test_no_query_evaluates_normally(self) -> None:
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute", "measurement": "install_size"},
            workflow_condition_group=self.condition_group,
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        result = handler.evaluate(self._make_data_packet())

        assert None in result
        assert result[None].priority == DetectorPriorityLevel.HIGH

    def test_empty_query_evaluates_normally(self) -> None:
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute", "measurement": "install_size", "query": ""},
            workflow_condition_group=self.condition_group,
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        result = handler.evaluate(self._make_data_packet())

        assert None in result
        assert result[None].priority == DetectorPriorityLevel.HIGH

    def test_whitespace_query_evaluates_normally(self) -> None:
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute", "measurement": "install_size", "query": "   "},
            workflow_condition_group=self.condition_group,
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        result = handler.evaluate(self._make_data_packet())

        assert None in result
        assert result[None].priority == DetectorPriorityLevel.HIGH

    def test_matching_query_evaluates_normally(self) -> None:
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={
                "threshold_type": "absolute",
                "measurement": "install_size",
                "query": "app_id:com.example.app",
            },
            workflow_condition_group=self.condition_group,
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        result = handler.evaluate(self._make_data_packet())

        assert None in result
        assert result[None].priority == DetectorPriorityLevel.HIGH

    def test_non_matching_query_skips_evaluation(self) -> None:
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={
                "threshold_type": "absolute",
                "measurement": "install_size",
                "query": "app_id:com.other.app",
            },
            workflow_condition_group=self.condition_group,
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        result = handler.evaluate(self._make_data_packet())

        assert result == {}

    def test_invalid_query_skips_evaluation_and_logs_exception(self) -> None:
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={
                "threshold_type": "absolute",
                "measurement": "install_size",
                "query": "foo OR bar",
            },
            workflow_condition_group=self.condition_group,
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)

        with mock.patch("sentry.preprod.size_analysis.grouptype.logger") as mock_logger:
            result = handler.evaluate(self._make_data_packet())

        assert result == {}
        mock_logger.exception.assert_called_once_with(
            "preprod.size_analysis.invalid_detector_query",
            extra={"detector_id": detector.id, "query": "foo OR bar"},
        )

    def test_no_metadata_with_query_raises_error(self) -> None:
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={
                "threshold_type": "absolute",
                "measurement": "install_size",
                "query": "app_id:com.example.app",
            },
            workflow_condition_group=self.condition_group,
        )
        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        with pytest.raises(ValueError, match="missing metadata required to evaluate query filter"):
            handler.evaluate(data_packet)


@cell_silo_test
class PreprodSizeAnalysisDetectorHandlerIntegrationTest(TestCase):
    def test_e2e(self) -> None:
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=1000000,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )

        packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 2000000,
            },
        )

        with mock.patch(
            "sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka"
        ) as mock_produce_occurrence_to_kafka:
            process_detectors(packet, [detector])

        assert mock_produce_occurrence_to_kafka.call_count == 1


@cell_silo_test
class PreprodSizeAnalysisOccurrenceContentTest(TestCase):
    """Tests for the content of created occurrences (title, platform, tags, evidence)."""

    def setUp(self) -> None:
        super().setUp()
        self.condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=self.condition_group,
            type=Condition.GREATER,
            comparison=1000000,
            condition_result=DetectorPriorityLevel.HIGH,
        )

    def _evaluate_with_metadata(self, measurement, metadata):
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute", "measurement": measurement},
            workflow_condition_group=self.condition_group,
        )
        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test-source",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 5000000,
                "metadata": metadata,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        return handler.evaluate(data_packet)

    def test_create_occurrence_install_size_with_metadata(self) -> None:
        commit_comparison = self.create_commit_comparison(
            organization=self.project.organization,
            head_sha="a" * 40,
            base_sha="b" * 40,
            head_ref="feature/test-branch",
            base_ref="main",
            head_repo_name="owner/repo",
            pr_number=42,
        )
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            commit_comparison=commit_comparison,
        )
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )
        head_artifact = PreprodArtifact.objects.select_related(
            "mobile_app_info", "commit_comparison"
        ).get(id=head_artifact.id)
        base_artifact = PreprodArtifact.objects.select_related(
            "mobile_app_info", "commit_comparison"
        ).get(id=base_artifact.id)
        metadata = {
            "platform": "android",
            "head_metric_id": 100,
            "base_metric_id": 200,
            "head_artifact_id": head_artifact.id,
            "base_artifact_id": base_artifact.id,
            "head_artifact": head_artifact,
            "base_artifact": base_artifact,
        }
        result = self._evaluate_with_metadata("install_size", metadata)

        assert None in result
        occurrence = result[None].result
        event_data = result[None].event_data
        assert isinstance(occurrence, IssueOccurrence)
        assert event_data is not None

        assert occurrence.issue_title == "Install size regression"
        assert event_data["platform"] == "android"
        assert event_data["tags"]["regression_kind"] == "install"
        assert event_data["tags"]["head.app_id"] == "com.example.app"
        assert event_data["tags"]["base.app_id"] == "com.example.app"
        assert event_data["tags"]["head.artifact_type"] == "apk"
        assert event_data["tags"]["head.artifact_id"] == str(head_artifact.id)
        assert event_data["tags"]["base.artifact_id"] == str(base_artifact.id)
        assert event_data["tags"]["git.sha"] == "a" * 40
        assert event_data["tags"]["git.branch"] == "feature/test-branch"
        assert event_data["tags"]["git.repo"] == "owner/repo"
        assert event_data["tags"]["git.base_sha"] == "b" * 40
        assert event_data["tags"]["git.base_branch"] == "main"
        assert event_data["tags"]["git.pr_number"] == "42"
        assert occurrence.evidence_data["head_artifact_id"] == head_artifact.id
        assert occurrence.evidence_data["base_artifact_id"] == base_artifact.id
        assert occurrence.evidence_data["head_size_metric_id"] == 100
        assert occurrence.evidence_data["base_size_metric_id"] == 200
        assert occurrence.evidence_data["value"] == 5000000
        assert len(occurrence.evidence_data["conditions"]) == 1
        assert occurrence.evidence_data["conditions"][0]["type"] == "gt"
        assert occurrence.evidence_data["conditions"][0]["comparison"] == 1000000
        assert occurrence.evidence_data["config"] == {
            "threshold_type": "absolute",
            "measurement": "install_size",
        }

    def test_create_occurrence_download_size_with_metadata(self) -> None:
        commit_comparison = self.create_commit_comparison(
            organization=self.project.organization,
            head_sha="c" * 40,
            head_ref="feature/download-test",
            head_repo_name="owner/repo",
        )
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            app_name="MyApp",
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=commit_comparison,
        )
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
        )
        head_artifact = PreprodArtifact.objects.select_related(
            "mobile_app_info", "commit_comparison"
        ).get(id=head_artifact.id)
        base_artifact = PreprodArtifact.objects.select_related(
            "mobile_app_info", "commit_comparison"
        ).get(id=base_artifact.id)
        metadata = {
            "platform": "apple",
            "head_metric_id": 101,
            "base_metric_id": 201,
            "head_artifact_id": head_artifact.id,
            "base_artifact_id": base_artifact.id,
            "head_artifact": head_artifact,
            "base_artifact": base_artifact,
        }
        result = self._evaluate_with_metadata("download_size", metadata)

        assert None in result
        occurrence = result[None].result
        event_data = result[None].event_data
        assert isinstance(occurrence, IssueOccurrence)
        assert event_data is not None

        assert occurrence.issue_title == "Download size regression"
        assert event_data["platform"] == "apple"
        assert event_data["tags"]["regression_kind"] == "download"
        assert event_data["tags"]["head.app_name"] == "MyApp"
        assert event_data["tags"]["head.artifact_id"] == str(head_artifact.id)
        assert event_data["tags"]["git.sha"] == "c" * 40
        assert event_data["tags"]["git.branch"] == "feature/download-test"
        assert event_data["tags"]["git.repo"] == "owner/repo"
        assert occurrence.evidence_data["head_artifact_id"] == head_artifact.id

    def test_create_occurrence_with_metadata_no_commit_comparison(self) -> None:
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )
        head_artifact = PreprodArtifact.objects.select_related(
            "mobile_app_info", "commit_comparison"
        ).get(id=head_artifact.id)
        base_artifact = PreprodArtifact.objects.select_related(
            "mobile_app_info", "commit_comparison"
        ).get(id=base_artifact.id)
        metadata = {
            "platform": "android",
            "head_metric_id": 100,
            "base_metric_id": 200,
            "head_artifact_id": head_artifact.id,
            "base_artifact_id": base_artifact.id,
            "head_artifact": head_artifact,
            "base_artifact": base_artifact,
        }
        result = self._evaluate_with_metadata("install_size", metadata)

        assert None in result
        event_data = result[None].event_data
        assert event_data is not None

        assert event_data["tags"]["head.artifact_id"] == str(head_artifact.id)
        assert event_data["tags"]["base.artifact_id"] == str(base_artifact.id)
        assert "git.sha" not in event_data["tags"]
        assert "git.branch" not in event_data["tags"]
        assert "git.repo" not in event_data["tags"]

    def test_create_occurrence_without_metadata(self) -> None:
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "absolute", "measurement": "install_size"},
            workflow_condition_group=self.condition_group,
        )
        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test-source",
            packet={
                "head_install_size_bytes": 5000000,
                "head_download_size_bytes": 5000000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        result = handler.evaluate(data_packet)

        assert None in result
        occurrence = result[None].result
        event_data = result[None].event_data
        assert isinstance(occurrence, IssueOccurrence)
        assert event_data is not None

        assert occurrence.issue_title == "Install size regression"
        assert event_data["platform"] == "unknown"
        assert event_data["tags"] == {}
        assert occurrence.evidence_data["detector_id"] == detector.id
        assert occurrence.evidence_data["value"] == 5000000
        assert len(occurrence.evidence_data["conditions"]) == 1
        assert occurrence.evidence_data["conditions"][0]["type"] == "gt"
        assert occurrence.evidence_data["conditions"][0]["comparison"] == 1000000
        assert occurrence.evidence_data["config"] == {
            "threshold_type": "absolute",
            "measurement": "install_size",
        }

    def test_create_occurrence_relative_diff_value(self) -> None:
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=10,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": "relative_diff", "measurement": "install_size"},
            workflow_condition_group=condition_group,
        )
        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test-source",
            packet={
                "head_install_size_bytes": 1500000,
                "head_download_size_bytes": 1500000,
                "base_install_size_bytes": 1000000,
                "base_download_size_bytes": 1000000,
            },
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        result = handler.evaluate(data_packet)

        assert None in result
        occurrence = result[None].result
        assert isinstance(occurrence, IssueOccurrence)

        # relative_diff: ((1500000 - 1000000) / 1000000) * 100 = 50.0
        assert occurrence.evidence_data["value"] == 50.0
        assert occurrence.evidence_data["config"]["threshold_type"] == "relative_diff"
        assert occurrence.evidence_data["conditions"][0]["comparison"] == 10


@cell_silo_test
class PreprodSizeAnalysisEvidenceTextTest(TestCase):
    """Tests for the evidence display text formatting in Slack/Jira notifications."""

    def setUp(self) -> None:
        super().setUp()
        self.condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )

    def _create_condition(self, condition_type, comparison):
        self.create_data_condition(
            condition_group=self.condition_group,
            type=condition_type,
            comparison=comparison,
            condition_result=DetectorPriorityLevel.HIGH,
        )

    def _evaluate(
        self,
        threshold_type,
        measurement,
        head_install,
        head_download,
        metadata=None,
        base_install=None,
        base_download=None,
    ):
        detector = self.create_detector(
            name="test-detector",
            type=PreprodSizeAnalysisGroupType.slug,
            project=self.project,
            config={"threshold_type": threshold_type, "measurement": measurement},
            workflow_condition_group=self.condition_group,
        )
        packet_data: SizeAnalysisValue = {
            "head_install_size_bytes": head_install,
            "head_download_size_bytes": head_download,
        }
        if base_install is not None:
            packet_data["base_install_size_bytes"] = base_install
        if base_download is not None:
            packet_data["base_download_size_bytes"] = base_download
        if metadata is not None:
            packet_data["metadata"] = metadata

        data_packet: SizeAnalysisDataPacket = DataPacket(
            source_id="test-source",
            packet=packet_data,
        )
        handler = PreprodSizeAnalysisDetectorHandler(detector)
        result = handler.evaluate(data_packet)
        assert None in result
        occurrence = result[None].result
        assert isinstance(occurrence, IssueOccurrence)
        return occurrence

    def test_evidence_absolute_install_size(self) -> None:
        self._create_condition(Condition.GREATER, 1000000)
        occurrence = self._evaluate(
            "absolute",
            "install_size",
            head_install=5000000,
            head_download=3000000,
        )
        evidence = occurrence.evidence_display[0]
        assert evidence.name == "Size Analysis"
        assert evidence.important is True
        assert evidence.value == "Install Size, Absolute Size > 1.0 MB (5.0 MB)"

    def test_evidence_absolute_diff_install_size(self) -> None:
        self._create_condition(Condition.GREATER_OR_EQUAL, 500000)
        occurrence = self._evaluate(
            "absolute_diff",
            "install_size",
            head_install=5000000,
            head_download=3000000,
            base_install=4000000,
            base_download=2500000,
        )
        evidence = occurrence.evidence_display[0]
        assert evidence.value == "Install Size, Absolute Diff > 500.0 KB (+1.0 MB)"

    def test_evidence_relative_diff_download_size(self) -> None:
        self._create_condition(Condition.GREATER_OR_EQUAL, 5)
        occurrence = self._evaluate(
            "relative_diff",
            "download_size",
            head_install=5000000,
            head_download=3000000,
            base_install=4000000,
            base_download=2500000,
        )
        evidence = occurrence.evidence_display[0]
        assert evidence.value == "Download Size, Relative Diff > 5% (+20.0%)"

    def _make_metadata(self, platform: str, artifact_type: int) -> dict[str, Any]:
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=artifact_type,
        )
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            app_id="com.example.app",
            artifact_type=artifact_type,
        )
        head_artifact = PreprodArtifact.objects.select_related(
            "mobile_app_info", "commit_comparison"
        ).get(id=head_artifact.id)
        base_artifact = PreprodArtifact.objects.select_related(
            "mobile_app_info", "commit_comparison"
        ).get(id=base_artifact.id)
        return {
            "platform": platform,
            "head_metric_id": 1,
            "base_metric_id": 2,
            "head_artifact_id": head_artifact.id,
            "base_artifact_id": base_artifact.id,
            "head_artifact": head_artifact,
            "base_artifact": base_artifact,
        }

    def test_evidence_android_shows_uncompressed_size(self) -> None:
        self._create_condition(Condition.GREATER, 1000000)
        metadata = self._make_metadata("android", PreprodArtifact.ArtifactType.APK)
        occurrence = self._evaluate(
            "absolute",
            "install_size",
            head_install=5000000,
            head_download=3000000,
            metadata=metadata,
        )
        evidence = occurrence.evidence_display[0]
        assert evidence.value == "Uncompressed Size, Absolute Size > 1.0 MB (5.0 MB)"

    def test_evidence_apple_shows_install_size(self) -> None:
        self._create_condition(Condition.GREATER, 1000000)
        metadata = self._make_metadata("apple", PreprodArtifact.ArtifactType.XCARCHIVE)
        occurrence = self._evaluate(
            "absolute",
            "install_size",
            head_install=5000000,
            head_download=3000000,
            metadata=metadata,
        )
        evidence = occurrence.evidence_display[0]
        assert evidence.value == "Install Size, Absolute Size > 1.0 MB (5.0 MB)"

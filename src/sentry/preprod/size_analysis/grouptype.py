from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from datetime import timezone as dt_timezone
from typing import TYPE_CHECKING, Any, NotRequired, TypeAlias, TypedDict
from uuid import uuid4

from sentry.exceptions import InvalidSearchQuery
from sentry.issues.grouptype import GroupCategory, GroupType, NotificationConfig
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.preprod.artifact_search import artifact_matches_query
from sentry.types.group import PriorityLevel
from sentry.utils import metrics
from sentry.workflow_engine.endpoints.validators.base import BaseDetectorTypeValidator
from sentry.workflow_engine.handlers.detector.base import (
    BaseDetectorHandler,
    DetectorOccurrence,
    GroupedDetectorEvaluationResult,
)
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors.data_condition_group import (
    ProcessedDataConditionGroup,
    process_data_condition_group,
)
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorPriorityLevel,
    DetectorSettings,
)

if TYPE_CHECKING:
    from sentry.preprod.models import PreprodArtifact

logger = logging.getLogger(__name__)


def _artifact_to_tags(artifact: PreprodArtifact) -> dict[str, str]:
    from sentry.preprod.models import PreprodArtifact as PreprodArtifactModel

    tags: dict[str, str] = {}
    if artifact.app_id:
        tags["app_id"] = artifact.app_id

    mobile_app_info = artifact.get_mobile_app_info()
    if mobile_app_info is not None:
        if mobile_app_info.app_name:
            tags["app_name"] = mobile_app_info.app_name
        if mobile_app_info.build_version:
            tags["build_version"] = mobile_app_info.build_version
        if mobile_app_info.build_number:
            tags["build_number"] = str(mobile_app_info.build_number)
    if artifact.build_configuration:
        tags["build_configuration"] = artifact.build_configuration.name
    if artifact.artifact_type is not None:
        tags["artifact_type"] = PreprodArtifactModel.ArtifactType(artifact.artifact_type).to_str()

    tags["artifact_id"] = str(artifact.id)

    return tags


_THRESHOLD_TYPE_LABELS: dict[str, str] = {
    "absolute_diff": "Absolute Diff",
    "relative_diff": "Relative Diff",
    "absolute": "Absolute Size",
}


def _get_measurement_label(measurement: str, platform: str) -> str:
    """Get platform-aware display label for a measurement type.

    On Android, install_size is called "Uncompressed Size".
    On iOS/apple, install_size is called "Install Size".
    """
    if measurement == "install_size":
        return "Uncompressed Size" if platform == "android" else "Install Size"
    if measurement == "download_size":
        return "Download Size"
    return measurement.replace("_", " ").title()


def _build_identifier_prefix(metadata: SizeAnalysisMetadata | None) -> str:
    """Build an app identifier prefix like 'MyApp android (com.example.app) — '.

    Returns empty string if no metadata is available.
    """
    if metadata is None:
        return ""

    head_artifact = metadata["head_artifact"]
    parts: list[str] = []

    mobile_app_info = head_artifact.get_mobile_app_info()
    if mobile_app_info is not None and mobile_app_info.app_name:
        parts.append(mobile_app_info.app_name)

    parts.append(metadata["platform"])

    if head_artifact.app_id:
        parts.append(f"({head_artifact.app_id})")

    return " ".join(parts) + " — "


def _build_evidence_text(
    detector_config: dict[str, Any],
    evaluation_result: ProcessedDataConditionGroup,
    data_packet: SizeAnalysisDataPacket,
    platform: str,
) -> str:
    """Build evidence string for Slack/Jira notifications.

    Format: {app_name}, {platform} ({bundle}) — {measurement}, {threshold_type} > {threshold} ({actual_value})
    Example: MyApp, android (com.example.app) — Install Size, Absolute Diff > 1.0 MB (+1.0 MB)
    """
    from sentry.preprod.utils import format_bytes_base10

    metadata = data_packet.packet.get("metadata")
    measurement = detector_config["measurement"]
    threshold_type = detector_config["threshold_type"]
    measurement_label = _get_measurement_label(measurement, platform)

    # Threshold: type > value
    threshold_part = ""
    if evaluation_result.condition_results:
        condition = evaluation_result.condition_results[0].condition
        threshold_label = _THRESHOLD_TYPE_LABELS.get(threshold_type, threshold_type)

        if threshold_type == "relative_diff":
            formatted_threshold = f"{condition.comparison}%"
        else:
            formatted_threshold = format_bytes_base10(int(condition.comparison))

        threshold_part = f", {threshold_label} > {formatted_threshold}"

    # Actual value
    match measurement:
        case "install_size":
            head_bytes = data_packet.packet["head_install_size_bytes"]
            base_bytes = data_packet.packet.get("base_install_size_bytes")
        case "download_size":
            head_bytes = data_packet.packet["head_download_size_bytes"]
            base_bytes = data_packet.packet.get("base_download_size_bytes")
        case _:
            head_bytes = 0
            base_bytes = None

    if threshold_type == "absolute" or base_bytes is None:
        actual_value = format_bytes_base10(head_bytes)
    elif threshold_type == "relative_diff":
        pct = ((head_bytes - base_bytes) / base_bytes) * 100 if base_bytes else 0
        actual_value = f"+{pct:.1f}%"
    else:
        delta = head_bytes - base_bytes
        delta_formatted = format_bytes_base10(abs(delta))
        sign = "+" if delta >= 0 else "-"
        actual_value = f"{sign}{delta_formatted}"

    identifier = _build_identifier_prefix(metadata)
    return f"{identifier}{measurement_label}{threshold_part} ({actual_value})"


class SizeAnalysisMetadata(TypedDict):
    """Metadata about the artifacts being compared, used for occurrence creation."""

    platform: str  # "android", "apple", or "unknown"
    head_metric_id: int
    base_metric_id: NotRequired[int]
    head_artifact_id: int
    base_artifact_id: NotRequired[int]
    head_artifact: PreprodArtifact
    base_artifact: NotRequired[PreprodArtifact]


class SizeAnalysisValue(TypedDict):
    head_install_size_bytes: int
    head_download_size_bytes: int
    base_install_size_bytes: NotRequired[int | None]
    base_download_size_bytes: NotRequired[int | None]
    metadata: NotRequired[SizeAnalysisMetadata | None]


SizeAnalysisDataPacket = DataPacket[SizeAnalysisValue]

# The value extracted from a data packet and evaluated against conditions.
# int for absolute values (bytes), float for relative diffs (ratios).
SizeAnalysisEvaluation: TypeAlias = int | float


class PreprodSizeAnalysisDetectorHandler(
    BaseDetectorHandler[SizeAnalysisValue, SizeAnalysisEvaluation]
):
    def _matches_query(self, data_packet: SizeAnalysisDataPacket) -> bool:
        query = self.detector.config.get("query", "")
        if not query or not query.strip():
            return True

        metadata = data_packet.packet.get("metadata")
        if not metadata:
            raise ValueError(
                f"Data packet is missing metadata required to evaluate query filter: {query}"
            )

        artifact = metadata["head_artifact"]
        organization = self.detector.project.organization

        try:
            return artifact_matches_query(artifact, query, organization)
        except InvalidSearchQuery:
            logger.exception(
                "preprod.size_analysis.invalid_detector_query",
                extra={"detector_id": self.detector.id, "query": query},
            )
            return False

    def evaluate_impl(self, data_packet: SizeAnalysisDataPacket) -> GroupedDetectorEvaluationResult:
        if not self._matches_query(data_packet):
            return GroupedDetectorEvaluationResult(result={}, tainted=False)

        value = self.extract_value(data_packet)
        evaluation, priority = self._evaluate_conditions(value)
        if evaluation is None or priority is None:
            return GroupedDetectorEvaluationResult(result={}, tainted=False)

        detector_occurrence, event_data = self.create_occurrence(evaluation, data_packet, priority)
        occurrence = detector_occurrence.to_issue_occurrence(
            occurrence_id=event_data["event_id"],
            project_id=self.detector.project_id,
            status=priority,
            additional_evidence_data={},
            fingerprint=[uuid4().hex],
        )
        result = DetectorEvaluationResult(
            group_key=None,
            is_triggered=True,
            priority=priority,
            event_data=event_data,
            result=occurrence,
        )
        return GroupedDetectorEvaluationResult(result={None: result}, tainted=False)

    def _evaluate_conditions(
        self, value: SizeAnalysisEvaluation
    ) -> tuple[ProcessedDataConditionGroup | None, DetectorPriorityLevel | None]:
        if not self.condition_group:
            metrics.incr("workflow_engine.detector.skipping_invalid_condition_group")
            return None, None

        condition_evaluation, _ = process_data_condition_group(self.condition_group, value)
        if not condition_evaluation.logic_result.triggered:
            return None, None

        priorities = [
            condition_result.result
            for condition_result in condition_evaluation.condition_results
            if isinstance(condition_result.result, DetectorPriorityLevel)
        ]
        if not priorities:
            return None, None

        return condition_evaluation, max(priorities)

    def _extract_head(self, data_packet: SizeAnalysisDataPacket) -> int:
        measurement = self.detector.config["measurement"]
        match measurement:
            case "install_size":
                return data_packet.packet["head_install_size_bytes"]
            case "download_size":
                return data_packet.packet["head_download_size_bytes"]
            case _:
                raise ValueError(f"Unknown measurement: {measurement}")

    def _extract_base(self, data_packet: SizeAnalysisDataPacket) -> int:
        measurement = self.detector.config["measurement"]
        match measurement:
            case "install_size":
                base = data_packet.packet.get("base_install_size_bytes")
            case "download_size":
                base = data_packet.packet.get("base_download_size_bytes")
            case _:
                raise ValueError(f"Unknown measurement: {measurement}")
        if base is None:
            raise ValueError(f"Missing base value for measurement: {measurement}")
        return base

    def extract_value(self, data_packet: SizeAnalysisDataPacket) -> SizeAnalysisEvaluation:
        threshold_type = self.detector.config["threshold_type"]
        match threshold_type:
            case "absolute":
                return self._extract_head(data_packet)
            case "absolute_diff":
                return self._extract_head(data_packet) - self._extract_base(data_packet)
            case "relative_diff":
                base = self._extract_base(data_packet)
                return ((self._extract_head(data_packet) - base) / base) * 100
            case _:
                raise ValueError(f"Unknown threshold_type: {threshold_type}")

    def create_occurrence(
        self,
        evaluation_result: ProcessedDataConditionGroup,
        data_packet: SizeAnalysisDataPacket,
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:
        current_timestamp = datetime.now(dt_timezone.utc)
        metadata = data_packet.packet.get("metadata")

        measurement = self.detector.config["measurement"]
        match measurement:
            case "install_size":
                issue_title = "Install size regression"
            case "download_size":
                issue_title = "Download size regression"
            case _:
                issue_title = "Size regression"

        platform = metadata["platform"] if metadata else "unknown"

        evidence_data: dict[str, Any] = {
            "detector_id": self.detector.id,
            "value": self.extract_value(data_packet),
            "conditions": [
                result.condition.get_snapshot() for result in evaluation_result.condition_results
            ],
            "config": self.detector.config,
        }
        if metadata:
            evidence_data["head_artifact_id"] = metadata["head_artifact_id"]
            if "base_artifact_id" in metadata:
                evidence_data["base_artifact_id"] = metadata["base_artifact_id"]
            evidence_data["head_size_metric_id"] = metadata["head_metric_id"]
            if "base_metric_id" in metadata:
                evidence_data["base_size_metric_id"] = metadata["base_metric_id"]

        tags: dict[str, str] = {}
        if metadata:
            tags["regression_kind"] = measurement.replace("_size", "")
            for key, value in _artifact_to_tags(metadata["head_artifact"]).items():
                tags[f"head.{key}"] = value
            if "base_artifact" in metadata:
                for key, value in _artifact_to_tags(metadata["base_artifact"]).items():
                    tags[f"base.{key}"] = value

            commit_comparison = metadata["head_artifact"].commit_comparison
            if commit_comparison is not None:
                if (head_sha := commit_comparison.head_sha) is not None:
                    tags["git.sha"] = head_sha
                if (head_ref := commit_comparison.head_ref) is not None:
                    tags["git.branch"] = head_ref
                if (head_repo := commit_comparison.head_repo_name) is not None:
                    tags["git.repo"] = head_repo
                if (base_sha := commit_comparison.base_sha) is not None:
                    tags["git.base_sha"] = base_sha
                if (base_ref := commit_comparison.base_ref) is not None:
                    tags["git.base_branch"] = base_ref
                if commit_comparison.pr_number is not None:
                    tags["git.pr_number"] = str(commit_comparison.pr_number)

        evidence_text = _build_evidence_text(
            self.detector.config, evaluation_result, data_packet, platform
        )

        occurrence = DetectorOccurrence(
            issue_title=issue_title,
            subtitle="A preprod static analysis issue was detected",
            evidence_data=evidence_data,
            evidence_display=[
                IssueEvidence(
                    name="Size Analysis",
                    value=evidence_text,
                    important=True,
                )
            ],
            type=PreprodSizeAnalysisGroupType,
            level="warning",
            culprit="",
            priority=priority,
        )

        event_data = {
            "event_id": uuid4().hex,
            "project_id": self.detector.project_id,
            "platform": platform,
            "received": current_timestamp.timestamp(),
            "timestamp": current_timestamp.timestamp(),
            "tags": tags,
        }

        return occurrence, event_data

    def extract_dedupe_value(self, data_packet: SizeAnalysisDataPacket) -> int:
        raise NotImplementedError


class PreprodSizeAnalysisDetectorValidator(BaseDetectorTypeValidator):
    data_source_required = False


@dataclass(frozen=True)
class PreprodSizeAnalysisGroupType(GroupType):
    type_id = 11003
    slug = "preprod_size_analysis"
    description = "Size Analysis"
    category = GroupCategory.PREPROD.value
    category_v2 = GroupCategory.PREPROD.value
    default_priority = PriorityLevel.LOW
    released = False
    enable_auto_resolve = True
    enable_escalation_detection = False
    notification_config = NotificationConfig(
        context=[],
        text_code_formatted=False,
    )
    detector_settings = DetectorSettings(
        handler=PreprodSizeAnalysisDetectorHandler,
        validator=PreprodSizeAnalysisDetectorValidator,
        config_schema={
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "description": "Configuration for preprod static analysis detector",
            "type": "object",
            "properties": {
                "threshold_type": {
                    "type": "string",
                    "enum": ["absolute_diff", "absolute", "relative_diff"],
                    "description": "The type of threshold to apply",
                },
                "measurement": {
                    "type": "string",
                    "enum": ["install_size", "download_size"],
                    "description": "The measurement to track",
                },
                "query": {
                    "type": "string",
                    "description": "Search query to filter which artifacts are monitored",
                },
            },
            "required": ["threshold_type", "measurement"],
            "additionalProperties": False,
        },
    )

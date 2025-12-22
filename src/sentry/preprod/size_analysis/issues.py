from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from sentry.issues.grouptype import PreprodDeltaGroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.preprod.api.models.project_preprod_build_details_models import (
    platform_from_artifact_type,
)
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.models import SizeMetricDiffItem


def artifact_to_tags(artifact: PreprodArtifact) -> dict[str, Any]:
    tags = {}

    if artifact.app_id:
        tags["app_id"] = artifact.app_id
    if artifact.app_name:
        tags["app_name"] = artifact.app_name
    if artifact.build_version:
        tags["build_version"] = artifact.build_version
    if artifact.build_number:
        tags["build_number"] = artifact.build_number
    if artifact.build_configuration:
        tags["build_configuration"] = artifact.build_configuration.name
    if artifact.artifact_type is not None:
        tags["artifact_type"] = PreprodArtifact.ArtifactType(artifact.artifact_type).to_str()

    return tags


def diff_to_occurrence(
    size: Literal["install", "download"],
    diff: SizeMetricDiffItem,
    head_metric: PreprodArtifactSizeMetrics,
    base_metric: PreprodArtifactSizeMetrics,
) -> tuple[IssueOccurrence, dict[str, Any]]:

    head_artifact = head_metric.preprod_artifact
    base_artifact = base_metric.preprod_artifact
    project_id = head_artifact.project_id

    id = uuid4().hex
    event_id = uuid4().hex
    fingerprint = [uuid4().hex]
    current_timestamp = datetime.now(timezone.utc)

    if head_artifact.artifact_type is None:
        platform = "unknown"
    else:
        platform = platform_from_artifact_type(head_artifact.artifact_type)
    tags: dict[str, Any] = {
        "regression_kind": size,
    }

    head_tags = artifact_to_tags(head_artifact)
    for key, value in head_tags.items():
        tags[f"head.{key}"] = str(value)

    base_tags = artifact_to_tags(base_artifact)
    for key, value in base_tags.items():
        tags[f"base.{key}"] = str(value)

    event_data = {
        "event_id": event_id,
        "project_id": project_id,
        "platform": platform.lower(),
        "received": current_timestamp.timestamp(),
        "timestamp": current_timestamp.timestamp(),
        "tags": tags,
    }

    evidence_data = {
        "head_artifact_id": head_artifact.id,
        "base_artifact_id": base_artifact.id,
        "head_size_metric_id": head_metric.id,
        "base_size_metric_id": base_metric.id,
    }

    match size:
        case "download":
            delta = diff.head_download_size - diff.base_download_size
            issue_title = "Download size regression"
        case "install":
            delta = diff.head_install_size - diff.base_install_size
            issue_title = "Install size regression"
        case _:
            assert False, f"Unknown size {size}"

    occurrence = IssueOccurrence(
        id=id,
        event_id=event_id,
        issue_title=issue_title,
        subtitle=f"{delta} byte {size} size regression",
        project_id=project_id,
        fingerprint=fingerprint,
        type=PreprodDeltaGroupType,
        detection_time=current_timestamp,
        evidence_data=evidence_data,
        evidence_display=[],
        level="info",
        resource_id=None,
        culprit="",
    )

    return occurrence, event_data

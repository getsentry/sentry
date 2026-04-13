from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, NotRequired, TypeAlias, TypedDict

from sentry.issues.grouptype import GroupCategory, GroupType, NotificationConfig
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.types import DetectorType

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
    detector_type = DetectorType.PREPROD_SIZE_ANALYSIS

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class RuleArtifactType(StrEnum):
    MAIN_ARTIFACT = "main_artifact"
    WATCH_ARTIFACT = "watch_artifact"
    ANDROID_DYNAMIC_FEATURE_ARTIFACT = "android_dynamic_feature_artifact"
    APP_CLIP_ARTIFACT = "app_clip_artifact"
    ALL_ARTIFACTS = "all_artifacts"

    @classmethod
    def from_raw(cls, raw: object) -> RuleArtifactType | None:
        if isinstance(raw, cls):
            return raw
        if isinstance(raw, str):
            try:
                return cls(raw)
            except ValueError:
                return None
        return None


@dataclass
class StatusCheckRule:
    """A rule that defines when a status check should fail.

    Measurement types:
    - absolute: Fail if size exceeds threshold in bytes
    - absolute_diff: Fail if size increases by more than threshold in bytes
    - relative_diff: Fail if size increases by more than percentage

    Examples:
        StatusCheckRule(
            id="rule-1",
            metric="install_size",
            measurement="absolute",
            value=52428800,
            filter_query="platform:iOS"
        )
        Triggers failure if any iOS build exceeds 50MB (52428800 bytes).

        StatusCheckRule(
            id="rule-2",
            metric="install_size",
            measurement="absolute_diff",
            value=5242880,
            filter_query="platform:iOS"
        )
        Triggers failure if any iOS build increases by more than 5MB (5242880 bytes).

        StatusCheckRule(
            id="rule-3",
            metric="download_size",
            measurement="relative_diff",
            value=10.0,
            filter_query=""
        )
        Triggers failure if any build's download size increases by more than 10%.
    """

    id: str
    metric: str
    measurement: str
    value: float
    filter_query: str = ""
    artifact_type: RuleArtifactType | None = None

    def __post_init__(self) -> None:
        self.artifact_type = RuleArtifactType.from_raw(self.artifact_type)


@dataclass
class TriggeredRule:
    """A rule that was triggered for a specific artifact.

    Associates a StatusCheckRule with the artifact that caused it to trigger,
    allowing for proper grouping and display in status check summaries.
    """

    rule: StatusCheckRule
    artifact_id: int
    app_id: str | None
    platform: str | None
    metrics_artifact_type: int | None = None
    identifier: str | None = None
    build_configuration_name: str | None = None

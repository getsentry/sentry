from enum import StrEnum

from pydantic import BaseModel

from sentry.preprod.models import PreprodArtifact


class Platform(StrEnum):
    IOS = "ios"
    ANDROID = "android"
    MACOS = "macos"


class BuildDetailsAppInfo(BaseModel):
    app_id: str
    name: str
    version: str
    build_number: str | None = None
    date_added: str | None = None
    date_built: str | None = None
    artifact_type: PreprodArtifact.ArtifactType
    platform: Platform
    installable_app_file_id: str | None = None
    # build_configuration: Optional[str] = None  # Uncomment when available
    # icon: Optional[str] = None  # Uncomment when available


class BuildDetailsVcsInfo(BaseModel):
    commit_id: str | None = None
    # repo: Optional[str] = None  # Uncomment when available
    # provider: Optional[str] = None  # Uncomment when available
    # branch: Optional[str] = None  # Uncomment when available


class BuildDetailsApiResponse(BaseModel):
    state: PreprodArtifact.ArtifactState
    app_info: BuildDetailsAppInfo
    vcs_info: BuildDetailsVcsInfo


def platform_from_artifact_type(artifact_type: PreprodArtifact.ArtifactType) -> Platform:
    if artifact_type == PreprodArtifact.ArtifactType.XCARCHIVE:
        return Platform.IOS
    elif (
        artifact_type == PreprodArtifact.ArtifactType.AAB
        or artifact_type == PreprodArtifact.ArtifactType.APK
    ):
        return Platform.ANDROID
    else:
        raise ValueError(f"Unknown artifact type: {artifact_type}")

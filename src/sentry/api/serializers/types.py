from datetime import datetime
from typing import Any, TypedDict

from sentry.api.serializers.release_details_types import Author, LastDeploy, Project, VersionInfo


class SerializedAvatarFields(TypedDict, total=False):
    avatarType: str
    avatarUuid: str | None
    avatarUrl: str | None


# Reponse type for OrganizationReleaseDetailsEndpoint
class ReleaseSerializerResponseOptional(TypedDict, total=False):
    ref: str | None
    url: str | None
    dateReleased: datetime | None
    dateCreated: datetime | None
    dateStarted: datetime | None
    owner: dict[str, Any] | None
    lastCommit: dict[str, Any] | None
    lastDeploy: LastDeploy | None
    firstEvent: datetime | None
    lastEvent: datetime | None
    currentProjectMeta: dict[str, Any] | None
    userAgent: str | None
    adoptionStages: dict[str, Any] | None  # Only included if with_adoption_stages is True


class ReleaseSerializerResponse(ReleaseSerializerResponseOptional):
    id: int
    version: str
    newGroups: int
    status: str
    shortVersion: str
    versionInfo: VersionInfo | None
    data: dict[str, Any]
    commitCount: int
    deployCount: int
    authors: list[Author]
    projects: list[Project]


class GroupEventReleaseSerializerResponse(TypedDict, total=False):
    id: int
    commitCount: int
    data: dict[str, Any]
    dateCreated: datetime
    dateReleased: datetime | None
    deployCount: int
    ref: str | None
    lastCommit: dict[str, Any] | None
    lastDeploy: LastDeploy | None
    status: str
    url: str | None
    userAgent: str | None
    version: str | None
    versionInfo: VersionInfo | None

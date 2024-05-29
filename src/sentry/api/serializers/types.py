from datetime import datetime
from typing import Any, TypedDict

from sentry.api.serializers.release_details_types import Author, LastDeploy, Project, VersionInfo


class SerializedAvatarFields(TypedDict, total=False):
    avatarType: str
    avatarUuid: str | None
    avatarUrl: str | None


class _Status(TypedDict):
    id: str
    name: str


class _Links(TypedDict):
    organizationUrl: str
    regionUrl: str


# Moved from serializers/models/organization.py to avoid a circular import between project and
# organization serializers
class OrganizationSerializerResponse(TypedDict):
    id: str
    slug: str
    status: _Status
    name: str
    dateCreated: datetime
    isEarlyAdopter: bool
    require2FA: bool
    requireEmailVerification: bool
    avatar: SerializedAvatarFields
    features: list[str]
    links: _Links
    hasAuthProvider: bool


# Reponse type for OrganizationReleaseDetailsEndpoint
class ReleaseSerializerResponseOptional(TypedDict, total=False):
    ref: str | None
    url: str | None
    dateReleased: datetime | None
    owner: dict[str, Any] | None
    lastCommit: dict[str, Any] | None
    lastDeploy: LastDeploy | None
    firstEvent: datetime | None
    lastEvent: datetime | None
    currentProjectMeta: dict[str, Any] | None
    userAgent: str | None
    adoptionStages: dict[str, Any] | None  # Only included if with_adoption_stages is True


class ReleaseSerializerResponse(ReleaseSerializerResponseOptional):
    releases: list[Any]
    id: int
    version: str
    status: str
    shortVersion: str
    versionInfo: VersionInfo
    dateCreated: datetime
    data: dict[str, Any]
    newGroups: int
    commitCount: int
    deployCount: int
    authors: list[Author]
    projects: list[Project]

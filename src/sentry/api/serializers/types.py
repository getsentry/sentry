from datetime import datetime
from typing import Any, NotRequired, TypedDict

from sentry.api.serializers.release_details_types import Author, LastDeploy, Project, VersionInfo


class ReleaseSerializerResponse(TypedDict):
    ref: NotRequired[str | None]
    url: NotRequired[str | None]
    dateReleased: NotRequired[datetime | None]
    dateCreated: NotRequired[datetime | None]
    dateStarted: NotRequired[datetime | None]
    owner: NotRequired[dict[str, Any] | None]
    lastCommit: NotRequired[dict[str, Any] | None]
    lastDeploy: NotRequired[LastDeploy | None]
    firstEvent: NotRequired[datetime | None]
    lastEvent: NotRequired[datetime | None]
    currentProjectMeta: NotRequired[dict[str, Any] | None]
    userAgent: NotRequired[str | None]
    adoptionStages: NotRequired[
        dict[str, Any] | None
    ]  # Only included if with_adoption_stages is True
    # NOTE: The API design guidelines (https://develop.sentry.dev/backend/api/design/)
    # call for resource identifiers to be returned as strings. This release `id` is a
    # long-standing integer in the public response and is relied on by existing clients,
    # so changing it would be breaking; left as-is intentionally. `version` is the
    # human-friendly identifier. Do not copy this pattern into new public responses.
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


class GroupEventReleaseSerializerResponse(TypedDict):
    id: NotRequired[int]
    commitCount: NotRequired[int]
    data: NotRequired[dict[str, Any]]
    dateCreated: NotRequired[datetime]
    dateReleased: NotRequired[datetime | None]
    deployCount: NotRequired[int]
    ref: NotRequired[str | None]
    lastCommit: NotRequired[dict[str, Any] | None]
    lastDeploy: NotRequired[LastDeploy | None]
    status: NotRequired[str]
    url: NotRequired[str | None]
    userAgent: NotRequired[str | None]
    version: NotRequired[str | None]
    versionInfo: NotRequired[VersionInfo | None]

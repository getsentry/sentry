from datetime import datetime
from typing import Annotated, Any, TypedDict

from sentry.api.serializers.release_details_types import Author, LastDeploy, Project, VersionInfo
from sentry.apidocs.descriptions import ApiDescription


# Reponse type for OrganizationReleaseDetailsEndpoint
class ReleaseSerializerResponseOptional(TypedDict, total=False):
    ref: Annotated[
        str | None, ApiDescription("Version control reference, such as a commit SHA or tag")
    ]
    url: Annotated[str | None, ApiDescription("Release URL")]
    dateReleased: Annotated[
        datetime | None, ApiDescription("When the release went live (ISO 8601)")
    ]
    dateCreated: Annotated[
        datetime | None, ApiDescription("When the release was created (ISO 8601)")
    ]
    dateStarted: datetime | None
    owner: Annotated[dict[str, Any] | None, ApiDescription("Release owner")]
    lastCommit: Annotated[
        dict[str, Any] | None, ApiDescription("Most recent commit in the release")
    ]
    lastDeploy: Annotated[LastDeploy | None, ApiDescription("Most recent deploy of the release")]
    firstEvent: Annotated[
        datetime | None, ApiDescription("When the release received its first event (ISO 8601)")
    ]
    lastEvent: Annotated[
        datetime | None,
        ApiDescription("When the release received its most recent event (ISO 8601)"),
    ]
    currentProjectMeta: dict[str, Any] | None
    userAgent: str | None
    adoptionStages: Annotated[
        dict[str, Any] | None, ApiDescription("Adoption stage of the release in each project")
    ]  # Only included if with_adoption_stages is True


class ReleaseSerializerResponse(ReleaseSerializerResponseOptional):
    # NOTE: The API design guidelines (https://develop.sentry.dev/backend/api/design/)
    # call for resource identifiers to be returned as strings. This release `id` is a
    # long-standing integer in the public response and is relied on by existing clients,
    # so changing it would be breaking; left as-is intentionally. `version` is the
    # human-friendly identifier. Do not copy this pattern into new public responses.
    id: Annotated[int, ApiDescription("Release ID")]
    version: str
    newGroups: Annotated[int, ApiDescription("Number of new issues first seen in the release")]
    status: Annotated[str, ApiDescription("Release status (open or archived)")]
    shortVersion: Annotated[str, ApiDescription("Shortened release version")]
    versionInfo: Annotated[VersionInfo | None, ApiDescription("Parsed version information")]
    data: dict[str, Any]
    commitCount: Annotated[int, ApiDescription("Number of commits in the release")]
    deployCount: Annotated[int, ApiDescription("Number of deploys of the release")]
    authors: Annotated[list[Author], ApiDescription("Authors of the release's commits")]
    projects: Annotated[list[Project], ApiDescription("Projects in the release")]


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

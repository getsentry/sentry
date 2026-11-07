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
    dateStarted: Annotated[datetime | None, ApiDescription("When the release started (ISO 8601)")]
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
    currentProjectMeta: Annotated[
        dict[str, Any] | None,
        ApiDescription(
            "Session bounds and neighboring release versions in the current project, when a project is requested"
        ),
    ]
    userAgent: Annotated[
        str | None, ApiDescription("User agent of the client that created the release")
    ]
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
    version: Annotated[str, ApiDescription("Version of the release")]
    newGroups: Annotated[int, ApiDescription("Number of new issues first seen in the release")]
    status: Annotated[str, ApiDescription("Release status (open or archived)")]
    shortVersion: Annotated[str, ApiDescription("Shortened release version")]
    versionInfo: Annotated[VersionInfo | None, ApiDescription("Parsed version information")]
    data: Annotated[dict[str, Any], ApiDescription("Extra data stored on the release")]
    commitCount: Annotated[int, ApiDescription("Number of commits in the release")]
    deployCount: Annotated[int, ApiDescription("Number of deploys of the release")]
    authors: Annotated[list[Author], ApiDescription("Authors of the release's commits")]
    projects: Annotated[list[Project], ApiDescription("Projects in the release")]


class GroupEventReleaseSerializerResponse(TypedDict, total=False):
    id: Annotated[int, ApiDescription("Release ID")]
    commitCount: Annotated[int, ApiDescription("Number of commits in the release")]
    data: Annotated[dict[str, Any], ApiDescription("Extra data stored on the release")]
    dateCreated: Annotated[datetime, ApiDescription("When the release was created (ISO 8601)")]
    dateReleased: Annotated[
        datetime | None, ApiDescription("When the release went live (ISO 8601)")
    ]
    deployCount: Annotated[int, ApiDescription("Number of deploys of the release")]
    ref: Annotated[
        str | None, ApiDescription("Version control reference, such as a commit SHA or tag")
    ]
    lastCommit: Annotated[
        dict[str, Any] | None, ApiDescription("Most recent commit in the release")
    ]
    lastDeploy: Annotated[LastDeploy | None, ApiDescription("Most recent deploy of the release")]
    status: Annotated[str, ApiDescription("Release status (open or archived)")]
    url: Annotated[str | None, ApiDescription("Release URL")]
    userAgent: Annotated[
        str | None, ApiDescription("User agent of the client that created the release")
    ]
    version: Annotated[str | None, ApiDescription("Version of the release")]
    versionInfo: Annotated[VersionInfo | None, ApiDescription("Parsed version information")]

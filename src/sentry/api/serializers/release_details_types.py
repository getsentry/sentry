from datetime import datetime
from typing import Annotated, TypeAlias, TypedDict

from sentry.apidocs.descriptions import ApiDescription
from sentry.release_health.base import ReleaseHealthStats
from sentry.users.api.serializers.user import UserSerializerResponse


class VersionInfoOptional(TypedDict, total=False):
    description: Annotated[str, ApiDescription("Human-readable version, such as 1.0.0 (123)")]


# The semver fields are only set when the version parses as a semantic version.
class VersionInfoVersionOptional(TypedDict, total=False):
    major: Annotated[int, ApiDescription("Major version")]
    minor: Annotated[int, ApiDescription("Minor version")]
    patch: Annotated[int, ApiDescription("Patch version")]
    pre: Annotated[str | None, ApiDescription("Pre-release identifier, such as rc1")]
    buildCode: Annotated[str | None, ApiDescription("Build code, such as 123")]
    components: Annotated[int, ApiDescription("Number of version components given")]


class VersionInfoVersion(VersionInfoVersionOptional):
    raw: Annotated[str, ApiDescription("Version string the release was created with")]


class VersionInfo(VersionInfoOptional):
    package: Annotated[
        str | None,
        ApiDescription("Package name parsed from the release version, such as com.example.app"),
    ]
    version: Annotated[
        VersionInfoVersion,
        ApiDescription(
            "Parsed version: the raw string, plus major, minor, patch, pre, buildCode and components when it's a semantic version"
        ),
    ]
    buildHash: Annotated[str | None, ApiDescription("Build hash parsed from the release version")]


class LastDeployOptional(TypedDict, total=False):
    dateStarted: Annotated[datetime | None, ApiDescription("When the deploy started (ISO 8601)")]
    url: Annotated[str | None, ApiDescription("URL of the deploy")]


class LastDeploy(LastDeployOptional):
    id: Annotated[str, ApiDescription("ID of the deploy")]
    environment: Annotated[str, ApiDescription("Environment the release was deployed to")]
    dateFinished: Annotated[datetime, ApiDescription("When the deploy finished (ISO 8601)")]
    name: Annotated[str | None, ApiDescription("Name of the deploy")]


class NonMappableUser(TypedDict):
    name: Annotated[str | None, ApiDescription("Commit author name")]
    email: Annotated[str, ApiDescription("Commit author email")]


Author: TypeAlias = UserSerializerResponse | NonMappableUser


class EmptyAuthor(TypedDict):
    """The commit and pull request serializers emit ``{}`` for ``author`` when there's
    no mapped author, so the published schema must allow an empty object alongside a
    populated ``Author``."""


class HealthDataOptional(TypedDict, total=False):
    durationP50: Annotated[float | None, ApiDescription("Median session duration in seconds")]
    durationP90: Annotated[
        float | None, ApiDescription("90th percentile session duration in seconds")
    ]
    crashFreeUsers: Annotated[
        float | None, ApiDescription("Percentage of users who didn't experience a crash")
    ]
    crashFreeSessions: Annotated[
        float | None, ApiDescription("Percentage of sessions that didn't crash")
    ]
    totalUsers: Annotated[int | None, ApiDescription("Total number of users in the release")]
    totalUsers24h: Annotated[
        int | None, ApiDescription("Number of users in the release over the last 24 hours")
    ]
    totalProjectUsers24h: Annotated[
        int | None, ApiDescription("Number of users in the project over the last 24 hours")
    ]
    totalSessions: Annotated[int | None, ApiDescription("Total number of sessions in the release")]
    totalSessions24h: Annotated[
        int | None, ApiDescription("Number of sessions in the release over the last 24 hours")
    ]
    totalProjectSessions24h: Annotated[
        int | None, ApiDescription("Number of sessions in the project over the last 24 hours")
    ]
    adoption: Annotated[
        float | None,
        ApiDescription(
            "Percentage of the project's users over the last 24 hours that were on the release"
        ),
    ]
    sessionsAdoption: Annotated[
        float | None,
        ApiDescription(
            "Percentage of the project's sessions over the last 24 hours that were on the release"
        ),
    ]


class HealthData(HealthDataOptional):
    sessionsCrashed: Annotated[int, ApiDescription("Number of crashed sessions")]
    sessionsErrored: Annotated[int, ApiDescription("Number of sessions with errors")]
    hasHealthData: Annotated[bool, ApiDescription("Whether the release has session data")]
    stats: Annotated[
        dict[str, ReleaseHealthStats],
        ApiDescription("Session or user counts over time, keyed by stats period"),
    ]


class ProjectOptional(TypedDict, total=False):
    healthData: Annotated[
        HealthData | None,
        ApiDescription(
            "Release health data for the project. Only included when health data is requested"
        ),
    ]
    dateReleased: Annotated[
        datetime | None, ApiDescription("When the release was released in the project (ISO 8601)")
    ]
    dateCreated: Annotated[
        datetime | None, ApiDescription("When the release was created (ISO 8601)")
    ]
    dateStarted: Annotated[
        datetime | None, ApiDescription("When work on the release started (ISO 8601)")
    ]


class BaseProject(ProjectOptional):
    id: Annotated[int, ApiDescription("ID of the project")]
    slug: Annotated[str, ApiDescription("Slug of the project")]
    name: Annotated[str, ApiDescription("Name of the project")]
    platform: Annotated[str | None, ApiDescription("Platform of the project")]
    platforms: Annotated[list[str] | None, ApiDescription("Platforms of the project")]
    hasHealthData: Annotated[
        bool, ApiDescription("Whether the release has session data in the project")
    ]


class Project(BaseProject):
    newGroups: Annotated[
        int, ApiDescription("Number of new issues first seen in the release in the project")
    ]

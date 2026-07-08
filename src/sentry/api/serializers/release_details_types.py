from datetime import datetime
from typing import Any, TypedDict

from sentry.users.api.serializers.user import UserSerializerResponse


class VersionInfoOptional(TypedDict, total=False):
    description: str


class VersionInfo(VersionInfoOptional):
    package: str | None
    version: dict[str, Any]
    buildHash: str | None


class LastDeployOptional(TypedDict, total=False):
    dateStarted: str | None
    url: str | None


class LastDeploy(LastDeployOptional):
    id: str
    environment: str
    dateFinished: str
    name: str


class NonMappableUser(TypedDict):
    name: str | None
    email: str


Author = UserSerializerResponse | NonMappableUser


class HealthDataOptional(TypedDict, total=False):
    durationP50: float | None
    durationP90: float | None
    crashFreeUsers: float | None
    crashFreeSessions: float | None
    totalUsers: int | None
    totalUsers24h: int | None
    totalProjectUsers24h: int | None
    totalSessions: int | None
    totalSessions24h: int | None
    totalProjectSessions24h: int | None
    adoption: float | None
    sessionsAdoption: float | None


class HealthData(HealthDataOptional):
    sessionsCrashed: int
    sessionsErrored: int
    hasHealthData: bool
    stats: dict[str, Any]


class ProjectOptional(TypedDict, total=False):
    healthData: HealthData | None
    dateReleased: datetime | None
    dateCreated: datetime | None
    dateStarted: datetime | None


class BaseProject(ProjectOptional):
    id: int
    slug: str
    name: str
    platform: str | None
    platforms: list[str] | None
    hasHealthData: bool


class Project(BaseProject):
    newGroups: int

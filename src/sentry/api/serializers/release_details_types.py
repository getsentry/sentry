from datetime import datetime
from typing import Any, NotRequired, TypedDict

from sentry.users.api.serializers.user import UserSerializerResponse


class VersionInfo(TypedDict):
    description: NotRequired[str]
    package: str | None
    version: dict[str, Any]
    buildHash: str | None


class LastDeploy(TypedDict):
    dateStarted: NotRequired[str | None]
    url: NotRequired[str | None]
    id: str
    environment: str
    dateFinished: str
    name: str


class NonMappableUser(TypedDict):
    name: str | None
    email: str


Author = UserSerializerResponse | NonMappableUser


class HealthData(TypedDict):
    durationP50: NotRequired[float | None]
    durationP90: NotRequired[float | None]
    crashFreeUsers: NotRequired[float | None]
    crashFreeSessions: NotRequired[float | None]
    totalUsers: NotRequired[int | None]
    totalUsers24h: NotRequired[int | None]
    totalProjectUsers24h: NotRequired[int | None]
    totalSessions: NotRequired[int | None]
    totalSessions24h: NotRequired[int | None]
    totalProjectSessions24h: NotRequired[int | None]
    adoption: NotRequired[float | None]
    sessionsAdoption: NotRequired[float | None]
    sessionsCrashed: int
    sessionsErrored: int
    hasHealthData: bool
    stats: dict[str, Any]


class BaseProject(TypedDict):
    healthData: NotRequired[HealthData | None]
    dateReleased: NotRequired[datetime | None]
    dateCreated: NotRequired[datetime | None]
    dateStarted: NotRequired[datetime | None]
    id: int
    slug: str
    name: str
    platform: str | None
    platforms: list[str] | None
    hasHealthData: bool


class Project(BaseProject):
    newGroups: int

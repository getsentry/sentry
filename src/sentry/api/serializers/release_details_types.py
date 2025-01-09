from datetime import datetime
from typing import Any, TypedDict


class ReleaseOptional(TypedDict, total=False):
    status: int | None
    project_id: int | None
    ref: str | None
    url: str | None
    date_started: datetime | None
    date_released: datetime | None
    owner_id: int | None
    commit_count: int | None
    last_commit_id: int | None
    authors: list[int] | None
    total_deploys: int | None
    last_deploy_id: int | None
    package: str | None
    major: int | None
    minor: int | None
    patch: int | None
    revision: int | None
    prerelease: str | None
    build_code: str | None
    build_number: int | None
    user_agent: str | None


class ReleaseTypedDict(ReleaseOptional):
    organization: int
    projects: list[int]
    version: str
    date_added: datetime
    data: dict[str, Any]
    new_groups: int


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


class AuthorOptional(TypedDict, total=False):
    lastLogin: str
    has2fa: bool
    lastActive: str
    isSuperuser: bool
    isStaff: bool
    experiments: dict[str, str | int | float | bool | None]
    emails: list[dict[str, int | str | bool]]
    avatar: dict[str, str | None]


class Author(AuthorOptional):
    id: int
    name: str
    username: str
    email: str
    avatarUrl: str
    isActive: bool
    hasPasswordAuth: bool
    isManaged: bool
    dateJoined: str


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


class Project(ProjectOptional):
    id: int
    slug: str
    name: str
    newGroups: int
    platform: str | None
    platforms: list[str] | None
    hasHealthData: bool

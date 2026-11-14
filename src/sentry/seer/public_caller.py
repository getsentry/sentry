"""Project scope for the public Seer RPC.

The public endpoint and the internal Seer RPC share the same helpers. Internal
calls are org-wide on purpose. The public endpoint binds the member's access
for one dispatch so those helpers only read projects the member can already
open. Callers with org-wide access (open membership, or a global role) and
unbound callers, including the internal RPC, keep the existing behavior.
"""

from __future__ import annotations

from collections.abc import Generator, Iterable
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import TYPE_CHECKING

from sentry.constants import ALL_ACCESS_PROJECT_ID, ObjectStatus
from sentry.models.project import Project

if TYPE_CHECKING:
    from sentry.auth.access import Access
    from sentry.models.team import Team


@dataclass(frozen=True)
class ScopedProjects:
    project_ids: list[int] | None
    project_slugs: list[str] | None
    # The caller can access none of the requested projects. The query should
    # return an empty result instead of running.
    blocked: bool = False


class _Caller:
    def __init__(self, access: Access) -> None:
        self.access = access
        self._projects: dict[int, list[Project]] = {}

    def accessible_projects(self, organization_id: int) -> list[Project]:
        if organization_id not in self._projects:
            self._projects[organization_id] = [
                project
                for project in Project.objects.filter(
                    organization_id=organization_id, status=ObjectStatus.ACTIVE
                )
                if self.access.has_project_access(project)
            ]
        return self._projects[organization_id]


_caller: ContextVar[_Caller | None] = ContextVar("seer_public_rpc_caller", default=None)


@contextmanager
def bind_public_seer_caller(access: Access) -> Generator[None]:
    token = _caller.set(_Caller(access))
    try:
        yield
    finally:
        _caller.reset(token)


def _restricted_caller() -> _Caller | None:
    """The bound caller, when their access is narrower than the whole org."""
    caller = _caller.get()
    if caller is None or caller.access.has_global_access:
        return None
    return caller


def public_caller_restricted() -> bool:
    return _restricted_caller() is not None


def scope_projects(
    organization_id: int,
    project_ids: list[int] | None = None,
    project_slugs: list[str] | None = None,
) -> ScopedProjects:
    """Narrow a project filter to the projects the public caller can access.

    Unrestricted callers get their arguments back unchanged, including an
    omitted filter that the helpers expand to every project in the org.
    """
    caller = _restricted_caller()
    if caller is None:
        return ScopedProjects(project_ids=project_ids, project_slugs=project_slugs)

    accessible = caller.accessible_projects(organization_id)

    if project_slugs:
        requested_slugs = set(project_slugs)
        slugs = [p.slug for p in accessible if p.slug in requested_slugs]
        return ScopedProjects(project_ids=None, project_slugs=slugs, blocked=not slugs)

    if project_ids and ALL_ACCESS_PROJECT_ID not in project_ids:
        requested_ids = set(project_ids)
        ids = [p.id for p in accessible if p.id in requested_ids]
        return ScopedProjects(project_ids=ids, project_slugs=None, blocked=not ids)

    ids = [p.id for p in accessible]
    return ScopedProjects(project_ids=ids, project_slugs=None, blocked=not ids)


def restrict_projects(projects: Iterable[Project]) -> list[Project]:
    caller = _restricted_caller()
    if caller is None:
        return list(projects)
    return [project for project in projects if caller.access.has_project_access(project)]


def caller_can_access_project(project: Project) -> bool:
    caller = _restricted_caller()
    return caller is None or caller.access.has_project_access(project)


def caller_can_access_project_id(organization_id: int, project_id: int) -> bool:
    caller = _restricted_caller()
    if caller is None:
        return True
    return any(p.id == project_id for p in caller.accessible_projects(organization_id))


def caller_can_access_team(team: Team) -> bool:
    caller = _restricted_caller()
    return caller is None or caller.access.has_team_access(team)

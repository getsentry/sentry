from __future__ import annotations

import abc
import re
from dataclasses import dataclass
from typing import Any, Dict, FrozenSet, Generic, Iterable, Mapping, Sequence, Tuple, Type, TypeVar

from sentry.utils import warnings


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


R = TypeVar("R", bound="Role")


@dataclass(frozen=True, eq=True)
class Role(abc.ABC):
    parent: RoleManager
    priority: int
    id: str
    name: str
    desc: str
    scopes: FrozenSet[str]
    is_retired: bool = False

    def __post_init__(self) -> None:
        assert len(self.id) <= 32, "Role id must be no more than 32 characters"

    @classmethod
    def from_config(
        cls: Type[R],
        parent: RoleManager,
        priority: int,
        desc: str = "",
        scopes: Iterable[str] = (),
        **kwargs: Any,
    ) -> R:
        return cls(
            parent, priority, desc=_normalize_whitespace(desc), scopes=frozenset(scopes), **kwargs
        )

    def __str__(self) -> str:
        return str(self.name)

    def __repr__(self) -> str:
        return f"<Role: {self.id}>"

    def can_manage(self: R, other: R) -> bool:
        return self.priority >= other.priority

    def has_scope(self, scope: str) -> bool:
        return scope in self.scopes


@dataclass(frozen=True, eq=True)
class OrganizationRole(Role):
    is_global: bool = False

    def get_minimum_team_role(self) -> TeamRole:
        """Return the minimum team role for this organization role.

        A member with this organization role automatically receives the minimum role
        when joining a new team, and can't be demoted below that team role for as
        long as they hold the organization role.
        """
        return self.parent.get_minimum_team_role(self.id)

    def can_manage_team_role(self, other: TeamRole) -> bool:
        return self.get_minimum_team_role().can_manage(other)


@dataclass(frozen=True, eq=True)
class TeamRole(Role):
    is_minimum_role_for: str | None = None


class RoleLevel(Generic[R]):
    """Represent the set of all roles at one level (org or team)."""

    def __init__(self, roles: Iterable[R], default_id: str | None = None) -> None:
        self._priority_seq = tuple(sorted(roles, key=lambda r: r.priority))
        self._id_map = {r.id: r for r in self._priority_seq}

        self._choices = tuple((r.id, r.name) for r in self._priority_seq)
        self._default = self._id_map[default_id] if default_id else self._priority_seq[0]
        self._top_dog = self._priority_seq[-1]

    def __iter__(self) -> Iterable[R]:
        yield from self._priority_seq

    def can_manage(self, role: str, other: str) -> bool:
        return self.get(role).priority >= self.get(other).priority

    def get(self, id: str) -> R:
        return self._id_map[id]

    def get_all(self) -> Sequence[R]:
        return self._priority_seq

    def get_choices(self) -> Sequence[Tuple[str, str]]:
        return self._choices

    def get_default(self) -> R:
        return self._default

    def get_top_dog(self) -> R:
        return self._top_dog

    def with_scope(self, scope: str) -> Iterable[R]:
        for role in self.get_all():
            if role.has_scope(scope):
                yield role

    def with_any_scope(self, scopes: Iterable[str]) -> Iterable[R]:
        for role in self.get_all():
            if any(role.has_scope(scope) for scope in scopes):
                yield role

    def get_sorted_roles(self, roles: Iterable[str]) -> list[R]:
        return sorted(
            [self.get(role) for role in roles],
            key=lambda r: r.priority,
            reverse=True,
        )


class RoleManager:
    def __init__(
        self,
        org_config: Iterable[Mapping[str, Any]],
        team_config: Iterable[Mapping[str, Any]],
        default_org_role: str | None = None,
    ) -> None:
        self.organization_roles: RoleLevel[OrganizationRole] = RoleLevel(
            (
                OrganizationRole.from_config(self, idx, **role_cfg)
                for idx, role_cfg in enumerate(org_config)
            ),
            default_org_role,
        )

        self.team_roles: RoleLevel[TeamRole] = RoleLevel(
            TeamRole.from_config(self, idx, **role_cfg) for idx, role_cfg in enumerate(team_config)
        )

        self._minimum_team_role_map = self._make_minimum_team_role_map(
            self.organization_roles, self.team_roles
        )

    @staticmethod
    def _make_minimum_team_role_map(
        organization_roles: RoleLevel[OrganizationRole], team_roles: RoleLevel[TeamRole]
    ) -> Dict[str, str]:
        def get_mapped_org_role(team_role: TeamRole) -> OrganizationRole | None:
            if team_role.is_minimum_role_for is None:
                return None
            try:
                return organization_roles.get(team_role.is_minimum_role_for)
            except KeyError:
                warnings.warn(
                    f"Broken role mapping: {team_role.id}.is_minimum_role_for = {team_role.is_minimum_role_for}"
                )
                return None

        def get_highest_available_team_role(org_role: OrganizationRole) -> TeamRole:
            if org_role is organization_roles.get_top_dog():
                return team_roles.get_top_dog()
            for team_role in reversed(team_roles.get_all()):
                mapped_org_role = get_mapped_org_role(team_role)
                if mapped_org_role and mapped_org_role.priority <= org_role.priority:
                    return team_role
            return team_roles.get_default()

        return {
            org_role.id: get_highest_available_team_role(org_role).id
            for org_role in organization_roles.get_all()
        }

    def __iter__(self) -> Iterable[OrganizationRole]:
        yield from self.organization_roles.get_all()

    def can_manage(self, role: str, other: str) -> bool:
        return self.organization_roles.can_manage(role, other)

    def get(self, id: str) -> OrganizationRole:
        return self.organization_roles.get(id)

    def get_all(self) -> Sequence[OrganizationRole]:
        return self.organization_roles.get_all()

    def get_choices(self) -> Sequence[Tuple[str, str]]:
        return self.organization_roles.get_choices()

    def get_default(self) -> OrganizationRole:
        return self.organization_roles.get_default()

    def get_top_dog(self) -> OrganizationRole:
        return self.organization_roles.get_top_dog()

    def with_scope(self, scope: str) -> Iterable[OrganizationRole]:
        return self.organization_roles.with_scope(scope)

    def with_any_scope(self, scopes: Iterable[str]) -> Iterable[OrganizationRole]:
        return self.organization_roles.with_any_scope(scopes)

    def get_minimum_team_role(self, org_role: str) -> TeamRole:
        return self.team_roles.get(self._minimum_team_role_map[org_role])

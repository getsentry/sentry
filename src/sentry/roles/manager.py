import abc
import re
from collections import OrderedDict
from dataclasses import dataclass
from typing import Dict, FrozenSet, Iterable, Mapping, Optional, Sequence, Tuple

from sentry.utils import warnings


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


@dataclass(frozen=True, eq=True)
class Role(abc.ABC):
    priority: int
    id: str
    name: str
    desc: str
    scopes: FrozenSet[str]

    def __post_init__(self) -> None:
        assert len(self.id) <= 32, "Role id must be no more than 32 characters"

    @classmethod
    def from_config(
        cls, priority: int, desc: str = "", scopes: Iterable[str] = (), **kwargs
    ) -> "Role":
        return cls(
            priority=priority, desc=_normalize_whitespace(desc), scopes=frozenset(scopes), **kwargs
        )

    def __str__(self) -> str:
        return str(self.name)

    def __repr__(self) -> str:
        return f"<Role: {self.id}>"

    def has_scope(self, scope: str) -> bool:
        return scope in self.scopes


@dataclass(frozen=True, eq=True)
class OrganizationRole(Role):
    is_global: bool = False


@dataclass(frozen=True, eq=True)
class TeamRole(Role):
    is_entry_role_for: Optional[str] = None


class RoleManager:
    def __init__(
        self,
        org_config: Iterable[Mapping[str, str]],
        team_config: Iterable[Mapping[str, str]],
        default_org_role: Optional[str] = None,
    ) -> None:
        self._org_roles: Dict[str, OrganizationRole] = OrderedDict()
        for idx, role_cfg in enumerate(org_config):
            org_role = OrganizationRole.from_config(idx, **role_cfg)
            self._org_roles[org_role.id] = org_role

        self._choices = tuple((r.id, r.name) for r in self._org_roles.values())

        if default_org_role:
            self._default = self._org_roles[default_org_role]
        else:
            self._default = next(iter(self._org_roles.values()))

        self._top_dog = next(iter(reversed(self._org_roles.values())))

        self._team_roles: Dict[str, TeamRole] = OrderedDict()
        for idx, role_cfg in enumerate(team_config):
            team_role = TeamRole.from_config(idx, **role_cfg)
            self._team_roles[team_role.id] = team_role

        self._entry_role_map = self._make_entry_role_map()

    def _make_entry_role_map(self) -> Dict[str, str]:
        team_default = next(iter(self._team_roles.values()))
        team_top_dog = next(iter(reversed(self._team_roles.values())))

        def get_mapped_org_role(team_role: TeamRole) -> Optional[OrganizationRole]:
            if team_role.is_entry_role_for is None:
                return None
            org_role = self._org_roles.get(team_role.is_entry_role_for)
            if org_role is None:
                warnings.warn(
                    f"Broken role mapping: {team_role.id}.is_entry_role_for = {team_role.is_entry_role_for}"
                )
            return org_role

        def get_highest_available_team_role(org_role: OrganizationRole) -> TeamRole:
            if org_role is self._top_dog:
                return team_top_dog
            for team_role in reversed(self._team_roles.values()):
                mapped_org_role = get_mapped_org_role(team_role)
                if mapped_org_role and mapped_org_role.priority <= org_role.priority:
                    return team_role
            return team_default

        return OrderedDict(
            (org_role.id, get_highest_available_team_role(org_role).id)
            for org_role in self._org_roles.values()
        )

    def __iter__(self) -> Iterable[OrganizationRole]:
        yield from self._org_roles.values()

    def can_manage(self, role: str, other: str) -> bool:
        return self.get(role).priority >= self.get(other).priority

    def get(self, id: str) -> OrganizationRole:
        return self._org_roles[id]

    def get_all(self) -> Sequence[OrganizationRole]:
        return list(self._org_roles.values())

    def get_choices(self) -> Sequence[Tuple[str, str]]:
        return self._choices

    def get_default(self) -> OrganizationRole:
        return self._default

    def get_top_dog(self) -> OrganizationRole:
        return self._top_dog

    def with_scope(self, scope: str) -> Iterable[OrganizationRole]:
        for role in self.get_all():
            if role.has_scope(scope):
                yield role

    def with_any_scope(self, scopes: Iterable[str]) -> Iterable[OrganizationRole]:
        for role in self.get_all():
            if any(role.has_scope(scope) for scope in scopes):
                yield role

    def get_team_role(self, role: str) -> TeamRole:
        return self._team_roles[role]

    def get_entry_role(self, org_role: str) -> TeamRole:
        return self.get_team_role(self._entry_role_map[org_role])

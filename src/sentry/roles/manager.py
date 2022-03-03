import abc
import re
from collections import OrderedDict
from dataclasses import dataclass
from typing import Dict, FrozenSet, Generic, Iterable, Mapping, Optional, Sequence, Tuple, TypeVar

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


R = TypeVar("R", bound=Role)


class RoleSet(Generic[R]):
    def __init__(self, roles: Iterable[R], default_id: Optional[str] = None) -> None:
        self._priority_seq = tuple(sorted(roles, key=lambda r: r.priority))
        self._id_map = OrderedDict((r.id, r) for r in self._priority_seq)

        self._choices = tuple((r.id, r.name) for r in self._priority_seq)
        self._default = self._id_map[default_id] if default_id else self._priority_seq[0]
        self._top_dog = self._priority_seq[-1]

    def __iter__(self) -> Iterable[R]:
        yield from self._priority_seq

    def can_manage(self, role: str, other: str) -> bool:
        return self.get(role).priority >= self.get(other).priority

    def get(self, id: str) -> R:
        return self._id_map[id]

    def get_if_exists(self, id: str) -> Optional[R]:
        return self._id_map.get(id)

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


class RoleManager:
    def __init__(
        self,
        org_config: Iterable[Mapping[str, str]],
        team_config: Iterable[Mapping[str, str]],
        default_org_role: Optional[str] = None,
    ) -> None:
        self._org_roles: RoleSet[OrganizationRole] = RoleSet(
            (
                OrganizationRole.from_config(idx, **role_cfg)
                for idx, role_cfg in enumerate(org_config)
            ),
            default_org_role,
        )

        self._team_roles: RoleSet[TeamRole] = RoleSet(
            TeamRole.from_config(idx, **role_cfg) for idx, role_cfg in enumerate(team_config)
        )

        self._entry_role_map = self._make_entry_role_map()

    def _make_entry_role_map(self) -> Dict[str, str]:
        def get_mapped_org_role(team_role: TeamRole) -> Optional[OrganizationRole]:
            if team_role.is_entry_role_for is None:
                return None
            org_role = self._org_roles.get_if_exists(team_role.is_entry_role_for)
            if org_role is None:
                warnings.warn(
                    f"Broken role mapping: {team_role.id}.is_entry_role_for = {team_role.is_entry_role_for}"
                )
            return org_role

        def get_highest_available_team_role(org_role: OrganizationRole) -> TeamRole:
            if org_role is self._org_roles.get_top_dog():
                return self._team_roles.get_top_dog()
            for team_role in reversed(self._team_roles.get_all()):
                mapped_org_role = get_mapped_org_role(team_role)
                if mapped_org_role and mapped_org_role.priority <= org_role.priority:
                    return team_role
            return self._team_roles.get_default()

        return OrderedDict(
            (org_role.id, get_highest_available_team_role(org_role).id)
            for org_role in self._org_roles.get_all()
        )

    def __iter__(self) -> Iterable[OrganizationRole]:
        yield from self._org_roles

    def can_manage(self, role: str, other: str) -> bool:
        return self._org_roles.can_manage(role, other)

    def get(self, id: str) -> OrganizationRole:
        return self._org_roles.get(id)

    def get_all(self) -> Sequence[OrganizationRole]:
        return self._org_roles.get_all()

    def get_choices(self) -> Sequence[Tuple[str, str]]:
        return self._org_roles.get_choices()

    def get_default(self) -> OrganizationRole:
        return self._org_roles.get_default()

    def get_top_dog(self) -> OrganizationRole:
        return self._org_roles.get_top_dog()

    def with_scope(self, scope: str) -> Iterable[OrganizationRole]:
        return self._org_roles.with_scope(scope)

    def with_any_scope(self, scopes: Iterable[str]) -> Iterable[OrganizationRole]:
        return self._org_roles.with_any_scope(scopes)

    def get_organization_roles(self) -> RoleSet[OrganizationRole]:
        return self._org_roles

    def get_team_roles(self) -> RoleSet[TeamRole]:
        return self._team_roles

    def get_entry_role(self, org_role: str) -> TeamRole:
        return self._team_roles.get(self._entry_role_map[org_role])

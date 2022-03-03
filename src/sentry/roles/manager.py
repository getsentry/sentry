import abc
import re
from collections import OrderedDict
from dataclasses import dataclass
from typing import Dict, Iterable, Mapping, Optional, Tuple


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


@dataclass(unsafe_hash=True)
class Role(abc.ABC):
    priority: int
    id: str
    name: str
    desc: str = ""
    scopes: Iterable[str] = ()
    is_global: bool = False

    def __post_init__(self) -> None:
        assert len(self.id) <= 32, "Role id must be no more than 32 characters"

        self.desc = _normalize_whitespace(self.desc)
        self.scopes = frozenset(self.scopes)
        self.is_global = bool(self.is_global)

    def __str__(self) -> str:
        return str(self.name)

    def __repr__(self) -> str:
        return f"<Role: {self.id}>"

    def has_scope(self, scope: str) -> bool:
        return scope in self.scopes


class RoleManager:
    def __init__(
        self,
        config: Iterable[Mapping[str, str]],
        default: Optional[str] = None,
    ) -> None:
        self._roles: Dict[str, Role] = OrderedDict()
        for idx, role_cfg in enumerate(config):
            role = Role(idx, **role_cfg)
            self._roles[role.id] = role

        self._choices = tuple((r.id, r.name) for r in self._roles.values())

        if default:
            self._default = self._roles[default]
        else:
            self._default = next(iter(self._roles.values()))

        self._top_dog = next(iter(reversed(self._roles.values())))

    def __iter__(self) -> Iterable[Role]:
        yield from self._roles.values()

    def can_manage(self, role: str, other: str) -> bool:
        return self.get(role).priority >= self.get(other).priority

    def get(self, id: str) -> Role:
        return self._roles[id]

    def get_all(self) -> Iterable[Role]:
        return list(self._roles.values())

    def get_choices(self) -> Iterable[Tuple[str, str]]:
        return self._choices

    def get_default(self) -> Role:
        return self._default

    def get_top_dog(self) -> Role:
        return self._top_dog

    def with_scope(self, scope: str) -> Iterable[Role]:
        for role in self.get_all():
            if role.has_scope(scope):
                yield role

    def with_any_scope(self, scopes: Iterable[str]) -> Iterable[Role]:
        for role in self.get_all():
            if any(role.has_scope(scope) for scope in scopes):
                yield role

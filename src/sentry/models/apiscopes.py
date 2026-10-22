from collections.abc import Sequence
from typing import overload

from django.contrib.postgres.fields.array import ArrayField
from django.db import models

from sentry.conf.server import SENTRY_SCOPE_HIERARCHY_MAPPING, SENTRY_SCOPES


def add_scope_hierarchy(curr_scopes: Sequence[str]) -> list[str]:
    """
    Adds missing hierarchy scopes to the list of scopes. Returns an
    alphabetically sorted list of final scopes.
    """
    new_scopes = set(curr_scopes)
    for scope in curr_scopes:
        if scope in SENTRY_SCOPES:
            new_scopes = new_scopes.union(SENTRY_SCOPE_HIERARCHY_MAPPING[scope])
    return sorted(new_scopes)


class ApiScopes(Sequence[str]):
    project = (
        ("project:read"),
        ("project:write"),
        ("project:admin"),
        ("project:releases"),
        ("project:distribution"),
    )

    team = (("team:read"), ("team:write"), ("team:admin"))

    event = (("event:read"), ("event:write"), ("event:admin"))

    org = (("org:read"), ("org:write"), ("org:integrations"), ("org:admin"), ("org:ci"))

    member = (("member:read"), ("member:write"), ("member:admin"), ("member:invite"))

    alerts = (("alerts:read"), ("alerts:write"))

    dashboard = (
        ("dashboard:read"),
        ("dashboard:create"),
        ("dashboard:write"),
        ("dashboard:delete"),
    )

    seer = (("seer:read"), ("seer:write"))

    def __init__(self) -> None:
        self.scopes = (
            self.__class__.project
            + self.__class__.team
            + self.__class__.event
            + self.__class__.org
            + self.__class__.member
            + self.__class__.alerts
            + self.__class__.dashboard
            + self.__class__.seer
        )

    @overload
    def __getitem__(self, value: int) -> str: ...

    @overload
    def __getitem__(self, value: slice) -> Sequence[str]: ...

    def __getitem__(self, value: int | slice) -> str | Sequence[str]:
        return self.scopes.__getitem__(value)

    def __len__(self) -> int:
        return len(self.scopes)

    def __repr__(self) -> str:
        return self.scopes.__repr__()


class HasApiScopes(models.Model):
    """
    Mixin for models that hold a list of OAuth Scopes.
    """

    class Meta:
        abstract = True

    # Human readable list of scopes
    scope_list = ArrayField(models.TextField(), default=list)

    def get_scopes(self) -> list[str]:
        """
        Returns a list of the token's scopes in alphabetical order.
        """
        return sorted(self.scope_list)

    def has_scope(self, scope: str) -> bool:
        """
        Checks whether the token has the given scope
        """
        return scope in self.get_scopes()

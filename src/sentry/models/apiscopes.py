from collections.abc import Sequence
from typing import TypedDict

from django.db import models

from bitfield import typed_dict_bitfield
from sentry.conf.server import SENTRY_SCOPE_HIERARCHY_MAPPING, SENTRY_SCOPES
from sentry.db.models import ArrayField


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


class ApiScopes(Sequence):
    project = (("project:read"), ("project:write"), ("project:admin"), ("project:releases"))

    team = (("team:read"), ("team:write"), ("team:admin"))

    event = (("event:read"), ("event:write"), ("event:admin"))

    org = (("org:read"), ("org:write"), ("org:integrations"), ("org:admin"))

    member = (("member:read"), ("member:write"), ("member:admin"), ("member:invite"))

    alerts = (("alerts:read"), ("alerts:write"))

    def __init__(self):
        self.scopes = (
            self.__class__.project
            + self.__class__.team
            + self.__class__.event
            + self.__class__.org
            + self.__class__.member
            + self.__class__.alerts
        )

    def __getitem__(self, value):
        return self.scopes.__getitem__(value)

    def __len__(self):
        return len(self.scopes)

    def __repr__(self):
        return self.scopes.__repr__()


class HasApiScopes(models.Model):
    """
    Mixin for models that hold a list of OAuth Scopes.
    """

    class Meta:
        abstract = True

    # List of scopes in bit form
    ScopesDict = TypedDict(
        "ScopesDict",
        {
            "project:read": bool,
            "project:write": bool,
            "project:admin": bool,
            "project:releases": bool,
            "team:read": bool,
            "team:write": bool,
            "team:admin": bool,
            "event:read": bool,
            "event:write": bool,
            "event:admin": bool,
            "org:read": bool,
            "org:write": bool,
            "org:admin": bool,
            "member:read": bool,
            "member:write": bool,
            "member:admin": bool,
            "org:integrations": bool,
            "alerts:read": bool,
            "alerts:write": bool,
            "member:invite": bool,
        },
    )
    assert set(ScopesDict.__annotations__) == set(ApiScopes())
    scopes = typed_dict_bitfield(ScopesDict)

    # Human readable list of scopes
    scope_list = ArrayField(of=models.TextField)

    def get_scopes(self) -> list[str]:
        """
        Returns a list of the token's scopes in alphabetical order.
        """
        if self.scope_list:
            return sorted(self.scope_list)
        return sorted([k for k, v in self.scopes.items() if v])

    def has_scope(self, scope: str) -> bool:
        """
        Checks whether the token has the given scope
        """
        return scope in self.get_scopes()

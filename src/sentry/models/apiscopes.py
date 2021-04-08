from collections import Sequence

from django.db import models

from bitfield import BitField
from sentry.db.models import ArrayField


class ApiScopes(Sequence):
    project = (("project:read"), ("project:write"), ("project:admin"), ("project:releases"))

    team = (("team:read"), ("team:write"), ("team:admin"))

    event = (("event:read"), ("event:write"), ("event:admin"))

    org = (("org:read"), ("org:write"), ("org:admin"))

    member = (("member:read"), ("member:write"), ("member:admin"))

    def __init__(self):
        self.scopes = (
            self.__class__.project
            + self.__class__.team
            + self.__class__.event
            + self.__class__.org
            + self.__class__.member
        )

    def to_bitfield(self):
        return tuple((s, s) for s in self.scopes)

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
    scopes = BitField(flags=ApiScopes().to_bitfield())

    # Human readable list of scopes
    scope_list = ArrayField(of=models.TextField)

    def get_scopes(self):
        if self.scope_list:
            return self.scope_list
        return [k for k, v in self.scopes.items() if v]

    def has_scope(self, scope):
        return scope in self.get_scopes()

from __future__ import absolute_import

from collections import Sequence


class ApiScopes(Sequence):
    project = (
        ('project:read'),
        ('project:write'),
        ('project:admin'),
        ('project:releases'),
    )

    team = (
        ('team:read'),
        ('team:write'),
        ('team:admin'),
    )

    event = (
        ('event:read'),
        ('event:write'),
        ('event:admin'),
    )

    org = (
        ('org:read'),
        ('org:write'),
        ('org:admin'),
    )

    member = (
        ('member:read'),
        ('member:write'),
        ('member:admin'),
    )

    def __init__(self):
        self.scopes = self.__class__.project \
            + self.__class__.team \
            + self.__class__.event \
            + self.__class__.org \
            + self.__class__.member

    def to_bitfield(self):
        return tuple((s, s) for s in self.scopes)

    def __getitem__(self, value):
        return self.scopes.__getitem__(value)

    def __len__(self):
        return len(self.scopes)

    def __repr__(self):
        return self.scopes.__repr__()

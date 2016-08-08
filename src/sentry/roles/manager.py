from __future__ import absolute_import

import six

from collections import OrderedDict


class Role(object):
    def __init__(self, priority, id, name, desc='', scopes=(), is_global=False):
        assert len(id) <= 32, 'Role id must be no more than 32 characters'

        self.priority = priority
        self.id = id
        self.name = name
        self.desc = desc
        self.scopes = frozenset(scopes)
        self.is_global = bool(is_global)

    def __str__(self):
        return self.name.encode('utf-8')

    def __unicode__(self):
        return six.text_type(self.name)

    def __repr__(self):
        return '<Role: {}>'.format(self.id)

    def has_scope(self, scope):
        return scope in self.scopes


class RoleManager(object):
    def __init__(self, config, default=None):
        role_list = []
        self._roles = OrderedDict()
        for idx, role in enumerate(config):
            role = Role(idx, **role)
            role_list.append(role)
            self._roles[role.id] = role

        self._choices = tuple(
            (r.id, r.name)
            for r in role_list
        )

        if default:
            self._default = self._roles[default]
        else:
            self._default = role_list[0]

        self._top_dog = role_list[-1]

    def __iter__(self):
        return six.itervalues(self._roles)

    def can_manage(self, role, other):
        return self.get(role).priority >= self.get(other).priority

    def get(self, id):
        return self._roles[id]

    def get_all(self):
        return self._roles.values()

    def get_choices(self):
        return self._choices

    def get_default(self):
        return self._default

    def get_top_dog(self):
        return self._top_dog

    def with_scope(self, scope):
        for role in self.get_all():
            if role.has_scope(scope):
                yield role

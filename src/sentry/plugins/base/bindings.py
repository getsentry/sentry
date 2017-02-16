from __future__ import absolute_import, print_function

import six

from sentry.plugins import providers


class ProviderManager(object):
    type = None

    def __init__(self):
        self._items = {}

    def __iter__(self):
        return iter(self._items)

    def add(self, item, id):
        if self.type and not issubclass(item, self.type):
            raise ValueError('Invalid type for provider: {}'.format(
                type(item),
            ))

        self._items[id] = item

    def get(self, id):
        return self._items[id]


class RepositoryProviderManager(ProviderManager):
    type = providers.RepositoryProvider


class BindingManager(object):
    BINDINGS = {
        'repository.provider': RepositoryProviderManager,
    }

    def __init__(self):
        self._bindings = {k: v() for k, v in six.iteritems(self.BINDINGS)}

    def add(self, name, binding, **kwargs):
        self._bindings[name].add(binding, **kwargs)

    def get(self, name):
        return self._bindings[name]

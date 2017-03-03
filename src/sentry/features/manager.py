from __future__ import absolute_import

__all__ = ['FeatureManager']

from django.conf import settings

from sentry.plugins import plugins
from sentry.utils.safe import safe_execute

from .base import Feature
from .exceptions import FeatureNotRegistered


class FeatureManager(object):
    def __init__(self):
        self._registry = {}

    def add(self, name, cls=Feature):
        self._registry[name] = cls

    def get(self, name, *args, **kwargs):
        try:
            cls = self._registry[name]
        except KeyError:
            raise FeatureNotRegistered(name)
        return cls(name, *args, **kwargs)

    def has(self, name, *args, **kwargs):
        """
        >>> FeatureManager.has('my:feature', actor=request.user)
        """
        actor = kwargs.pop('actor', None)
        feature = self.get(name, *args, **kwargs)
        rv = self._get_plugin_value(feature, actor)
        if rv is None:
            rv = feature.has(actor=actor)
        if rv is None:
            rv = self._get_default_value(feature)
        return rv

    def _get_default_value(self, feature):
        return settings.SENTRY_FEATURES.get(feature.name, False)

    def _get_plugin_value(self, feature, actor):
        for plugin in plugins.all(version=2):
            handlers = safe_execute(plugin.get_feature_hooks,
                                    _with_transaction=False)
            for handler in handlers or ():
                rv = handler(feature, actor)
                if rv is not None:
                    return rv
        return None

from __future__ import absolute_import

__all__ = ["FeatureManager"]

import itertools

from django.conf import settings

from sentry.utils.safe import safe_execute

from .base import Feature
from .exceptions import FeatureNotRegistered


class FeatureManager(object):
    def __init__(self):
        self._registry = {}

    def all(self, feature_type=Feature):
        """
        Get a mapping of feature name -> feature class, optionally specific to a
        particular feature type.
        """
        return {k: v for k, v in self._registry.items() if v == feature_type}

    def add(self, name, cls=Feature):
        """
        Register a feature.

        The passed class is a Feature container object, this object can be used
        to encapsulate the context associated to a feature.

        >>> FeatureManager.has('my:feature', actor=request.user)
        """
        self._registry[name] = cls

    def get(self, name, *args, **kwargs):
        """
        Lookup a registered feature handler given the feature name.

        >>> FeatureManager.get('my:feature', actor=request.user)
        """
        try:
            cls = self._registry[name]
        except KeyError:
            raise FeatureNotRegistered(name)
        return cls(name, *args, **kwargs)

    def has(self, name, *args, **kwargs):
        """
        Determine if a feature is enabled.

        Features are checked in the following order:

        1. Execute Plugin feature handlers. Any plugin which returns a list of
           instantiated ``feature.handler.FeatureHandler`` objects will have
           each of their handlers executed in the order they are declared.

           When each handler is executed should the handler return None instead
           of True or False (feature enabled / disabled), the next registered
           plugin feature handler will be executed.

        2. The default configuration of the feature. This can be located in
           sentry.conf.server.SENTRY_FEATURES.

        Depending on the Feature class, additional arguments may need to be
        provided to assign organization or project context to the feature.

        >>> FeatureManager.has('organizations:feature', organization, actor=request.user)
        """
        return self.build_checker().has(name, *args, **kwargs)

    def build_checker(self):
        """
        Set up for a delayed execution of ``has``.

        Successive calls to the returned checker have better performance than
        repeatedly calling ``FeatureManager.has``, because it retains the set
        of ``feature.handler.FeatureHandler`` objects. An instance of the
        checker should be kept only in a short-lived context, because any
        dynamic changes to plugins' feature handlers are not reflected in its
        behavior.
        """
        return FeatureChecker(self)


class FeatureChecker(object):
    def __init__(self, manager):
        from sentry.plugins.base import plugins

        self.manager = manager

        handlers_per_plugin = [
            safe_execute(plugin.get_feature_hooks, _with_transaction=False) or ()
            for plugin in plugins.all(version=2)
        ]
        self.handlers = tuple(itertools.chain(*handlers_per_plugin))

    def has(self, name, *args, **kwargs):
        actor = kwargs.pop("actor", None)
        feature = self.manager.get(name, *args, **kwargs)

        # Check plugin feature handlers
        rv = self._get_plugin_value(feature, actor)
        if rv is not None:
            return rv

        rv = settings.SENTRY_FEATURES.get(feature.name, False)
        if rv is not None:
            return rv

        # Features are by default disabled if no plugin or default enables them
        return False

    def _get_plugin_value(self, feature, actor):
        for handler in self.handlers:
            rv = handler(feature, actor)
            if rv is not None:
                return rv
        return None

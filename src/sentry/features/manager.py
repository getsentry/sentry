from __future__ import absolute_import

__all__ = ["FeatureManager"]

from collections import defaultdict
from django.conf import settings

import sentry_sdk

from .base import Feature
from .exceptions import FeatureNotRegistered


class RegisteredFeatureManager(object):
    """
        Feature functions that are built around the need to register feature
        handlers

        TODO: Once features have been audited and migrated to the entity
        handler, remove this class entirely
    """

    def __init__(self):
        self._handler_registry = defaultdict(list)

    def add_handler(self, handler):
        """
        Register a feature handler.

        The passed object is a FeatureHandler that is associated with all
        features defined in the ``handler.features`` property.
        """
        for feature_name in handler.features:
            self._handler_registry[feature_name].append(handler)

    def _get_handler(self, feature, actor):
        for handler in self._handler_registry[feature.name]:
            rv = handler(feature, actor)
            if rv is not None:
                return rv
        return None

    def has_for_batch(self, name, organization, objects, actor=None):
        """
        Determine in a batch if a feature is enabled.

        This applies the same procedure as ``FeatureManager.has``, but with a
        performance benefit where the objects being checked all belong to the
        same organization. The objects are entities (e.g., projects) with the
        common parent organization, as would be passed individually to ``has``.

        Feature handlers that depend only on organization attributes, and not
        on attributes of the individual objects being checked, will generally
        perform faster if this method is used in preference to ``has``.

        The return value is a dictionary with the objects as keys. Each value
        is what would be returned if the key were passed to ``has``.

        The entity handler can handle both batch project/organization
        contexts so it'll likely have an entirely different implementation
        of this functionality.

        >>> FeatureManager.has_for_batch('projects:feature', organization, [project1, project2], actor=request.user)
        """

        result = dict()
        remaining = set(objects)

        handlers = self._handler_registry[name]
        for handler in handlers:
            if not remaining:
                break

            with sentry_sdk.start_span(
                op="feature.has_for_batch.handler",
                description="{0} ({1})".format(type(handler).__name__, name),
            ) as span:
                batch_size = len(remaining)
                span.set_data("Batch Size", batch_size)
                span.set_data("Feature Name", name)
                span.set_data("Handler Type", type(handler).__name__)

                batch = FeatureCheckBatch(self, name, organization, remaining, actor)
                handler_result = handler.has_for_batch(batch)
                for (obj, flag) in handler_result.items():
                    if flag is not None:
                        remaining.remove(obj)
                        result[obj] = flag
                span.set_data("Flags Found", batch_size - len(remaining))

        default_flag = settings.SENTRY_FEATURES.get(name, False)
        for obj in remaining:
            result[obj] = default_flag

        return result


# TODO: Change RegisteredFeatureManager back to object once it can be removed
class FeatureManager(RegisteredFeatureManager):
    def __init__(self):
        super(FeatureManager, self).__init__()
        self._feature_registry = {}
        self._entity_handler = None

    def all(self, feature_type=Feature):
        """
        Get a mapping of feature name -> feature class, optionally specific to a
        particular feature type.
        """
        return {k: v for k, v in self._feature_registry.items() if v == feature_type}

    def add(self, name, cls=Feature):
        """
        Register a feature.

        The passed class is a Feature container object, this object can be used
        to encapsulate the context associated to a feature.

        >>> FeatureManager.has('my:feature', actor=request.user)
        """
        self._feature_registry[name] = cls

    def _get_feature_class(self, name):
        try:
            return self._feature_registry[name]
        except KeyError:
            raise FeatureNotRegistered(name)

    def get(self, name, *args, **kwargs):
        """
        Lookup a registered feature context scope given the feature name.

        >>> FeatureManager.get('my:feature', actor=request.user)
        """
        cls = self._get_feature_class(name)
        return cls(name, *args, **kwargs)

    def add_entity_handler(self, handler):
        """
        Registers a handler that doesn't require a feature name match
        """
        self._entity_handler = handler

    def has(self, name, *args, **kwargs):
        """
        Determine if a feature is enabled. If a handler returns None, then the next
        mechanism is used for feature checking.

        Features are checked in the following order:

        1. Execute registered feature handlers. Any
           ``feature.handler.FeatureHandler`` objects that have been registered
           with ``add_handler` will be executed in the order they are declared.

           When each handler is executed, should the handler return None
           instead of True or False (feature enabled / disabled), the
           next registered feature handler will be executed.

        2. Check the entity handler, this handler doesn't check the handler registry,
           and eventually the entity handler will replace the need to register handlers
           for each feature.

           TODO: When this replaces registered feature handlers, the functions for
           registering and retrieving handlers should all be removed

        3. The default configuration of the feature. This can be located in
           sentry.conf.server.SENTRY_FEATURES.

        Depending on the Feature class, additional arguments may need to be
        provided to assign organization or project context to the feature.

        >>> FeatureManager.has('organizations:feature', organization, actor=request.user)

        """
        actor = kwargs.pop("actor", None)
        feature = self.get(name, *args, **kwargs)

        # Check registered feature handlers
        rv = self._get_handler(feature, actor)
        if rv is not None:
            return rv

        if self._entity_handler:
            rv = self._entity_handler.has(feature, actor)
            if rv is not None:
                return rv

        rv = settings.SENTRY_FEATURES.get(feature.name, False)
        if rv is not None:
            return rv

        # Features are by default disabled if no plugin or default enables them
        return False

    def batch_has(self, feature_names, actor, projects=None, organization=None):
        """
        Determine if multiple features are enabled. Unhandled flags will not be in
        the results if they cannot be handled.

        Will only accept one type of feature, either all ProjectFeatures or all
        OrganizationFeatures.
        """
        if self._entity_handler:
            return self._entity_handler.batch_has(
                feature_names, actor, projects=projects, organization=organization
            )
        else:
            return None


class FeatureCheckBatch(object):
    """
    A batch of objects to be checked for a feature flag.

    An instance of this class encapsulates a call to
    ``FeatureManager.has_for_batch``. The objects (such as projects) have a
    common parent organization.
    """

    def __init__(self, manager, name, organization, objects, actor):
        self._manager = manager
        self.feature_name = name
        self.organization = organization
        self.objects = objects
        self.actor = actor

    def get_feature_objects(self):
        """
        Iterate over individual Feature objects.

        This is a fallback mode for applying a FeatureHandler that doesn't
        support checking the entire batch at once.
        """

        cls = self._manager._get_feature_class(self.feature_name)
        return {obj: cls(self.feature_name, obj) for obj in self.objects}

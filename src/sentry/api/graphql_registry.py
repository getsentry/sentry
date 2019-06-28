from __future__ import absolute_import


class SentryRegistry(object):
    """
    A copy paste of the django-graphene one to skip the assertion on the type
    """

    def __init__(self):
        self._registry = {}
        self._field_registry = {}

    def register(self, cls):
        assert cls._meta.registry == self, "Registry for a Model have to match."
        if not getattr(cls._meta, "skip_registry", False):
            self._registry[cls._meta.model] = cls

    def get_type_for_model(self, model):
        return self._registry.get(model)

    def register_converted_field(self, field, converted):
        self._field_registry[field] = converted

    def get_converted_field(self, field):
        return self._field_registry.get(field)


registry = None


def get_global_registry():
    global registry
    if not registry:
        registry = SentryRegistry()
    return registry


def reset_global_registry():
    global registry
    registry = None

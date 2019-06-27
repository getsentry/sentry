from __future__ import absolute_import

from sentry.db.models.graphql_base import RootCardinality
import graphene
from graphene_django.types import construct_fields
from types import MethodType


class QueryMaster(graphene.ObjectType):
    def __init_subclass__(cls, **meta_options):
        for c in cls.graphql_types:
            def resolve_single(self, info, **kwargs):
                return c.MODEL_CLASS.resolve_single(info, **kwargs)

            def resolve_multi(self, info, **kwargs):
                return c.MODEL_CLASS.resolve_all(info, **kwargs)

            config = c.GRAPHQL_CONFIG
            type_name = config.type_name
            filter_fields = build_filter_fields(c.MODEL_CLASS, config.filter_fields)

            setattr(
                cls,
                type_name,
                graphene.Field(c, **filter_fields),
            )
            resolver_name = 'resolve_%s' % type_name
            if config.root_cardinality == RootCardinality.SINGLE:
                root_resolver = resolve_single
            elif config.root_cardinality == RootCardinality.MULTIPLE:
                root_resolver = resolve_multi
            else:
                raise

            setattr(cls, resolver_name, MethodType(root_resolver, None, cls))
        super(QueryMaster, cls).__init_subclass__(**meta_options)


def build_filter_fields(model_class, filter_field_names):
    fields = construct_fields(model_class, get_global_registry(), filter_field_names, [])
    for field in fields.values():
        # TODO: this is horrendous. There must be a more reasonable way to do this
        # without rewriting the whole graphene
        if 'required' in field.kwargs:
            field.kwargs['required'] = False
    return fields


class SentryRegistry(object):
    """
    A copy paste of the django-graphene one to skip the assertion on the type
    """

    def __init__(self):
        self._registry = {}
        self._field_registry = {}

    def register(self, cls):
        assert cls._meta.registry == self, "Registry for a Model have to match."
        # assert self.get_type_for_model(cls._meta.model) == cls, (
        #     'Multiple DjangoObjectTypes registered for "{}"'.format(cls._meta.model)
        # )
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

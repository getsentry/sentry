from __future__ import absolute_import

from sentry.db.models.graphql_base import RootCardinality
import graphene
from graphene_django.types import construct_fields
from graphene_django.registry import get_global_registry
from types import MethodType


class QueryMaster(graphene.ObjectType):
    def __init_subclass__(cls, **meta_options):
        for c in cls.graphql_types:
            def resolve_single(self, info, **kwargs):
                return c.MODEL_CLASS.resolve_single(info, **kwargs)

            def resolve_multi(self, info, **kwargs):
                return c.MODEL_CLASS.resolve_all(info, **kwargs)

            config = c.GRAPHQL_CONFIG
            type_name = config['type_name']
            if config['filter_fields']:
                filter_fields = build_filter_fields(c.MODEL_CLASS, config['filter_fields'])
            else:
                filter_fields = {}

            setattr(
                cls,
                type_name,
                graphene.Field(c, **filter_fields),
            )
            resolver_name = 'resolve_%s' % type_name
            if config['root_cardinality'] == RootCardinality.SINGLE:
                root_resolver = resolve_single
            elif config['root_cardinality'] == RootCardinality.MULTIPLE:
                root_resolver = resolve_multi
            else:
                raise

            setattr(cls, resolver_name, MethodType(root_resolver, None, cls))
        super(QueryMaster, cls).__init_subclass__(**meta_options)


def build_filter_fields(model_class, filter_field_names):
    fields = construct_fields(model_class, get_global_registry(), filter_field_names, [])
    return fields

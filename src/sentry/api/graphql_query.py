from __future__ import absolute_import

from sentry.db.models.graphql_base import RootCardinality
from sentry.api.graphql_registry import get_global_registry
import graphene

from functools import partial
from graphene_django.types import construct_fields
from types import MethodType


class QueryMaster(graphene.ObjectType):
    def __init_subclass__(cls, **meta_options):
        for c in cls.graphql_types:

            def resolve_single(c, self, info, **kwargs):
                return c.MODEL_CLASS.resolve_single(info, **kwargs)

            def resolve_multi(c, self, info, **kwargs):
                return c.MODEL_CLASS.resolve_all(info, **kwargs)

            config = c.GRAPHQL_CONFIG
            type_name = config.type_name

            from sentry.api.graphql_type import SentryGraphQLType
            if issubclass(c, SentryGraphQLType):
                filter_fields = build_filter_fields(c.MODEL_CLASS, config.filter_fields)
            else:
                filter_fields = config.filter_fields
                fields_def = config.fields_desc
                filter_fields = {k: v for k, v in fields_def.items() if k in filter_fields}

            if config.root_cardinality == RootCardinality.SINGLE:
                type_cls = graphene.Field(c, **filter_fields)
            else:
                type_cls = graphene.Field(graphene.List(c), **filter_fields)

            setattr(
                cls,
                type_name,
                type_cls,
            )
            resolver_name = 'resolve_%s' % type_name
            if config.root_cardinality == RootCardinality.SINGLE:
                root_resolver = partial(resolve_single, c)
            elif config.root_cardinality == RootCardinality.MULTIPLE:
                root_resolver = partial(resolve_multi, c)
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

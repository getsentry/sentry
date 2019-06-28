from __future__ import absolute_import

from collections import OrderedDict

from graphene.types.objecttype import ObjectType, ObjectTypeOptions
from graphene.types.utils import yank_fields_from_attrs
from sentry.api.graphql_registry import get_global_registry, SentryRegistry

from graphene import Field


class SentryGraphQLSimpleType(ObjectType):
    @classmethod
    def __init_subclass_with_meta__(
        cls,
        model=None,
        registry=None,
        skip_registry=False,
        filter_fields=None,
        connection=None,
        connection_class=None,
        use_connection=None,
        interfaces=(),
        _meta=None,
        **options
    ):
        if not registry:
            registry = get_global_registry()

        assert isinstance(registry, SentryRegistry), (
            "The attribute registry in {} needs to be an instance of "
            'Registry, received "{}".'
        ).format(cls.__name__, registry)

        assert hasattr(model, 'graphql_config'), "Model %s is missing graphql config" % model

        config = model.graphql_config

        # build the local fields

        # super_class = super(cls, cls)
        # super_class.__process_fk__(model, config.only_fields, config.exclude_fields)

        if not _meta:
            _meta = ObjectTypeOptions(cls)

        _meta.model = model
        _meta.registry = registry
        _meta.filter_fields = filter_fields
        fields = OrderedDict(config.fields_desc)
        _meta.fields = yank_fields_from_attrs(fields, _as=Field)

        cls.GRAPHQL_CONFIG = config
        cls.MODEL_CLASS = model
        super(SentryGraphQLSimpleType, cls).__init_subclass_with_meta__(
            _meta=_meta, interfaces=interfaces, **options
        )

        if not skip_registry:
            registry.register(cls)

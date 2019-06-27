from __future__ import absolute_import
from django.utils.functional import SimpleLazyObject

from graphene.types.objecttype import ObjectType
from graphene_django.registry import Registry, get_global_registry
from graphene_django.utils import is_valid_django_model
from graphene.types.utils import yank_fields_from_attrs
from graphene_django.types import construct_fields, DjangoObjectTypeOptions
from graphene import Field


class SentryGraphQLType(ObjectType):
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
        assert is_valid_django_model(model), (
            'You need to pass a valid Django Model in {}.Meta, received "{}".'
        ).format(cls.__name__, model)

        if not registry:
            registry = get_global_registry()

        assert isinstance(registry, Registry), (
            "The attribute registry in {} needs to be an instance of "
            'Registry, received "{}".'
        ).format(cls.__name__, registry)

        assert hasattr(model, 'graphql_config'), "Model %s is missing graphql config" % model

        config = model.graphql_config
        only_fields = config.get('only_fields', ())
        exclude_fields = config.get('exclude_fields', ())
        django_fields = yank_fields_from_attrs(
            construct_fields(model, registry, only_fields, exclude_fields), _as=Field
        )
        if not _meta:
            _meta = DjangoObjectTypeOptions(cls)

        _meta.model = model
        _meta.registry = registry
        _meta.filter_fields = filter_fields
        _meta.fields = django_fields
        _meta.connection = connection

        cls.GRAPHQL_CONFIG = config
        cls.MODEL_CLASS = model
        super(SentryGraphQLType, cls).__init_subclass_with_meta__(
            _meta=_meta, interfaces=interfaces, **options
        )

        # if not skip_registry:
        #    registry.register(cls)

    def resolve_id(self, info):
        return self.pk

    @classmethod
    def is_type_of(cls, root, info):
        if isinstance(root, SimpleLazyObject):
            root._setup()
            root = root._wrapped
        if isinstance(root, cls):
            return True
        if not is_valid_django_model(type(root)):
            raise Exception(('Received incompatible instance "{}".').format(root))

        model = root._meta.model._meta.concrete_model
        return model == cls._meta.model

    @classmethod
    def get_node(cls, info, id):
        try:
            return cls._meta.model.objects.get(pk=id)
        except cls._meta.model.DoesNotExist:
            return None

from __future__ import absolute_import

import importlib

from enum import IntEnum
from sentry.db.models.base import Model


class RootCardinality(IntEnum):
    NONE = 0
    SINGLE = 1
    MULTIPLE = 2


class GraphQLBaseConfig(object):
    def __init__(self,
                 type_name,
                 edges=None,
                 permission_policy=None,
                 filter_fields=(),
                 root_cardinality=RootCardinality.NONE,
                 ):
        self.type_name = type_name
        self.filter_fields = filter_fields
        self.root_cardinality = root_cardinality
        self.permission_policy = permission_policy
        self.edges = edges or {}


class GraphQLDjangoConfig(GraphQLBaseConfig):
    def __init__(self,
                 type_name,
                 only_fields,
                 edges=None,
                 permission_policy=None,
                 filter_fields=(),
                 exclude_fields=(),
                 root_cardinality=RootCardinality.NONE,
                 enum_mapping=None,
                 ):
        super(GraphQLDjangoConfig, self).__init__(
            type_name=type_name,
            edges=edges,
            permission_policy=permission_policy,
            filter_fields=filter_fields,
            root_cardinality=root_cardinality,
        )
        self.enum_mapping = enum_mapping or {}
        self.only_fields = only_fields
        self.exclude_fields = exclude_fields


class GraphQLSimpleConfig(GraphQLBaseConfig):
    def __init__(self,
                 type_name,
                 fields_desc,
                 permission_policy=None,
                 filter_fields=(),
                 root_cardinality=RootCardinality.NONE,
                 ):
        super(GraphQLSimpleConfig, self).__init__(
            type_name=type_name,
            permission_policy=permission_policy,
            filter_fields=filter_fields,
            root_cardinality=root_cardinality,
        )
        self.fields_desc = fields_desc


class GraphQLModelBase(object):
    graphql_config = None

    @classmethod
    def resolve_single(cls, info, **kwargs):
        raise NotImplemented("You need to implement resolve_single to make it work")

    @classmethod
    def resolve_all(cls, info, **kwargs):
        raise NotImplemented("You need to implement resolve_all to make it work")

    @classmethod
    def resolve_fk(cls, identity, info, **kwargs):
        raise NotImplemented("You need to implement resolve_fk to make it work")


class GraphQLModel(Model, GraphQLModelBase):

    class Meta:
        abstract = True

    @classmethod
    def resolve_single(cls, info, **kwargs):
        ret = cls._resolve(info, {}, **kwargs)
        return ret[0] if ret else None

    @classmethod
    def resolve_all(cls, info, **kwargs):
        return cls._resolve(info, {}, **kwargs)

    @classmethod
    def resolve_fk(cls, identity, info, **kwargs):
        return cls._resolve(
            info,
            identity,
            **kwargs
        )

    @classmethod
    def _resolve(cls, info, identity, **kwargs):
        assert cls.graphql_config, "Cannot load anything without config"
        filter_fields = cls.graphql_config.filter_fields
        query_params = {k: kwargs[k] for k in filter_fields if k in kwargs}
        query_params = dict(identity, **query_params)
        if not query_params:
            ret = cls.objects.all()
        else:
            ret = cls.objects.filter(**query_params)

        policy_name = cls.graphql_config.permission_policy
        if not ret or not policy_name:
            return ret

        module_name, class_name = policy_name.rsplit(".", 1)
        module = importlib.import_module(module_name)
        assert hasattr(module, class_name), "Permission policy %s not found" % class_name
        class_obj = getattr(module, class_name)
        policy = class_obj()

        return [obj for obj in ret if policy.has_object_permission(info.context, None, obj)]

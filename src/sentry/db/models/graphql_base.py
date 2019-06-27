from __future__ import absolute_import

from enum import IntEnum
from sentry.db.models.base import Model


class RootCardinality(IntEnum):
    NONE = 0
    SINGLE = 1
    MULTIPLE = 2


class GraphQLModel(Model):
    graphql_config = None

    class Meta:
        abstract = True

    @classmethod
    def resolve_single(cls, info, **kwargs):
        ret = cls._resolve(info, **kwargs)
        return ret[0] if ret else None

    @classmethod
    def resolve_all(cls, info, **kwargs):
        return cls._resolve(info, **kwargs)

    @classmethod
    def _resolve(cls, info, **kwargs):
        assert cls.graphql_config, "Cannot load anything without config"
        filter_fields = cls.graphql_config['filter_fields']
        query_params = {k: kwargs[k] for k in filter_fields if k in kwargs}

        if not query_params:
            return cls.objects.all()
        else:
            return cls.objects.filter(**query_params)

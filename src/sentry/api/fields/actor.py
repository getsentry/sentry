from __future__ import annotations

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.utils.actor import parse_and_validate_actor


@extend_schema_field(field=OpenApiTypes.STR)
class ActorField(serializers.Field):
    def __init__(self, *args, **kwds):
        self.as_actor = kwds.pop("as_actor", False)
        super().__init__(*args, **kwds)

    def to_representation(self, value):
        return value.identifier

    def to_internal_value(self, data):
        actor_tuple = parse_and_validate_actor(data, self.context["organization"].id)

        if self.as_actor and actor_tuple:
            return actor_tuple.resolve_to_actor()
        return actor_tuple

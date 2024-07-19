from __future__ import annotations

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.types.actor import Actor, parse_and_validate_actor


@extend_schema_field(field=OpenApiTypes.STR)
class ActorField(serializers.Field):
    def __init__(self, *args, **kwds):
        super().__init__(*args, **kwds)

    def to_representation(self, value):
        return value.identifier

    def to_internal_value(self, data) -> Actor | None:
        return parse_and_validate_actor(data, self.context["organization"].id)

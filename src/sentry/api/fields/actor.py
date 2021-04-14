from rest_framework import serializers

from sentry.models import ActorTuple


class ActorField(serializers.Field):
    def to_representation(self, value):
        return value.get_actor_identifier()

    def to_internal_value(self, data):
        if not data:
            return None

        try:
            return ActorTuple.from_actor_identifier(data)
        except Exception:
            raise serializers.ValidationError("Unknown actor input")

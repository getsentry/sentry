from __future__ import annotations

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.models.actor import ActorTuple
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.models.user import User


@extend_schema_field(field=OpenApiTypes.STR)
class ActorField(serializers.Field):
    def __init__(self, *args, **kwds):
        self.as_actor = kwds.pop("as_actor", False)
        super().__init__(*args, **kwds)

    def to_representation(self, value):
        return value.get_actor_identifier()

    def to_internal_value(self, data):
        if not data:
            return None

        try:
            actor = ActorTuple.from_actor_identifier(data)
        except Exception:
            raise serializers.ValidationError(
                "Could not parse actor. Format should be `type:id` where type is `team` or `user`."
            )
        try:
            obj = actor.resolve()
        except (Team.DoesNotExist, User.DoesNotExist):
            raise serializers.ValidationError(f"{actor.type.__name__} does not exist")

        if actor.type == Team:
            if obj.organization != self.context["organization"]:
                raise serializers.ValidationError("Team is not a member of this organization")
        elif actor.type == User:
            if not OrganizationMember.objects.filter(
                organization=self.context["organization"], user_id=obj.id
            ).exists():
                raise serializers.ValidationError("User is not a member of this organization")

        if self.as_actor:
            return actor.resolve_to_actor()
        return actor

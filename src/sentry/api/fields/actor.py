from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework import serializers

from sentry.models import ActorTuple, OrganizationMember, Team, User

if TYPE_CHECKING:
    from sentry.services.hybrid_cloud.user import RpcUser


class ActorField(serializers.Field):
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
            obj: RpcUser | Team = actor.resolve()
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
        return actor

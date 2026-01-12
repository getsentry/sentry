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


@extend_schema_field(field=OpenApiTypes.STR)
class OwnerActorField(ActorField):
    """
    ActorField variant for owner assignment that validates team membership.

    When assigning a team as owner, validates that the requesting user either:
    - Has team:admin scope, OR
    - Is a member of the team being assigned

    This prevents IDOR vulnerabilities where users could assign teams they
    don't belong to as owners when Open Team Membership is disabled.
    """

    def to_internal_value(self, data) -> Actor | None:
        actor = super().to_internal_value(data)

        if actor is None:
            return actor

        if actor.is_team:
            self._validate_team_assignment(actor)

        return actor

    def _validate_team_assignment(self, actor: Actor) -> None:
        from sentry.models.organizationmemberteam import OrganizationMemberTeam

        request = self.context.get("request")

        # Users with team:admin scope can assign any team
        if request and request.access.has_scope("team:admin"):
            return

        # Fail closed if we can't verify the user
        if not request or not getattr(request, "user", None):
            raise serializers.ValidationError("You do not have permission to assign this owner")

        # Check if user is a member of the team
        user_is_team_member = OrganizationMemberTeam.objects.filter(
            team_id=actor.id,
            organizationmember__user_id=request.user.id,
            is_active=True,
        ).exists()

        if not user_is_team_member:
            raise serializers.ValidationError("You do not have permission to assign this owner")

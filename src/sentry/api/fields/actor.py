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
    - Is a member of the team being assigned, OR
    - Is a member of the currently assigned team (can reassign from their team)

    This prevents IDOR vulnerabilities where users could assign teams they
    don't belong to as owners when Open Team Membership is disabled.

    Context options:
    - current_owner: Actor | None - the current owner, used to allow reassignment
      from a team the user belongs to
    - skip_team_validation: bool - if True, skip team membership validation
      (useful when validation will be done later with full context, e.g., bulk updates)
    """

    def to_internal_value(self, data) -> Actor | None:
        actor = super().to_internal_value(data)

        if actor is None:
            return actor

        if actor.is_team:
            # Skip validation if explicitly requested (e.g., for bulk updates
            # where validation happens later with full group context)
            if not self.context.get("skip_team_validation"):
                self._validate_team_assignment(actor)

        return actor

    def _validate_team_assignment(self, actor: Actor) -> None:
        from sentry.models.organizationmemberteam import OrganizationMemberTeam

        request = self.context.get("request")
        # Check for access in context directly for background tasks or on request for API requests
        access = self.context.get("access") or getattr(request, "access", None)

        # Users with team:admin scope can assign any team
        # SystemAccess (used in background tasks) returns True for all scopes
        if access and access.has_scope("team:admin"):
            return

        # Try to get user from context directly or from request
        user = self.context.get("user") or getattr(request, "user", None)

        # Fail closed
        if not user:
            raise serializers.ValidationError("You do not have permission to assign this owner")

        # Check if user is a member of the target team
        user_is_target_team_member = OrganizationMemberTeam.objects.filter(
            team_id=actor.id,
            organizationmember__user_id=user.id,
            is_active=True,
        ).exists()

        if user_is_target_team_member:
            return

        # Check if user is a member of the currently assigned team (can reassign from their team)
        current_owner = self.context.get("current_owner")
        if current_owner and current_owner.is_team:
            user_is_current_team_member = OrganizationMemberTeam.objects.filter(
                team_id=current_owner.id,
                organizationmember__user_id=user.id,
                is_active=True,
            ).exists()
            if user_is_current_team_member:
                return

        raise serializers.ValidationError("You do not have permission to assign this owner")

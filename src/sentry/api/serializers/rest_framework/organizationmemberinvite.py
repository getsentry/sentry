from django.db.models import Q
from rest_framework import serializers

from sentry import features
from sentry.api.endpoints.organization_member.utils import (
    ROLE_CHOICES,
    MemberConflictValidationError,
)
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberinvite import InviteStatus, OrganizationMemberInvite
from sentry.models.team import Team, TeamStatus
from sentry.roles import organization_roles
from sentry.users.api.parsers.email import AllowedEmailField
from sentry.users.services.user.service import user_service


class OrganizationMemberInviteRequestValidator(serializers.Serializer):
    email = AllowedEmailField(
        max_length=75, required=True, help_text="The email address to send the invitation to."
    )
    orgRole = serializers.ChoiceField(
        choices=ROLE_CHOICES,
        default=organization_roles.get_default().id,
        required=False,
        help_text="The organization-level role of the new member. Roles include:",  # choices will follow in the docs
    )
    teams = serializers.ListField(required=False, allow_null=False, default=[])

    def validate_email(self, email):
        users = user_service.get_many_by_email(
            emails=[email],
            is_active=True,
            organization_id=self.context["organization"].id,
            is_verified=False,
        )
        member_queryset = OrganizationMember.objects.filter(
            Q(user_id__in=[u.id for u in users]),
            organization=self.context["organization"],
        )

        if member_queryset.exists():
            raise MemberConflictValidationError("The user %s is already a member" % email)

        # check for existing invites
        invite_queryset = OrganizationMemberInvite.objects.filter(
            Q(email=email),
            organization=self.context["organization"],
        )
        if invite_queryset.filter(invite_status=InviteStatus.APPROVED.value).exists():
            raise MemberConflictValidationError("The user %s has already been invited" % email)

        if invite_queryset.filter(
            Q(invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value)
            | Q(invite_status=InviteStatus.REQUESTED_TO_JOIN.value)
        ).exists():
            raise MemberConflictValidationError(
                "There is an existing invite request for %s" % email
            )

        return email

    def validate_orgRole(self, role):
        if role == "billing" and features.has(
            "organizations:invite-billing", self.context["organization"]
        ):
            return role

        allowed_roles = self.context["allowed_roles"]
        # We allow requests from integration tokens to invite new members as the member role only
        if not allowed_roles and self.context.get("is_integration_token", False):
            allowed_roles = [organization_roles.get("member")]
        # Error if the assigned role is not a member and the request is made via integration token
        if self.context.get("is_integration_token", False) and role != "member":
            raise serializers.ValidationError(
                "Integration tokens are restricted to inviting new members with the member role only."
            )

        role_obj = next((r for r in allowed_roles if r.id == role), None)
        if role_obj is None:
            raise serializers.ValidationError(
                "You do not have permission to invite a member with that org-level role"
            )
        if not self.context.get("allow_retired_roles", True) and role_obj.is_retired:
            raise serializers.ValidationError(
                f"The role '{role}' is deprecated, and members may no longer be invited with it."
            )
        return role

    def validate_teams(self, teams):
        valid_teams = list(
            Team.objects.filter(
                organization=self.context["organization"], status=TeamStatus.ACTIVE, slug__in=teams
            )
        )

        if len(valid_teams) != len(teams):
            raise serializers.ValidationError("Invalid teams")

        organization = self.context["organization"]

        members_can_only_invite_to_members_teams = (
            not organization.flags.allow_joinleave and not organization.flags.disable_member_invite
        )
        has_teams = bool(valid_teams)

        if (
            self.context.get("is_member", False)
            and members_can_only_invite_to_members_teams
            and has_teams
        ):
            requester_teams = set(
                OrganizationMember.objects.filter(
                    organization=organization,
                    user_id=self.context["actor"].id,
                    user_is_active=True,
                ).values_list("teams__slug", flat=True)
            )
            team_slugs = [team.slug for team in valid_teams]
            # ensure that the requester is a member of all teams they are trying to assign
            if not requester_teams.issuperset(team_slugs):
                raise serializers.ValidationError(
                    "You cannot assign members to teams you are not a member of."
                )

        if (
            has_teams
            and not organization_roles.get(self.initial_data.get("orgRole")).is_team_roles_allowed
        ):
            raise serializers.ValidationError(
                f"The user with a '{self.initial_data.get("orgRole")}' role cannot have team-level permissions."
            )

        return valid_teams

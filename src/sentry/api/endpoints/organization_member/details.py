from __future__ import annotations

from django.db import transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features, ratelimits, roles
from sentry.api.bases import OrganizationMemberEndpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization_member import OrganizationMemberWithRolesSerializer
from sentry.api.serializers.rest_framework import ListField
from sentry.apidocs.constants import (
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOTFOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GLOBAL_PARAMS
from sentry.auth.superuser import is_active_superuser
from sentry.models import (
    AuthIdentity,
    AuthProvider,
    InviteStatus,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    Project,
    Team,
    TeamStatus,
    UserOption,
)
from sentry.roles import organization_roles, team_roles
from sentry.utils import metrics

from . import get_allowed_roles

ERR_NO_AUTH = "You cannot remove this member with an unauthenticated API request."
ERR_INSUFFICIENT_ROLE = "You cannot remove a member who has more access than you."
ERR_INSUFFICIENT_SCOPE = "You are missing the member:admin scope."
ERR_ONLY_OWNER = "You cannot remove the only remaining owner of the organization."
ERR_UNINVITABLE = "You cannot send an invitation to a user who is already a full member."
ERR_EXPIRED = "You cannot resend an expired invitation without regenerating the token."
ERR_RATE_LIMITED = "You are being rate limited for too many invitations."

MEMBER_ID_PARAM = OpenApiParameter(
    name="member_id",
    description="The member ID.",
    required=True,
    type=str,
    location="path",
)


class OrganizationMemberSerializer(serializers.Serializer):
    reinvite = serializers.BooleanField()
    regenerate = serializers.BooleanField()
    role = serializers.ChoiceField(choices=roles.get_choices(), required=True)
    teams = ListField(required=False, allow_null=False)


class RelaxedMemberPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "POST": ["member:write", "member:admin"],
        "PUT": ["member:write", "member:admin"],
        # DELETE checks for role comparison as you can either remove a member
        # with a lower access role, or yourself, without having the req. scope
        "DELETE": ["member:read", "member:write", "member:admin"],
    }

    # Allow deletions to happen for disabled members so they can remove themselves
    # allowing other methods should be fine as well even if we don't strictly need to allow them
    def is_member_disabled_from_limit(self, request: Request, organization):
        return False


@extend_schema(tags=["Organizations"])
class OrganizationMemberDetailsEndpoint(OrganizationMemberEndpoint):
    permission_classes = [RelaxedMemberPermission]
    public = {"GET", "DELETE"}

    def _get_member(
        self,
        request: Request,
        organization: Organization,
        member_id: int | str,
        invite_status: InviteStatus | None = None,
    ) -> OrganizationMember:
        try:
            return super()._get_member(
                request, organization, member_id, invite_status=InviteStatus.APPROVED
            )
        except ValueError:
            raise OrganizationMember.DoesNotExist()

    @extend_schema(
        operation_id="Retrieve an Organization Member",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            MEMBER_ID_PARAM,
        ],
        responses={
            200: OrganizationMemberWithRolesSerializer,  # The Sentry response serializer
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def get(
        self,
        request: Request,
        organization: Organization,
        member: OrganizationMember,
    ) -> Response:
        """
        Retrieve an organization member's details.

        Will return a pending invite as long as it's already approved.
        """
        allowed_roles = get_allowed_roles(request, organization, member)
        return Response(
            serialize(
                member,
                request.user,
                OrganizationMemberWithRolesSerializer(allowed_roles),
            )
        )

    # TODO:
    # @extend_schema(
    #     operation_id="Update a Organization Member's details",
    #     parameters=[
    #         GLOBAL_PARAMS.ORG_SLUG,
    #         MEMBER_ID_PARAM,
    #     ],
    #     responses={
    #         200: OrganizationMemberWithRolesSerializer,  # The Sentry response serializer
    #         401: RESPONSE_UNAUTHORIZED,
    #         403: RESPONSE_FORBIDDEN,
    #         404: RESPONSE_NOTFOUND,
    #     },
    # )
    def put(
        self,
        request: Request,
        organization: Organization,
        member: OrganizationMember,
    ) -> Response:
        serializer = OrganizationMemberSerializer(data=request.data, partial=True)

        if not serializer.is_valid():
            return Response(status=400)

        try:
            auth_provider = AuthProvider.objects.get(organization=organization)
            auth_provider = auth_provider.get_provider()
        except AuthProvider.DoesNotExist:
            auth_provider = None

        allowed_roles = get_allowed_roles(request, organization)
        result = serializer.validated_data

        # XXX(dcramer): if/when this expands beyond reinvite we need to check
        # access level
        if result.get("reinvite"):
            if member.is_pending:
                if ratelimits.for_organization_member_invite(
                    organization=organization,
                    email=member.email,
                    user=request.user,
                    auth=request.auth,
                ):
                    metrics.incr(
                        "member-invite.attempt",
                        instance="rate_limited",
                        skip_internal=True,
                        sample_rate=1.0,
                    )
                    return Response({"detail": ERR_RATE_LIMITED}, status=429)

                if result.get("regenerate"):
                    if request.access.has_scope("member:admin"):
                        member.regenerate_token()
                        member.save()
                    else:
                        return Response({"detail": ERR_INSUFFICIENT_SCOPE}, status=400)
                if member.token_expired:
                    return Response({"detail": ERR_EXPIRED}, status=400)
                member.send_invite_email()
            elif auth_provider and not getattr(member.flags, "sso:linked"):
                member.send_sso_link_email(request.user, auth_provider)
            else:
                # TODO(dcramer): proper error message
                return Response({"detail": ERR_UNINVITABLE}, status=400)

        if "teams" in result:
            # dupe code from member_index
            # ensure listed teams are real teams
            teams = list(
                Team.objects.filter(
                    organization=organization, status=TeamStatus.VISIBLE, slug__in=result["teams"]
                )
            )

            if len(set(result["teams"])) != len(teams):
                return Response({"teams": "Invalid team"}, status=400)

            with transaction.atomic():
                # teams may be empty
                OrganizationMemberTeam.objects.filter(organizationmember=member).delete()
                OrganizationMemberTeam.objects.bulk_create(
                    [OrganizationMemberTeam(team=team, organizationmember=member) for team in teams]
                )

        assigned_role = result.get("role")
        if assigned_role:
            allowed_roles = get_allowed_roles(request, organization)
            allowed_role_ids = {r.id for r in allowed_roles}

            # A user cannot promote others above themselves
            if assigned_role not in allowed_role_ids:
                return Response(
                    {"role": "You do not have permission to assign the given role."}, status=403
                )

            # A user cannot demote a superior
            if member.role not in allowed_role_ids:
                return Response(
                    {"role": "You do not have permission to assign a role to the given user."},
                    status=403,
                )

            if member.user == request.user and (assigned_role != member.role):
                return Response({"detail": "You cannot make changes to your own role."}, status=400)

            if (
                organization_roles.get(assigned_role).is_retired
                and assigned_role != member.role
                and features.has("organizations:team-roles", organization)
            ):
                message = f"The role '{assigned_role}' is deprecated and may no longer be assigned."
                return Response({"detail": message}, status=400)

            self._change_org_member_role(member, assigned_role)

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=member.id,
            target_user=member.user,
            event=audit_log.get_event_id("MEMBER_EDIT"),
            data=member.get_audit_log_data(),
        )

        return Response(
            serialize(
                member,
                request.user,
                OrganizationMemberWithRolesSerializer(
                    allowed_roles=allowed_roles,
                ),
            )
        )

    @staticmethod
    def _change_org_member_role(member: OrganizationMember, role: str) -> None:
        new_minimum_team_role = roles.get_minimum_team_role(role)
        lesser_team_roles = [
            r.id for r in team_roles.get_all() if r.priority <= new_minimum_team_role.priority
        ]

        with transaction.atomic():
            # If the member has any existing team roles that are less than or equal
            # to their new minimum role, overwrite the redundant team roles with
            # null. We do this because such a team role would be effectively
            # invisible in the UI, and would be surprising if it were left behind
            # after the user's org role is lowered again.
            omt_update_count = OrganizationMemberTeam.objects.filter(
                organizationmember=member, role__in=lesser_team_roles
            ).update(role=None)

            member.update(role=role)

        if omt_update_count > 0:
            metrics.incr(
                "team_roles.update_to_minimum",
                tags={"target_org_role": role, "count": omt_update_count},
            )

    @extend_schema(
        operation_id="Delete an Organization Member",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            MEMBER_ID_PARAM,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def delete(
        self,
        request: Request,
        organization: Organization,
        member: OrganizationMember,
    ) -> Response:
        """
        Remove an organization member.
        """

        if request.user.is_authenticated and not is_active_superuser(request):
            try:
                acting_member = OrganizationMember.objects.get(
                    organization=organization, user=request.user
                )
            except OrganizationMember.DoesNotExist:
                return Response({"detail": ERR_INSUFFICIENT_ROLE}, status=400)
            else:
                if acting_member != member:
                    if not request.access.has_scope("member:admin"):
                        return Response({"detail": ERR_INSUFFICIENT_SCOPE}, status=400)
                    elif not roles.can_manage(acting_member.role, member.role):
                        return Response({"detail": ERR_INSUFFICIENT_ROLE}, status=400)

        # TODO(dcramer): do we even need this check?
        elif not request.access.has_scope("member:admin"):
            return Response({"detail": ERR_INSUFFICIENT_SCOPE}, status=400)

        if member.is_only_owner():
            return Response({"detail": ERR_ONLY_OWNER}, status=403)

        audit_data = member.get_audit_log_data()

        with transaction.atomic():
            AuthIdentity.objects.filter(
                user=member.user, auth_provider__organization=organization
            ).delete()

            # Delete instances of `UserOption` that are scoped to the projects within the
            # organization when corresponding member is removed from org
            proj_list = Project.objects.filter(organization=organization).values_list(
                "id", flat=True
            )
            uo_list = UserOption.objects.filter(
                user=member.user, project_id__in=proj_list, key="mail:email"
            )
            for uo in uo_list:
                uo.delete()

            member.delete()

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=member.id,
            target_user=member.user,
            event=audit_log.get_event_id("MEMBER_REMOVE"),
            data=audit_data,
        )

        return Response(status=204)

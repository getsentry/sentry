from __future__ import annotations

from django.db import transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features, ratelimits, roles
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationMemberEndpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization_member import OrganizationMemberWithRolesSerializer
from sentry.apidocs.constants import (
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOTFOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GLOBAL_PARAMS
from sentry.auth.superuser import is_active_superuser
from sentry.models import (
    AuthProvider,
    InviteStatus,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    Project,
    UserOption,
)
from sentry.roles import organization_roles, team_roles
from sentry.utils import metrics

from . import InvalidTeam, get_allowed_org_roles, save_team_assignments
from .index import OrganizationMemberSerializer

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
@region_silo_endpoint
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
        allowed_roles = get_allowed_org_roles(request, organization, member)
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
        allowed_roles = get_allowed_org_roles(request, organization)
        serializer = OrganizationMemberSerializer(
            data=request.data,
            partial=True,
            context={
                "organization": organization,
                "allowed_roles": allowed_roles,
            },
        )

        if not serializer.is_valid():
            return Response(status=400)

        try:
            auth_provider = AuthProvider.objects.get(organization_id=organization.id)
            auth_provider = auth_provider.get_provider()
        except AuthProvider.DoesNotExist:
            auth_provider = None

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
                        region_outbox = None
                        with transaction.atomic():
                            member.regenerate_token()
                            member.save()
                            region_outbox = member.save_outbox_for_update()
                        if region_outbox:
                            region_outbox.drain_shard(max_updates_to_drain=10)
                    else:
                        return Response({"detail": ERR_INSUFFICIENT_SCOPE}, status=400)
                if member.token_expired:
                    return Response({"detail": ERR_EXPIRED}, status=400)
                member.send_invite_email()
            elif auth_provider and not getattr(member.flags, "sso:linked"):
                member.send_sso_link_email(request.user.id, auth_provider)
            else:
                # TODO(dcramer): proper error message
                return Response({"detail": ERR_UNINVITABLE}, status=400)

        # Set the team-role before org-role. If the org-role has elevated permissions
        # on the teams, the team-roles can be overwritten later
        if "teamRoles" in result or "teams" in result:
            try:
                if "teamRoles" in result:
                    # If orgs do not have the flag, we'll set their team-roles to None
                    team_roles = (
                        result.get("teamRoles")
                        if features.has("organizations:team-roles", organization)
                        else [(team, None) for team, _ in result.get("teamRoles", [])]
                    )
                    save_team_assignments(member, None, team_roles)
                elif "teams" in result:
                    save_team_assignments(member, result.get("teams"))
            except InvalidTeam:
                return Response({"teams": "Invalid team"}, status=400)

        assigned_org_role = result.get("orgRole") or result.get("role")
        is_update_org_role = assigned_org_role and assigned_org_role != member.role

        if is_update_org_role:
            if getattr(member.flags, "idp:role-restricted"):
                return Response(
                    {
                        "role": "This user's org-role is managed through your organization's identity provider."
                    },
                    status=403,
                )

            allowed_role_ids = {r.id for r in allowed_roles}

            # A user cannot promote others above themselves
            if assigned_org_role not in allowed_role_ids:
                return Response(
                    {"role": "You do not have permission to assign the given role."}, status=403
                )

            # A user cannot demote a superior
            if member.role not in allowed_role_ids:
                return Response(
                    {"role": "You do not have permission to assign a role to the given user."},
                    status=403,
                )

            if member.user == request.user and (assigned_org_role != member.role):
                return Response({"detail": "You cannot make changes to your own role."}, status=400)

            if (
                features.has("organizations:team-roles", organization)
                and organization_roles.get(assigned_org_role).is_retired
                and assigned_org_role != member.role
            ):
                message = (
                    f"The role '{assigned_org_role}' is deprecated and may no longer be assigned."
                )
                return Response({"detail": message}, status=400)

            self._change_org_role(member, assigned_org_role)

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
    def _change_org_role(member: OrganizationMember, role: str) -> None:
        new_minimum_team_role = roles.get_minimum_team_role(role)
        lesser_team_roles = [
            r.id for r in team_roles.get_all() if r.priority <= new_minimum_team_role.priority
        ]

        region_outbox = None
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
            region_outbox = member.save_outbox_for_update()
        if region_outbox:
            region_outbox.drain_shard(max_updates_to_drain=10)
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
                    organization=organization, user_id=request.user.id
                )
            except OrganizationMember.DoesNotExist:
                return Response({"detail": ERR_INSUFFICIENT_ROLE}, status=400)
            else:
                if acting_member != member:
                    if not request.access.has_scope("member:admin"):
                        return Response({"detail": ERR_INSUFFICIENT_SCOPE}, status=400)
                    else:
                        can_manage = False
                        # check org roles through teams
                        for role in acting_member.get_all_org_roles():
                            if roles.can_manage(role, member.role):
                                can_manage = True
                                break

                        if not can_manage:
                            return Response({"detail": ERR_INSUFFICIENT_ROLE}, status=400)

        # TODO(dcramer): do we even need this check?
        elif not request.access.has_scope("member:admin"):
            return Response({"detail": ERR_INSUFFICIENT_SCOPE}, status=400)

        if member.is_only_owner():
            return Response({"detail": ERR_ONLY_OWNER}, status=403)

        if getattr(member.flags, "idp:provisioned"):
            return Response(
                {"detail": "This user is managed through your organization's identity provider."},
                status=403,
            )

        audit_data = member.get_audit_log_data()

        with transaction.atomic():
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

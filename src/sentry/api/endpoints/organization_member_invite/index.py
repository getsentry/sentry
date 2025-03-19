from django.conf import settings
from django.db import router, transaction
from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features, ratelimits
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.bases.organizationmember import MemberAndStaffPermission
from sentry.api.endpoints.organization_member import get_allowed_org_roles
from sentry.api.endpoints.organization_member.index import OrganizationMemberRequestSerializer
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberinvite import InviteStatus, OrganizationMemberInvite
from sentry.roles import organization_roles
from sentry.signals import member_invited
from sentry.utils import metrics

ERR_RATE_LIMITED = "You are being rate limited for too many invitations."


@region_silo_endpoint
@extend_schema(tags=["Organizations"])
class OrganizationMemberInviteIndexEndpoint(OrganizationEndpoint):
    # TODO (mifu67): make these PUBLIC once ready
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (MemberAndStaffPermission,)
    owner = ApiOwner.ENTERPRISE

    def get(self, request: Request, organization) -> Response:
        """
        List all organization member invites.
        """
        queryset = OrganizationMemberInvite.objects.filter(organization=organization).order_by(
            "invite_status", "email"
        )
        if not request.access.has_scope("member:write"):
            queryset = queryset.filter(invite_status=InviteStatus.APPROVED.value)

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(x, request.user, OrganizationMemberInviteSerializer()),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request, organization) -> Response:
        assigned_org_role = (
            request.data.get("orgRole")
            or request.data.get("role")
            or organization_roles.get_default().id
        )
        billing_bypass = assigned_org_role == "billing" and features.has(
            "organizations:invite-billing", organization
        )
        if not billing_bypass and not features.has(
            "organizations:invite-members", organization, actor=request.user
        ):
            return Response(
                {"organization": "Your organization is not allowed to invite members"}, status=403
            )

        allowed_roles = get_allowed_org_roles(request, organization, creating_org_invite=True)

        # We allow requests from integration tokens to invite new members as the member role only
        if not allowed_roles and request.access.is_integration_token:
            # Error if the assigned role is not a member
            if assigned_org_role != "member":
                raise serializers.ValidationError(
                    "Integration tokens are restricted to inviting new members with the member role only."
                )
            allowed_roles = [organization_roles.get("member")]

        serializer = OrganizationMemberRequestSerializer(
            data=request.data,
            context={
                "organization": organization,
                "allowed_roles": allowed_roles,
                "allow_existing_invite_request": True,
                "allow_retired_roles": not features.has("organizations:team-roles", organization),
            },
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data

        if ratelimits.for_organization_member_invite(
            organization=organization,
            email=result["email"],
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

        is_member = not request.access.has_scope("member:admin") and (
            request.access.has_scope("member:invite")
        )
        # if Open Team Membership is disabled and Member Invites are enabled, members can only invite members to teams they are in
        members_can_only_invite_to_members_teams = (
            not organization.flags.allow_joinleave and not organization.flags.disable_member_invite
        )
        has_teams = bool(result.get("teamRoles") or result.get("teams"))

        if is_member and members_can_only_invite_to_members_teams and has_teams:
            requester_teams = set(
                OrganizationMember.objects.filter(
                    organization=organization,
                    user_id=request.user.id,
                    user_is_active=True,
                ).values_list("teams__slug", flat=True)
            )
            team_slugs = list(
                set(
                    [team.slug for team, _ in result.get("teamRoles", [])]
                    + [team.slug for team in result.get("teams", [])]
                )
            )
            # ensure that the requester is a member of all teams they are trying to assign
            if not requester_teams.issuperset(team_slugs):
                return Response(
                    {"detail": "You cannot assign members to teams you are not a member of."},
                    status=400,
                )

        if has_teams and not organization_roles.get(assigned_org_role).is_team_roles_allowed:
            return Response(
                {
                    "email": f"The user with a '{assigned_org_role}' role cannot have team-level permissions."
                },
                status=400,
            )

        with transaction.atomic(router.db_for_write(OrganizationMemberInvite)):
            # remove any invitation requests for this email before inviting
            existing_invite = OrganizationMemberInvite.objects.filter(
                Q(invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value)
                | Q(invite_status=InviteStatus.REQUESTED_TO_JOIN.value),
                email=result["email"],
                organization=organization,
            )
            for omi in existing_invite:
                omi.delete()

            if "teamRoles" in result or "teams" in result:
                teams = (
                    [team for team, _ in result.get("teamRoles")]
                    if "teamRoles" in result and result["teamRoles"]
                    else result.get("teams")
                )
            else:
                # TODO: change JSON field to list and not dict
                # team roles are not set on invite
                teams = []

            omi = OrganizationMemberInvite(
                organization=organization,
                email=result["email"],
                role=result["role"],
                inviter_id=request.user.id,
                teams=teams,
            )

            # OrganizationMemberIndexEndpoint has a check for settings.SENTRY_ENABLE_INVITES before
            # generating token and saving. Do we need to account for this?
            omi.save()

        if settings.SENTRY_ENABLE_INVITES and result.get("sendInvite"):
            referrer = request.query_params.get("referrer")
            omi.send_invite_email(referrer)
            member_invited.send_robust(
                member=omi, user=request.user, sender=self, referrer=request.data.get("referrer")
            )

        self.create_audit_entry(
            request=request,
            organization_id=organization.id,
            target_object=omi.id,
            data=omi.get_audit_log_data(),
            event=(
                audit_log.get_event_id("MEMBER_INVITE")
                if settings.SENTRY_ENABLE_INVITES
                else audit_log.get_event_id("MEMBER_ADD")
            ),
        )

        return Response(serialize(omi), status=201)

from django.db import router, transaction
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features, ratelimits, roles
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.permissions import StaffPermissionMixin
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organizationmemberinvite import (
    OrganizationMemberInviteSerializer,
)
from sentry.api.serializers.rest_framework.organizationmemberinvite import (
    OrganizationMemberInviteRequestValidator,
)
from sentry.core.endpoints.organization_member_invite.utils import (
    ERR_RATE_LIMITED,
    MISSING_FEATURE_MESSAGE,
)
from sentry.core.endpoints.organization_member_utils import get_allowed_org_roles
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberinvite import InviteStatus, OrganizationMemberInvite
from sentry.notifications.notifications.organization_request import InviteRequestNotification
from sentry.notifications.utils.tasks import async_send_notification
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)
from sentry.roles import organization_roles
from sentry.signals import member_invited
from sentry.utils import metrics
from sentry.utils.audit import create_audit_entry


class MemberInvitePermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        # We will do an additional check to see if a user can invite members. If
        # not, then POST creates an invite request, not an invite.
        "POST": ["member:read", "member:write", "member:admin", "member:invite"],
    }


class MemberInviteAndStaffPermission(StaffPermissionMixin, MemberInvitePermission):
    pass


def _can_invite_member(
    request: Request,
    organization: Organization | RpcOrganization | RpcUserOrganizationContext,
) -> bool:
    scopes = request.access.scopes
    is_role_above_member = "member:admin" in scopes or "member:write" in scopes
    if isinstance(organization, RpcUserOrganizationContext):
        organization = organization.organization

    if is_role_above_member:
        return True
    if "member:invite" not in scopes:
        return False
    return not organization.flags.disable_member_invite


def _create_invite_object(
    request, organization, result, is_request: bool
) -> OrganizationMemberInvite:
    with transaction.atomic(router.db_for_write(OrganizationMemberInvite)):
        teams = []
        for team in result.get("teams", []):
            teams.append({"id": team.id, "slug": team.slug, "role": None})

        om = OrganizationMember.objects.create(organization=organization)
        omi = OrganizationMemberInvite(
            organization=organization,
            organization_member=om,
            email=result["email"],
            role=result["orgRole"],
            inviter_id=request.user.id,
            organization_member_team_data=teams,
            invite_status=(
                InviteStatus.REQUESTED_TO_BE_INVITED.value
                if is_request
                else InviteStatus.APPROVED.value
            ),
        )

        omi.save()

    create_audit_entry(
        request=request,
        organization_id=organization.id,
        target_object=omi.id,
        data=omi.get_audit_log_data(),
        event=(
            (audit_log.get_event_id("INVITE_REQUEST_ADD"))
            if is_request
            else (audit_log.get_event_id("MEMBER_INVITE"))
        ),
    )
    return omi


@region_silo_endpoint
@extend_schema(tags=["Organizations"])
class OrganizationMemberInviteIndexEndpoint(OrganizationEndpoint):
    # TODO (mifu67): make these PUBLIC once ready
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (MemberInviteAndStaffPermission,)
    owner = ApiOwner.ENTERPRISE

    def _invite_member(self, request, organization) -> Response:
        allowed_roles = get_allowed_org_roles(request, organization, creating_org_invite=True)

        is_member = not request.access.has_scope("member:admin") and (
            request.access.has_scope("member:invite")
        )

        validator = OrganizationMemberInviteRequestValidator(
            data=request.data,
            context={
                "organization": organization,
                "allowed_roles": allowed_roles,
                "is_integration_token": request.access.is_integration_token,
                "is_member": is_member,
                "actor": request.user,
            },
        )

        if not validator.is_valid():
            return Response(validator.errors, status=400)

        result = validator.validated_data

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

        omi = _create_invite_object(request, organization, result, is_request=False)

        referrer = request.query_params.get("referrer")
        omi.send_invite_email(referrer)
        member_invited.send_robust(
            member=omi,
            user=request.user,
            sender=self,
            referrer=request.data.get("referrer"),
        )

        return Response(serialize(omi), status=201)

    def _request_to_invite_member(self, request: Request, organization) -> Response:
        validator = OrganizationMemberInviteRequestValidator(
            data=request.data,
            context={
                "organization": organization,
                "allowed_roles": roles.get_all(),
                "actor": request.user,
            },
        )
        if not validator.is_valid():
            return Response(validator.errors, status=400)
        result = validator.validated_data

        omi = _create_invite_object(request, organization, result, is_request=True)

        async_send_notification(InviteRequestNotification, omi, request.user)
        return Response(serialize(omi), status=201)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List all organization member invites.
        """
        if not features.has(
            "organizations:new-organization-member-invite", organization, actor=request.user
        ):
            return Response({"detail": MISSING_FEATURE_MESSAGE}, status=403)

        queryset = OrganizationMemberInvite.objects.filter(organization=organization).order_by(
            "invite_status", "email"
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(x, request.user, OrganizationMemberInviteSerializer()),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request, organization) -> Response:
        if not request.user.has_verified_emails():
            return Response(
                {"detail": "You must verify your email address before inviting members."},
                status=403,
            )

        if not features.has(
            "organizations:new-organization-member-invite", organization, actor=request.user
        ):
            return Response({"detail": MISSING_FEATURE_MESSAGE}, status=403)

        assigned_org_role = request.data.get("orgRole") or organization_roles.get_default().id
        billing_bypass = assigned_org_role == "billing" and features.has(
            "organizations:invite-billing", organization
        )
        if not billing_bypass and not features.has(
            "organizations:invite-members", organization, actor=request.user
        ):
            return Response(
                {"organization": "Your organization is not allowed to invite members"}, status=403
            )
        # Check to see if the requesting user can invite members. If not, create an invite
        # request.
        if not _can_invite_member(request, organization):
            return self._request_to_invite_member(request, organization)
        return self._invite_member(request, organization)

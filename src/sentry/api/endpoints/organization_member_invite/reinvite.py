from typing import Any
from django.db import router, transaction
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features, ratelimits
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.endpoints.organization_member import get_allowed_org_roles
from sentry.api.endpoints.organization_member_invite import MISSING_FEATURE_MESSAGE
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.organizationmemberinvite import (
    OrganizationMemberReinviteRequestValidator,
)
from sentry.auth.services.auth.service import auth_service
from sentry.models.organization import Organization
from sentry.models.organizationmemberinvite import OrganizationMemberInvite
from sentry.utils import metrics

ERR_EXPIRED = "You cannot resend an expired invitation without regenerating the token."
ERR_INSUFFICIENT_SCOPE = "You are missing the member:admin scope."
ERR_INVITE_UNAPPROVED = "You cannot resend an invitation that has not been approved."
ERR_MEMBER_INVITE = "You cannot modify invitations sent by someone else."
ERR_RATE_LIMITED = "You are being rate limited for too many invitations."


class MemberReinvitePermission(OrganizationPermission):
    scope_map = {"PUT": ["member:invite", "member:write", "member:admin"]}


@region_silo_endpoint
class OrganizationMemberReinviteEndpoint(OrganizationEndpoint):
    publish_status = {
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ENTERPRISE
    permission_classes = (MemberReinvitePermission,)

    def convert_args(
        self,
        request: Request,
        member_invite_id: str,
        organization_id_or_slug: str | int | None = None,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)

        try:
            kwargs["invited_member"] = OrganizationMemberInvite.objects.get(
                id=int(member_invite_id)
            )
        except OrganizationMemberInvite.DoesNotExist:
            raise ResourceDoesNotExist
        return args, kwargs

    def _reinvite(
        self,
        request: Request,
        organization: Organization,
        invited_member: OrganizationMemberInvite,
        regenerate: bool,
    ) -> Response:
        if not invited_member.invite_approved:
            return Response({"detail": ERR_INVITE_UNAPPROVED}, status=400)
        if invited_member.is_scim_provisioned:
            auth_provider = auth_service.get_auth_provider(organization_id=organization.id)
            if auth_provider and not (invited_member.sso_linked):
                invited_member.send_sso_linked_email(request.user.email, auth_provider)
        else:
            if ratelimits.for_organization_member_invite(
                organization=organization,
                email=invited_member.email,
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
            if regenerate:
                if request.access.has_scope("member:admin"):
                    with transaction.atomic(router.db_for_write(OrganizationMemberInvite)):
                        invited_member.regenerate_token()
                        invited_member.save()
                else:
                    return Response({"detail": ERR_INSUFFICIENT_SCOPE}, status=400)
            if invited_member.token_expired:
                return Response({"detail": ERR_EXPIRED}, status=400)
            invited_member.send_invite_email()

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=invited_member.id,
            event=audit_log.get_event_id("MEMBER_REINVITE"),
            data=invited_member.get_audit_log_data(),
        )
        return Response(serialize(invited_member, request.user), status=200)

    def put(
        self,
        request: Request,
        organization: Organization,
        invited_member: OrganizationMemberInvite,
    ) -> Response:
        """
        Resend a member invite to an Organization
        ````````````````````````````````````````

        Resend an invite to an organization.

        :pparam string organization_id_or_slug: the id or slug of the organization the member will belong to
        :param string member_id: the member ID
        :param boolean regenerate: whether to regenerate the member's invite token
        :auth: required
        """
        if not features.has(
            "organizations:new-organization-member-invite", organization, actor=request.user
        ):
            return Response({"detail": MISSING_FEATURE_MESSAGE}, status=403)

        validator = OrganizationMemberReinviteRequestValidator(
            data=request.data,
        )
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        result = validator.validated_data

        is_member = not request.access.has_scope("member:admin") and (
            request.access.has_scope("member:invite")
        )
        # Members can only resend invites that they sent
        is_invite_from_user = invited_member.inviter_id == request.user.id
        members_can_invite = not organization.flags.disable_member_invite
        if is_member:
            if not members_can_invite:
                raise PermissionDenied
            if not is_invite_from_user:
                return Response({"detail": ERR_MEMBER_INVITE}, status=status.HTTP_403_FORBIDDEN)

        allowed_roles = get_allowed_org_roles(request, organization)
        if not {invited_member.role} and {r.id for r in allowed_roles}:
            return Response(
                {
                    "detail": f"You do not have permission to approve a member invitation with the role {invited_member.role}."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return self._reinvite(
            request, organization, invited_member, result.get("regenerate", False)
        )

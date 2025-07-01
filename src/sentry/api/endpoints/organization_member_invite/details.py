from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.endpoints.organization_member import get_allowed_org_roles
from sentry.api.endpoints.organization_member_invite.utils import MemberInviteDetailsPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.organizationmemberinvite import (
    ApproveInviteRequestValidator,
    OrganizationMemberInviteRequestValidator,
)
from sentry.models.organization import Organization
from sentry.models.organizationmemberinvite import OrganizationMemberInvite
from sentry.utils.audit import get_api_key_for_audit_log

ERR_INSUFFICIENT_SCOPE = "You are missing the member:admin scope."
ERR_MEMBER_INVITE = "You cannot modify invitations sent by someone else."
ERR_EDIT_WHEN_REINVITING = (
    "You cannot modify member details when resending an invitation. Separate requests are required."
)
ERR_EXPIRED = "You cannot resend an expired invitation without regenerating the token."
ERR_RATE_LIMITED = "You are being rate limited for too many invitations."

MISSING_FEATURE_MESSAGE = "Your organization does not have access to this feature."


@region_silo_endpoint
class OrganizationMemberInviteDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ENTERPRISE
    permission_classes = (MemberInviteDetailsPermission,)

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

    def get(
        self,
        request: Request,
        organization: Organization,
        invited_member: OrganizationMemberInvite,
    ) -> Response:
        """
        Retrieve an invited organization member's details.
        """
        if not features.has(
            "organizations:new-organization-member-invite", organization, actor=request.user
        ):
            return Response({"detail": MISSING_FEATURE_MESSAGE}, status=403)
        return Response(serialize(invited_member, request.user))

    def put(
        self,
        request: Request,
        organization: Organization,
        invited_member: OrganizationMemberInvite,
    ) -> Response:
        """
        Update an invite request to Organization
        ````````````````````````````````````````

        Update and/or approve an invite request to an organization.

        :pparam string organization_id_or_slug: the id or slug of the organization the member will belong to
        :param string invited_member_id: the invite ID
        :param boolean approve: allows the member to be invited
        :param string orgRole: the suggested org-role of the new member
        :param array teams: the teams which the member should belong to.
        :auth: required
        """
        if not features.has(
            "organizations:new-organization-member-invite", organization, actor=request.user
        ):
            return Response({"detail": MISSING_FEATURE_MESSAGE}, status=403)

        if invited_member.partnership_restricted:
            return Response(
                {
                    "detail": "This member is managed by an active partnership and cannot be modified until the end of the partnership."
                },
                status=403,
            )

        allowed_roles = get_allowed_org_roles(request, organization)
        validator = OrganizationMemberInviteRequestValidator(
            data=request.data,
            partial=True,
            context={
                "organization": organization,
                "allowed_roles": allowed_roles,
                "org_role": invited_member.role,
                "teams": invited_member.organization_member_team_data,
            },
        )
        if not validator.is_valid():
            return Response(validator.errors, status=400)

        result = validator.validated_data

        if result.get("orgRole"):
            invited_member.set_org_role(result["orgRole"])
        if result.get("teams"):
            invited_member.set_teams(result["teams"])

        if "approve" in request.data:
            approval_validator = ApproveInviteRequestValidator(
                data=request.data,
                context={
                    "organization": organization,
                    "invited_member": invited_member,
                    "allowed_roles": allowed_roles,
                },
            )

            if not approval_validator.is_valid():
                return Response(approval_validator.errors, status=400)
            if not invited_member.invite_approved:
                api_key = get_api_key_for_audit_log(request)
                invited_member.approve_invite_request(
                    request.user, api_key, request.META["REMOTE_ADDR"], request.data.get("referrer")
                )

        return Response(serialize(invited_member, request.user), status=200)

    def delete(
        self, request: Request, organization: Organization, invited_member: OrganizationMemberInvite
    ) -> Response:
        raise NotImplementedError

from __future__ import annotations

from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import roles
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationMemberEndpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization_member import OrganizationMemberWithTeamsSerializer
from sentry.exceptions import UnableToAcceptMemberInvitationException
from sentry.models import InviteStatus, Organization, OrganizationMember
from sentry.utils.audit import get_api_key_for_audit_log

from ... import get_allowed_org_roles, save_team_assignments
from ...index import OrganizationMemberSerializer


class ApproveInviteRequestSerializer(serializers.Serializer):
    approve = serializers.BooleanField(required=True, write_only=True)

    def validate_approve(self, approve):
        request = self.context["request"]
        member = self.context["member"]
        allowed_roles = self.context["allowed_roles"]

        try:
            member.validate_invitation(request.user, allowed_roles)
        except UnableToAcceptMemberInvitationException as err:
            raise serializers.ValidationError(str(err))

        return approve


class InviteRequestPermissions(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "PUT": ["member:write", "member:admin"],
        "DELETE": ["member:write", "member:admin"],
    }


@region_silo_endpoint
class OrganizationInviteRequestDetailsEndpoint(OrganizationMemberEndpoint):
    permission_classes = (InviteRequestPermissions,)

    def _get_member(
        self,
        request: Request,
        organization: Organization,
        member_id: int | str,
        invite_status: InviteStatus | None = None,
    ) -> OrganizationMember:
        try:
            return OrganizationMember.objects.get_member_invite_query(member_id).get(
                organization=organization
            )
        except ValueError:
            raise OrganizationMember.DoesNotExist()

    def get(
        self,
        request: Request,
        organization: Organization,
        member: OrganizationMember,
    ) -> Response:
        return Response(
            serialize(member, serializer=OrganizationMemberWithTeamsSerializer()),
            status=status.HTTP_200_OK,
        )

    def put(
        self,
        request: Request,
        organization: Organization,
        member: OrganizationMember,
    ) -> Response:
        """
        Update an invite request to Organization
        ````````````````````````````````````````

        Update and/or approve an invite request to an organization.

        :pparam string organization_slug: the slug of the organization the member will belong to
        :param string member_id: the member ID
        :param boolean approve: allows the member to be invited
        :param string role: the suggested role of the new member
        :param string orgRole: the suggested org-role of the new member
        :param array teams: the teams which the member should belong to.
        :param array teamRoles: the teams and team-roles assigned to the member
        :auth: required
        """

        serializer = OrganizationMemberSerializer(
            data=request.data,
            context={"organization": organization, "allowed_roles": roles.get_all()},
            partial=True,
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        result = serializer.validated_data

        region_outbox = None
        if result.get("orgRole"):
            member.role = result["orgRole"]
            region_outbox = member.save()
        elif result.get("role"):
            member.role = result["role"]
            region_outbox = member.save()
        if region_outbox:
            region_outbox.drain_shard(max_updates_to_drain=10)

        # Do not set team-roles when inviting members
        if "teamRoles" in result or "teams" in result:
            teams = (
                [team for team, _ in result.get("teamRoles")]
                if "teamRoles" in result and result["teamRoles"]
                else result.get("teams")
            )
            save_team_assignments(member, teams)

        if "approve" in request.data:
            allowed_roles = get_allowed_org_roles(request, organization)

            serializer = ApproveInviteRequestSerializer(
                data=request.data,
                context={
                    "request": request,
                    "organization": organization,
                    "member": member,
                    "allowed_roles": allowed_roles,
                },
            )

            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            result = serializer.validated_data

            if result.get("approve") and not member.invite_approved:
                api_key = get_api_key_for_audit_log(request)
                member.approve_member_invitation(
                    request.user,
                    api_key,
                    request.META["REMOTE_ADDR"],
                    request.data.get("referrer"),
                )

        return Response(
            serialize(member, serializer=OrganizationMemberWithTeamsSerializer()),
            status=status.HTTP_200_OK,
        )

    def delete(
        self,
        request: Request,
        organization: Organization,
        member: OrganizationMember,
    ) -> Response:
        """
        Delete an invite request to Organization
        ````````````````````````````````````````

        Delete an invite request to an organization.

        :pparam string organization_slug: the slug of the organization the member would belong to
        :param string member_id: the member ID

        :auth: required
        """

        api_key = get_api_key_for_audit_log(request)
        member.reject_member_invitation(request.user, api_key, request.META["REMOTE_ADDR"])

        return Response(status=status.HTTP_204_NO_CONTENT)

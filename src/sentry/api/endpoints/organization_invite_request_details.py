from rest_framework import serializers, status
from rest_framework.response import Response

from sentry import roles
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization_member import OrganizationMemberWithTeamsSerializer
from sentry.models import OrganizationMember
from sentry.utils.audit import get_api_key_for_audit_log
from sentry.utils.members import (
    approve_member_invitation,
    reject_member_invitation,
    validate_invitation,
)

from .organization_member_details import get_allowed_roles
from .organization_member_index import OrganizationMemberSerializer, save_team_assignments


class ApproveInviteRequestSerializer(serializers.Serializer):
    approve = serializers.BooleanField(required=True, write_only=True)

    def validate_approve(self, approve):
        request = self.context["request"]
        organization = self.context["organization"]
        member = self.context["member"]
        allowed_roles = self.context["allowed_roles"]

        # will raise validation errors
        validate_invitation(member, organization, request.user, allowed_roles)

        return approve


class InviteRequestPermissions(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "PUT": ["member:write", "member:admin"],
        "DELETE": ["member:write", "member:admin"],
    }


class OrganizationInviteRequestDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (InviteRequestPermissions,)

    def _get_member(self, organization, member_id):
        try:
            return OrganizationMember.objects.get_member_invite_query(member_id).get(
                organization=organization
            )
        except ValueError:
            raise OrganizationMember.DoesNotExist()

    def get(self, request, organization, member_id):
        try:
            member = self._get_member(organization, member_id)
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(
            serialize(member, serializer=OrganizationMemberWithTeamsSerializer()),
            status=status.HTTP_200_OK,
        )

    def put(self, request, organization, member_id):
        """
        Update an invite request to Organization
        ````````````````````````````````````````

        Update and/or approve an invite request to an organization.

        :pparam string organization_slug: the slug of the organization the member will belong to
        :param string member_id: the member ID
        :param boolean approve: allows the member to be invited
        :param string role: the suggested role of the new member
        :param array teams: the suggested slugs of the teams the member should belong to.

        :auth: required
        """

        try:
            member = self._get_member(organization, member_id)
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = OrganizationMemberSerializer(
            data=request.data,
            context={"organization": organization, "allowed_roles": roles.get_all()},
            partial=True,
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        result = serializer.validated_data

        if result.get("role"):
            member.update(role=result["role"])

        if "teams" in result:
            save_team_assignments(member, result["teams"])

        if "approve" in request.data:
            _, allowed_roles = get_allowed_roles(request, organization)

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
                approve_member_invitation(
                    member,
                    request.user,
                    api_key,
                    request.META["REMOTE_ADDR"],
                    request.data.get("referrer"),
                )

        return Response(
            serialize(member, serializer=OrganizationMemberWithTeamsSerializer()),
            status=status.HTTP_200_OK,
        )

    def delete(self, request, organization, member_id):
        """
        Delete an invite request to Organization
        ````````````````````````````````````````

        Delete an invite request to an organization.

        :pparam string organization_slug: the slug of the organization the member would belong to
        :param string member_id: the member ID

        :auth: required
        """

        try:
            member = self._get_member(organization, member_id)
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist

        api_key = get_api_key_for_audit_log(request)
        reject_member_invitation(member, request.user, api_key, request.META["REMOTE_ADDR"])

        return Response(status=status.HTTP_204_NO_CONTENT)

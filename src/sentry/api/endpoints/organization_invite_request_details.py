from __future__ import absolute_import

from django.db.models import Q
from django.conf import settings
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry import roles, features
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize, OrganizationMemberWithTeamsSerializer
from sentry.models import AuditLogEntryEvent, InviteStatus, OrganizationMember
from sentry.signals import member_invited

from .organization_member_index import OrganizationMemberSerializer, save_team_assignments

ERR_CANNOT_INVITE = "Your organization is not allowed to invite members."
ERR_INSUFFICIENT_ROLE_UPDATE = "You do not have permission to update this invite request."
ERR_INSUFFICIENT_ROLE_DELETE = "You do not have permission to delete this invite request."
ERR_JOIN_REQUESTS_DISABLED = "Your organization does not allow join requests."


class InviteRequestSerializer(serializers.Serializer):
    approve = serializers.BooleanField(required=False, write_only=True)

    def validate_approve(self, approve):
        request = self.context["request"]
        organization = self.context["organization"]
        member = self.context["member"]

        if not features.has("organizations:invite-members", organization, actor=request.user):
            raise serializers.ValidationError(ERR_CANNOT_INVITE)

        if not request.access.has_scope("member:admin") and not request.access.has_scope(
            "member:write"
        ):
            raise serializers.ValidationError(ERR_INSUFFICIENT_ROLE_UPDATE)

        if (
            organization.get_option("sentry:join_requests") is False
            and member.invite_status == InviteStatus.REQUESTED_TO_JOIN.value
        ):
            raise serializers.ValidationError(ERR_JOIN_REQUESTS_DISABLED)

        return approve


class InviteRequestPermissions(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "PUT": ["member:read", "member:write", "member:admin"],
        "DELETE": ["member:read", "member:admin"],
    }


class OrganizationInviteRequestDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (InviteRequestPermissions,)

    def _get_member(self, organization, member_id):
        try:
            return OrganizationMember.objects.get(
                Q(invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value)
                | Q(invite_status=InviteStatus.REQUESTED_TO_JOIN.value),
                organization=organization,
                user__isnull=True,
                id=member_id,
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

        if (
            member.inviter != request.user
            and not request.access.has_scope("member:admin")
            and not request.access.has_scope("member:write")
        ):
            return Response(
                {"detail": ERR_INSUFFICIENT_ROLE_UPDATE}, status=status.HTTP_403_FORBIDDEN
            )

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
            serializer = InviteRequestSerializer(
                data=request.data,
                context={"request": request, "organization": organization, "member": member},
            )

            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            result = serializer.validated_data

            if result.get("approve"):
                if not member.invite_approved:
                    member.approve_invite()
                    member.save()

                    if settings.SENTRY_ENABLE_INVITES:
                        member.send_invite_email()
                        member_invited.send_robust(
                            member=member,
                            user=request.user,
                            sender=self,
                            referrer=request.data.get("referrer"),
                        )

                    self.create_audit_entry(
                        request=request,
                        organization_id=organization.id,
                        target_object=member.id,
                        data=member.get_audit_log_data(),
                        event=AuditLogEntryEvent.MEMBER_INVITE
                        if settings.SENTRY_ENABLE_INVITES
                        else AuditLogEntryEvent.MEMBER_ADD,
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

        if member.inviter != request.user and not request.access.has_scope("member:write"):
            return Response(
                {"detail": ERR_INSUFFICIENT_ROLE_DELETE}, status=status.HTTP_403_FORBIDDEN
            )

        member.delete()

        self.create_audit_entry(
            request=request,
            organization_id=organization.id,
            target_object=member.id,
            data=member.get_audit_log_data(),
            event=AuditLogEntryEvent.INVITE_REQUEST_REMOVE,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)

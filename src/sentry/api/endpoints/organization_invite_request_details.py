from __future__ import absolute_import

from django.db.models import Q
from django.conf import settings
from rest_framework import serializers
from rest_framework.response import Response

from sentry import roles
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize, OrganizationMemberWithTeamsSerializer
from sentry.models import AuditLogEntryEvent, InviteStatus, OrganizationMember
from sentry.signals import member_invited

from .organization_member_index import OrganizationMemberSerializer, save_team_assignments


class InviteRequestSerializer(serializers.Serializer):
    approve = serializers.BooleanField(required=False, write_only=True)

    def validate_approve(self, approve):
        request = self.context["request"]

        if not request.access.has_scope("member:admin") and not request.access.has_scope(
            "member:write"
        ):
            raise serializers.ValidationError(
                "You do not have permission to approve this invite request."
            )

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

        return Response(serialize(member, serializer=OrganizationMemberWithTeamsSerializer()))

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
                {"detail": "You do not have permission to update this invite request."}, status=403
            )

        serializer = OrganizationMemberSerializer(
            data=request.data,
            context={"organization": organization, "allowed_roles": roles.get_all()},
            partial=True,
        )

        if not serializer.is_valid():
            return Response(status=400)

        result = serializer.validated_data

        if result.get("role"):
            member.update(role=result["role"])

        if "teams" in result:
            save_team_assignments(member, result["teams"])

        if "approve" in request.data:
            serializer = InviteRequestSerializer(data=request.data, context={"request": request})

            if not serializer.is_valid():
                return Response(status=400)

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

        return Response(serialize(member, serializer=OrganizationMemberWithTeamsSerializer()))

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
                {"detail": "You do not have permission to delete this invite request."}, status=403
            )

        member.delete()

        self.create_audit_entry(
            request=request,
            organization_id=organization.id,
            target_object=member.id,
            data=member.get_audit_log_data(),
            event=AuditLogEntryEvent.INVITE_REQUEST_REMOVE,
        )

        return Response(status=204)

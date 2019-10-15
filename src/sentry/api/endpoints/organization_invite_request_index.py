from __future__ import absolute_import

from django.db import transaction
from rest_framework.response import Response

from sentry.app import locks
from sentry import roles, features
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import serialize
from sentry.models import AuditLogEntryEvent, OrganizationMember, InviteStatus
from sentry.utils.retries import TimedRetryPolicy

from .organization_member_index import OrganizationMemberSerializer, save_team_assignments


class InviteRequestPermissions(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "POST": ["member:read", "member:write", "member:admin"],
    }


class OrganizationInviteRequestIndexEndpoint(OrganizationEndpoint):
    permission_classes = (InviteRequestPermissions,)

    def get(self, request, organization):
        # TODO(epurkhiser): Add listing of invite requests
        pass

    def post(self, request, organization):
        """
        Add a invite request to Organization
        ````````````````````````````````````

        Creates an invite request given an email and sugested role / teams.

        :pparam string organization_slug: the slug of the organization the member will belong to
        :param string email: the email address to invite
        :param string role: the suggested role of the new member
        :param array teams: the suggested slugs of the teams the member should belong to.

        :auth: required
        """
        if not features.has("organizations:invite-members", organization, actor=request.user):
            return Response(
                {"organization": "Your organization is not allowed to invite members"}, status=403
            )

        serializer = OrganizationMemberSerializer(
            data=request.data,
            context={"organization": organization, "allowed_roles": roles.get_all()},
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data

        with transaction.atomic():
            om = OrganizationMember.objects.create(
                organization=organization,
                email=result["email"],
                role=result["role"],
                inviter=request.user,
                invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
            )

            if result["teams"]:
                lock = locks.get(u"org:member:{}".format(om.id), duration=5)
                with TimedRetryPolicy(10)(lock.acquire):
                    save_team_assignments(om, result["teams"])

            self.create_audit_entry(
                request=request,
                organization_id=organization.id,
                target_object=om.id,
                data=om.get_audit_log_data(),
                event=AuditLogEntryEvent.INVITE_REQUEST_ADD,
            )

        return Response(serialize(om), status=201)

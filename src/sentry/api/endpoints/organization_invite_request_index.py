from __future__ import absolute_import

from django.db import transaction
from django.db.models import Q
from rest_framework.response import Response

from sentry import roles
from sentry.app import locks
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize, OrganizationMemberWithTeamsSerializer
from sentry.models import AuditLogEntryEvent, OrganizationMember, InviteStatus
from sentry.tasks.members import send_invite_request_notification_email
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
        queryset = OrganizationMember.objects.filter(
            Q(user__isnull=True),
            Q(invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value)
            | Q(invite_status=InviteStatus.REQUESTED_TO_JOIN.value),
            organization=organization,
        ).order_by("invite_status", "email")

        if organization.get_option("sentry:join_requests") is False:
            queryset = queryset.filter(invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value)

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(
                x, request.user, OrganizationMemberWithTeamsSerializer()
            ),
            paginator_cls=OffsetPaginator,
        )

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

        send_invite_request_notification_email.delay(om.id)

        return Response(serialize(om), status=201)

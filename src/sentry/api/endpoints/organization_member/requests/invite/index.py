from django.db import router, transaction
from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, roles
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.endpoints.organization_member.index import OrganizationMemberSerializer
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization_member import OrganizationMemberWithTeamsSerializer
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.outbox import outbox_context
from sentry.notifications.notifications.organization_request import InviteRequestNotification
from sentry.notifications.utils.tasks import async_send_notification

from ... import save_team_assignments


class InviteRequestPermissions(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "POST": ["member:read", "member:write", "member:admin"],
    }


@region_silo_endpoint
class OrganizationInviteRequestIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (InviteRequestPermissions,)

    def get(self, request: Request, organization) -> Response:
        queryset = OrganizationMember.objects.filter(
            Q(user_id__isnull=True),
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

    def post(self, request: Request, organization) -> Response:
        """
        Add a invite request to Organization
        ````````````````````````````````````

        Creates an invite request given an email and suggested role / teams.

        :pparam string organization_slug: the slug of the organization the member will belong to
        :param string email: the email address to invite
        :param string role: the suggested role of the new member
        :param string orgRole: the suggested org-role of the new member
        :param array teams: the teams which the member should belong to.
        :param array teamRoles: the teams and team-roles assigned to the member

        :auth: required
        """
        serializer = OrganizationMemberSerializer(
            data=request.data,
            context={"organization": organization, "allowed_roles": roles.get_all()},
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data

        with outbox_context(
            transaction.atomic(router.db_for_write(OrganizationMember)), flush=False
        ):
            om = OrganizationMember.objects.create(
                organization_id=organization.id,
                role=result["role"] or organization.default_role,
                email=result["email"],
                inviter_id=request.user.id,
                invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
            )

            # Do not set team-roles when inviting a member
            if "teams" in result or "teamRoles" in result:
                teams = result.get("teams") or [
                    item["teamSlug"] for item in result.get("teamRoles", [])
                ]
                save_team_assignments(om, teams)

        self.create_audit_entry(
            request=request,
            organization_id=organization.id,
            target_object=om.id,
            data=om.get_audit_log_data(),
            event=audit_log.get_event_id("INVITE_REQUEST_ADD"),
        )

        async_send_notification(InviteRequestNotification, om, request.user)

        return Response(serialize(om), status=201)

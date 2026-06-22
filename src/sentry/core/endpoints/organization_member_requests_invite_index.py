from django.db import router, transaction
from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, roles
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization_member import OrganizationMemberWithTeamsSerializer
from sentry.api.serializers.models.organization_member.response import (
    OrganizationMemberResponse,
    OrganizationMemberWithTeamsResponse,
)
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.response_types import (
    DetailResponse,
    ValidationErrorResponse,
    as_validation_errors,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.core.endpoints.organization_member_index import OrganizationMemberRequestSerializer
from sentry.core.endpoints.organization_member_utils import save_team_assignments
from sentry.hybridcloud.models.outbox import outbox_context
from sentry.models.organization import Organization
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.notifications.notifications.organization_request import InviteRequestNotification
from sentry.notifications.utils.tasks import async_send_notification


class InviteRequestPermissions(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "POST": ["member:read", "member:write", "member:admin"],
    }


@extend_schema(tags=["Organizations"])
@cell_silo_endpoint
class OrganizationInviteRequestIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (InviteRequestPermissions,)

    @extend_schema(
        operation_id="List an Organization's Invite Requests",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, CursorQueryParam],
        responses={
            200: inline_sentry_response_serializer(
                "ListInviteRequests", list[OrganizationMemberWithTeamsResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[OrganizationMemberWithTeamsResponse]]:
        """
        Return a list of pending invite and join requests for an organization.
        """
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

    @extend_schema(
        operation_id="Create an Invite Request",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=OrganizationMemberRequestSerializer,
        responses={
            201: inline_sentry_response_serializer("InviteRequest", OrganizationMemberResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self, request: Request, organization: Organization
    ) -> (
        Response[OrganizationMemberResponse]
        | Response[DetailResponse]
        | Response[ValidationErrorResponse]
    ):
        """
        Create an invite request for an organization given an email and suggested
        role / teams.
        """
        serializer = OrganizationMemberRequestSerializer(
            data=request.data,
            context={"organization": organization, "allowed_roles": roles.get_all()},
        )

        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)

        if request.access.requires_sso:
            return Response(
                {
                    "detail": "Your organization must use its single sign-on provider to register new members."
                },
                status=400,
            )

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

        data: OrganizationMemberResponse = serialize(om)
        return Response(data, status=201)

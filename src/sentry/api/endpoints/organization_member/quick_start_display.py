from __future__ import annotations

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import ValidationError

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationMemberEndpoint
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NO_CONTENT
from sentry.apidocs.parameters import GlobalParams
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember, QuickStartDisplayStatus


@region_silo_endpoint
class OrganizationMemberQuickStartDisplayEndpoint(OrganizationMemberEndpoint):
    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        operation_id="Update the quick start display status of an organization member",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.member_id("The ID of the member to update."),
        ],
        request=inline_serializer(
            "UpdateOrganizationMemberQuickStartDisplayStatus",
            fields={
                "quickStartDisplayStatus": serializers.ChoiceField(
                    choices=QuickStartDisplayStatus.as_choices(),
                    required=True,
                    allow_null=False,
                    help_text="Tracks whether the quick start guide was already shown to the user during their first and second visits.",
                ),
            },
        ),
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
    )
    def put(
        self,
        request: Request,
        organization: Organization,
        member: OrganizationMember,
    ) -> Response:
        """
        Update the quick start display status for the current active member of an organization.

        This status controls whether the quick start guide has been shown to the member
        and is included in the response when fetching the organization's details.
        """

        # Ensure the user is trying to update their own status
        if member.user_id != request.user.id:
            return Response(
                {"detail": "You can only update your own quick start display status"}, status=403
            )

        quick_start_status = request.data.get("quickStartDisplayStatus")

        if quick_start_status not in dict(QuickStartDisplayStatus.as_choices()).keys():
            raise ValidationError("Invalid quick start display status.")

        member.quick_start_display_status = quick_start_status
        member.save()

        return Response(status=204)

import logging

from django.db import IntegrityError, router, transaction
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team

logger = logging.getLogger(__name__)


class AccessRequestPermission(OrganizationPermission):
    scope_map = {
        "GET": [
            "org:read",
            "org:write",
            "org:admin",
            "team:read",
            "team:write",
            "team:admin",
            "member:read",
            "member:write",
            "member:admin",
        ],
        "POST": [],
        "PUT": [
            "org:read",
            "org:write",
            "org:admin",
            "team:write",
            "team:admin",
            "member:write",
            "member:admin",
        ],
        "DELETE": [],
    }


class AccessRequestSerializer(serializers.Serializer):
    isApproved = serializers.BooleanField()


@cell_silo_endpoint
class OrganizationAccessRequestDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.FOUNDATIONS
    permission_classes = (AccessRequestPermission,)

    # TODO(dcramer): this should go onto AccessRequestPermission
    def _can_access(self, request: Request, access_request):
        if request.access.has_scope("org:admin"):
            return True
        if request.access.has_scope("org:write"):
            return True
        if request.access.has_scope("member:admin"):
            return True
        if request.access.has_scope("member:write"):
            return True
        if request.access.has_team_scope(access_request.team, "team:admin"):
            return True
        if request.access.has_team_scope(access_request.team, "team:write"):
            return True
        return False

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get a list of requests to join org/team.
        If any requests are redundant (user already joined the team), they are not returned.
        """
        if request.access.has_scope("org:write"):
            access_requests = list(
                OrganizationAccessRequest.objects.filter(
                    team__organization=organization,
                    member__user_is_active=True,
                    member__user_id__isnull=False,
                ).select_related("team", "member")
            )

        else:
            authorized_team_ids = [
                team.id
                for team in Team.objects.filter(id__in=request.access.team_ids_with_membership)
                if request.access.has_team_scope(team, "team:write")
            ]
            if not authorized_team_ids:
                return Response([])

            access_requests = list(
                OrganizationAccessRequest.objects.filter(
                    member__user_is_active=True,
                    member__user_id__isnull=False,
                    team_id__in=authorized_team_ids,
                ).select_related("team", "member")
            )

        if not access_requests:
            return Response([])

        member_ids = {access_request.member_id for access_request in access_requests}
        team_ids = {access_request.team_id for access_request in access_requests}
        existing_memberships = set(
            OrganizationMemberTeam.objects.filter(
                organizationmember_id__in=member_ids,
                team_id__in=team_ids,
            ).values_list("organizationmember_id", "team_id")
        )
        valid_access_requests = [
            access_request
            for access_request in access_requests
            if (access_request.member_id, access_request.team_id) not in existing_memberships
        ]

        return Response(serialize(valid_access_requests, request.user))

    def put(self, request: Request, organization: Organization, request_id: int) -> Response:
        """
        Approve or deny a request

            {method} {path}

        """
        try:
            access_request = OrganizationAccessRequest.objects.get(
                id=request_id, team__organization=organization
            )
        except OrganizationAccessRequest.DoesNotExist:
            raise ResourceDoesNotExist

        if not self._can_access(request, access_request):
            return Response(status=403)

        serializer = AccessRequestSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        is_approved = serializer.validated_data.get("isApproved")
        if is_approved is None:
            return Response(status=400)

        if is_approved:
            try:
                with transaction.atomic(router.db_for_write(OrganizationMemberTeam)):
                    omt = OrganizationMemberTeam.objects.create(
                        organizationmember=access_request.member, team=access_request.team
                    )
            except IntegrityError:
                pass
            else:
                self.create_audit_entry(
                    request=request,
                    organization=organization,
                    target_object=omt.id,
                    target_user_id=access_request.member.user_id,
                    event=audit_log.get_event_id("MEMBER_JOIN_TEAM"),
                    data=omt.get_audit_log_data(),
                )

                access_request.send_approved_email()

        access_request.delete()

        return Response(status=204)

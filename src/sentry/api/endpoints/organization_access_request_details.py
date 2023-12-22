from django.db import IntegrityError, router, transaction
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationmemberteam import OrganizationMemberTeam


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


@region_silo_endpoint
class OrganizationAccessRequestDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }
    owner = ApiOwner.ENTERPRISE
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

    def get(self, request: Request, organization) -> Response:
        """
        Get list of requests to join org/team

        """
        if request.access.has_scope("org:write"):
            access_requests = list(
                OrganizationAccessRequest.objects.filter(
                    team__organization=organization,
                    member__user_is_active=True,
                    member__user_id__isnull=False,
                ).select_related("team")
            )

        elif request.access.has_scope("team:write") and request.access.team_ids_with_membership:
            access_requests = list(
                OrganizationAccessRequest.objects.filter(
                    member__user_is_active=True,
                    member__user_id__isnull=False,
                    team__id__in=request.access.team_ids_with_membership,
                ).select_related("team")
            )
        else:
            # Return empty response if user does not have access
            return Response([])

        return Response(serialize(access_requests, request.user))

    def put(self, request: Request, organization, request_id) -> Response:
        """
        Approve or deny a request

        Approve or deny a request.

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

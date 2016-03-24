from __future__ import absolute_import

from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.organization import (
    OrganizationEndpoint, OrganizationPermission
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import (
    AuditLogEntryEvent, OrganizationAccessRequest, OrganizationMemberTeam
)


class AccessRequestPermission(OrganizationPermission):
    scope_map = {
        'GET': [],
        'POST': [],
        'PUT': [
            'org:write',
            'team:write',
            'member:write',
        ],
        'DELETE': [],
    }


class AccessRequestSerializer(serializers.Serializer):
    isApproved = serializers.BooleanField()


class OrganizationAccessRequestDetailsEndpoint(OrganizationEndpoint):
    permission_classes = [AccessRequestPermission]

    # TODO(dcramer): this should go onto AccessRequestPermission
    def _can_access(self, request, access_request):
        if request.access.has_scope('org:write'):
            return True
        if request.access.has_scope('member:write'):
            return True
        if request.access.has_team_scope(access_request.team, 'team:write'):
            return True
        return False

    def put(self, request, organization, request_id):
        """
        Approve or deny a request

        Approve or deny a request.

            {method} {path}

        """
        try:
            access_request = OrganizationAccessRequest.objects.get(
                id=request_id,
                team__organization=organization,
            )
        except OrganizationAccessRequest.DoesNotExist:
            raise ResourceDoesNotExist

        if not self._can_access(request, access_request):
            return Response(status=403)

        serializer = AccessRequestSerializer(data=request.DATA, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        is_approved = serializer.object.get('isApproved')
        if is_approved is None:
            return Response(status=400)

        if is_approved:
            try:
                with transaction.atomic():
                    omt = OrganizationMemberTeam.objects.create(
                        organizationmember=access_request.member,
                        team=access_request.team,
                    )
            except IntegrityError:
                pass
            else:
                self.create_audit_entry(
                    request=request,
                    organization=organization,
                    target_object=omt.id,
                    target_user=access_request.member.user,
                    event=AuditLogEntryEvent.MEMBER_JOIN_TEAM,
                    data=omt.get_audit_log_data(),
                )

                access_request.send_approved_email()

        access_request.delete()

        return Response(status=204)

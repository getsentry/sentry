from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import (
    AuditLogEntryEvent, OrganizationAccessRequest, OrganizationMemberTeam
)


class AccessRequestSerializer(serializers.Serializer):
    isApproved = serializers.BooleanField()


class OrganizationAccessRequestDetailsEndpoint(OrganizationEndpoint):
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

        serializer = AccessRequestSerializer(data=request.DATA, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        is_approved = serializer.object.get('isApproved')
        if is_approved is None:
            return Response(status=400)

        if not access_request.member.has_global_access:
            affected, _ = OrganizationMemberTeam.objects.create_or_update(
                organizationmember=access_request.member,
                team=access_request.team,
                values={
                    'is_active': is_approved,
                }
            )
            if affected and is_approved:
                omt = OrganizationMemberTeam.objects.get(
                    organizationmember=access_request.member,
                    team=access_request.team,
                )

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

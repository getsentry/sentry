from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, Organization, OrganizationMember,
    OrganizationMemberType
)


class OrganizationMemberDetailsEndpoint(Endpoint):
    def delete(self, request, organization_slug, member_id):
        try:
            organization = Organization.objects.get_from_cache(
                slug=organization_slug,
            )
        except Organization.DoesNotExist:
            return Response(status=404)

        assert_perm(organization, request.user, request.auth)

        if request.user.is_superuser:
            authorizing_access = OrganizationMemberType.OWNER
        else:
            authorizing_access = OrganizationMember.objects.get(
                user=request.user,
            ).type

        try:
            om = OrganizationMember.objects.filter(
                organization=organization,
                id=member_id,
                type__gte=authorizing_access,
            ).select_related('user').get()
        except OrganizationMember.DoesNotExist:
            return Response(status=404)

        audit_data = om.get_audit_log_data()

        om.delete()

        AuditLogEntry.objects.create(
            organization=organization,
            actor=request.user,
            ip_address=request.META['REMOTE_ADDR'],
            target_object=om.id,
            target_user=om.user,
            event=AuditLogEntryEvent.MEMBER_REMOVE,
            data=audit_data,
        )

        return Response(status=204)

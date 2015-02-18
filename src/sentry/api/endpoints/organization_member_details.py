from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, OrganizationMember,
    OrganizationMemberType
)


class OrganizationMemberDetailsEndpoint(OrganizationEndpoint):
    def _is_only_owner(self, member):
        if member.type != OrganizationMemberType.OWNER:
            return False

        queryset = OrganizationMember.objects.filter(
            organization=member.organization_id,
            type=OrganizationMemberType.OWNER,
            user__isnull=False,
        ).exclude(id=member.id)
        if queryset.exists():
            return False

        return True

    def delete(self, request, organization, member_id):
        if request.user.is_superuser:
            authorizing_access = OrganizationMemberType.OWNER
        else:
            authorizing_access = OrganizationMember.objects.get(
                organization=organization,
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

        if self._is_only_owner(om):
            return Response(status=403)

        audit_data = om.get_audit_log_data()

        if om.user_id == organization.owner_id:
            # TODO(dcramer): while we still maintain an owner field on
            # organization we need to ensure it transfers
            organization.owner = OrganizationMember.objects.filter(
                organization=om.organization,
                type=OrganizationMemberType.OWNER,
                user__isnull=False,
            ).exclude(id=om.id)[0].user
            organization.save()

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

from __future__ import absolute_import

from sentry.models import (
    AuditLogEntry, OrganizationMemberType
)
from sentry.web.frontend.base import OrganizationView


class OrganizationAuditLogView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get(self, request, organization):
        queryset = AuditLogEntry.objects.filter(
            organization=organization,
        ).select_related('actor', 'target_user').order_by('-datetime')

        context = {
            'audit_log_queryset': queryset,
        }

        return self.respond('sentry/organization-audit-log.html', context)

from __future__ import absolute_import

from sentry.models import (
    AuditLogEntry,
    AuditLogEntryEvent,
)
from sentry.web.forms.base_organization_member import BaseOrganizationMemberForm


class EditOrganizationMemberForm(BaseOrganizationMemberForm):
    def save(self, actor, organization, ip_address=None):
        om = super(EditOrganizationMemberForm, self).save()

        self.save_team_assignments(om)

        AuditLogEntry.objects.create(
            organization=organization,
            actor=actor,
            ip_address=ip_address,
            target_object=om.id,
            target_user=om.user,
            event=AuditLogEntryEvent.MEMBER_EDIT,
            data=om.get_audit_log_data(),
        )

        return om

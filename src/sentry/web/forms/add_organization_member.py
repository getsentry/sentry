from __future__ import absolute_import

from django.db import transaction, IntegrityError

from sentry.models import (
    AuditLogEntry,
    AuditLogEntryEvent,
    OrganizationMember,
)
from sentry.web.forms.fields import UserField
from sentry.web.forms.base_organization_member import BaseOrganizationMemberForm


class AddOrganizationMemberForm(BaseOrganizationMemberForm):
    user = UserField()

    class Meta:
        fields = ('user', 'role')
        model = OrganizationMember

    def save(self, actor, organization, ip_address):
        om = super(AddOrganizationMemberForm, self).save(commit=False)
        om.organization = organization

        with transaction.atomic():
            try:
                om.save()
            except IntegrityError:
                return OrganizationMember.objects.get(
                    user=om.user,
                    organization=organization,
                ), False

        self.save_team_assignments(om)

        AuditLogEntry.objects.create(
            organization=organization,
            actor=actor,
            ip_address=ip_address,
            target_object=om.id,
            target_user=om.user,
            event=AuditLogEntryEvent.MEMBER_ADD,
            data=om.get_audit_log_data(),
        )

        return om, True

from __future__ import absolute_import

from django import forms
from django.db import transaction, IntegrityError

from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, OrganizationMember,
    OrganizationMemberType
)


class InviteOrganizationMemberForm(forms.ModelForm):
    class Meta:
        fields = ('email',)
        model = OrganizationMember

    def save(self, actor, organization, ip_address):
        om = super(InviteOrganizationMemberForm, self).save(commit=False)
        om.organization = organization
        om.type = OrganizationMemberType.MEMBER

        try:
            existing = OrganizationMember.objects.get(
                organization=organization,
                user__email__iexact=om.email,
            )
        except OrganizationMember.DoesNotExist:
            pass
        else:
            return existing, False

        sid = transaction.savepoint(using='default')
        try:
            om.save()
        except IntegrityError:
            transaction.savepoint_rollback(sid, using='default')
            return OrganizationMember.objects.get(
                email__iexact=om.email,
                organization=organization,
            ), False
        transaction.savepoint_commit(sid, using='default')

        AuditLogEntry.objects.create(
            organization=organization,
            actor=actor,
            ip_address=ip_address,
            target_object=om.id,
            event=AuditLogEntryEvent.MEMBER_INVITE,
            data=om.get_audit_log_data(),
        )

        om.send_invite_email()

        return om, True

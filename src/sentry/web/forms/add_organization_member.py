from __future__ import absolute_import

from django import forms
from django.db import transaction, IntegrityError

from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, OrganizationMember,
)
from sentry.web.forms.fields import UserField


class AddOrganizationMemberForm(forms.ModelForm):
    user = UserField()

    class Meta:
        fields = ('user',)
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

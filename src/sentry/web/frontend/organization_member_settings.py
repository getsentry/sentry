from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, OrganizationMember,
    OrganizationMemberType
)
from sentry.web.frontend.base import OrganizationView


class EditOrganizationMemberForm(forms.ModelForm):
    class Meta:
        fields = ('type', 'has_global_access', 'teams')
        model = OrganizationMember


class OrganizationMemberSettingsView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get_form(self, request, member):
        initial = {
            'type': OrganizationMemberType.MEMBER,
            'has_global_access': True,
        }

        return EditOrganizationMemberForm(
            data=request.POST or None,
            instance=member,
            initial=initial,
        )

    def get(self, request, organization, member_id):
        try:
            member = OrganizationMember.objects.get(id=member_id)
        except OrganizationMember.DoesNotExist:
            return HttpResponseRedirect(reverse('sentry'))

        form = self.get_form(request, member)

        context = {
            'member': member,
            'form': form,
        }

        return self.respond('sentry/organization-member-settings.html', context)

    def post(self, request, organization, member_id):
        try:
            member = OrganizationMember.objects.get(id=member_id)
        except OrganizationMember.DoesNotExist:
            return HttpResponseRedirect(reverse('sentry'))

        form = self.get_form(request, member)
        if form.is_valid():
            member = form.save()

            messages.add_message(request, messages.SUCCESS,
                _('Your changes were saved.'))

            AuditLogEntry.objects.create(
                organization=organization,
                actor=request.user,
                target_object=member.id,
                target_user=member.user,
                event=AuditLogEntryEvent.MEMBER_EDIT,
                data=member.get_audit_log_data(),
            )

            redirect = reverse('sentry-organization-member-settings',
                               args=[organization.id, member.id])

            return HttpResponseRedirect(redirect)

        context = {
            'member': member,
            'form': form,
        }

        return self.respond('sentry/organization-member-settings.html', context)

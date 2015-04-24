from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, Organization, OrganizationMemberType
)
from sentry.web.frontend.base import OrganizationView


class OrganizationSettingsForm(forms.ModelForm):
    name = forms.CharField(help_text=_('The name of your organization. i.e. My Company'))
    slug = forms.SlugField(help_text=_('A unique ID used to identify this organization.'))
    allow_joinleave = forms.BooleanField(
        label=_('Open Membership'),
        help_text=_('Allow organization members to freely join or leave any team.'),
        required=False,
    )

    class Meta:
        fields = ('name', 'slug')
        model = Organization


class OrganizationSettingsView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get_form(self, request, organization):
        return OrganizationSettingsForm(
            request.POST or None,
            instance=organization,
            initial={
                'allow_joinleave': bool(getattr(organization.flags, 'allow_joinleave')),
            }
        )

    def handle(self, request, organization):
        form = self.get_form(request, organization)
        if form.is_valid():
            instance = form.save(commit=False)
            setattr(instance.flags, 'allow_joinleave', form.cleaned_data['allow_joinleave'])
            instance.save()

            AuditLogEntry.objects.create(
                organization=organization,
                actor=request.user,
                ip_address=request.META['REMOTE_ADDR'],
                target_object=organization.id,
                event=AuditLogEntryEvent.ORG_EDIT,
                data=organization.get_audit_log_data(),
            )

            messages.add_message(request, messages.SUCCESS,
                _('Changes to your organization were saved.'))

            return HttpResponseRedirect(reverse('sentry-organization-settings', args=[organization.slug]))

        context = {
            'form': form,
        }

        return self.respond('sentry/organization-settings.html', context)

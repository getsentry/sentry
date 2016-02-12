from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry import roles
from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, Organization
)
from sentry.web.frontend.base import OrganizationView


class OrganizationSettingsForm(forms.ModelForm):
    name = forms.CharField(help_text=_('The name of your organization. i.e. My Company'))
    slug = forms.SlugField(
        label=_('Short name'),
        help_text=_('A unique ID used to identify this organization.'),
    )
    allow_joinleave = forms.BooleanField(
        label=_('Open Membership'),
        help_text=_('Allow organization members to freely join or leave any team.'),
        required=False,
    )
    default_role = forms.ChoiceField(
        label=_('Default Role'),
        choices=roles.get_choices(),
        help_text=_('The default role new members will receive.'),
    )
    enhanced_privacy = forms.BooleanField(
        label=_('Enhanced Privacy'),
        help_text=_('Enable enhanced privacy controls to limit personally identifiable information (PII) as well as source code in things like notifications.'),
        required=False,
    )

    class Meta:
        fields = ('name', 'slug', 'default_role')
        model = Organization


class OrganizationSettingsView(OrganizationView):
    required_scope = 'org:write'

    def get_form(self, request, organization):
        return OrganizationSettingsForm(
            request.POST or None,
            instance=organization,
            initial={
                'default_role': organization.default_role,
                'allow_joinleave': bool(organization.flags.allow_joinleave),
                'enhanced_privacy': bool(organization.flags.enhanced_privacy),
            }
        )

    def handle(self, request, organization):
        form = self.get_form(request, organization)
        if form.is_valid():
            instance = form.save(commit=False)
            instance.flags.allow_joinleave = form.cleaned_data['allow_joinleave']
            instance.flags.enhanced_privacy = form.cleaned_data['enhanced_privacy']
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

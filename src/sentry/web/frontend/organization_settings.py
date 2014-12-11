from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import Organization, OrganizationMemberType
from sentry.web.frontend.base import OrganizationView


class OrganizationSettingsForm(forms.ModelForm):
    class Meta:
        fields = ('name', 'slug')
        model = Organization


class OrganizationSettingsView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get_form(self, request, organization):
        return OrganizationSettingsForm(
            request.POST or None,
            instance=organization
        )

    def handle(self, request, organization):
        form = self.get_form(request, organization)
        if form.is_valid():
            form.save()

            messages.add_message(request, messages.SUCCESS,
                _('Changes to your organization were saved.'))

            return HttpResponseRedirect(reverse('sentry-organization-settings', args=[organization.slug]))

        context = {
            'form': form,
        }

        return self.respond('sentry/organization-settings.html', context)

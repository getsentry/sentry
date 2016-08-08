from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.utils.translation import ugettext_lazy as _

from sentry.models import ApiKey, AuditLogEntryEvent
from sentry.web.forms.fields import OriginsField
from sentry.web.frontend.base import OrganizationView


class ApiKeyForm(forms.ModelForm):
    allowed_origins = OriginsField(label=_('Allowed Domains'), required=False,
        help_text=_('Separate multiple entries with a newline.'))

    class Meta:
        model = ApiKey
        fields = ('label', 'scopes')


class OrganizationApiKeySettingsView(OrganizationView):
    required_scope = 'org:delete'

    def handle(self, request, organization, key_id):
        key = get_object_or_404(ApiKey, organization=organization, id=key_id)

        form = ApiKeyForm(
            request.POST or None, instance=key, initial={
                'allowed_origins': key.allowed_origins,
            },
        )

        if form.is_valid():
            key.allowed_origins = '\n'.join(form.cleaned_data['allowed_origins'])
            key.save()

            self.create_audit_entry(
                request,
                organization=organization,
                target_object=key.id,
                event=AuditLogEntryEvent.APIKEY_EDIT,
                data=key.get_audit_log_data(),
            )

            messages.add_message(
                request, messages.SUCCESS,
                'Your settings were saved.',
            )
            return HttpResponseRedirect(request.path)

        context = {
            'key': key,
            'form': form,
        }

        return self.respond('sentry/organization-api-key-settings.html', context)

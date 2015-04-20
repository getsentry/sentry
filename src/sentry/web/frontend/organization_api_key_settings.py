from __future__ import absolute_import

from django import forms

from sentry.models import ApiKey, OrganizationMemberType
from sentry.web.frontend.base import OrganizationView


class ApiKeyForm(forms.ModelForm):
    class Meta:
        model = ApiKey
        fields = ('label', 'scopes', 'allowed_origins')


class OrganizationApiKeySettingsView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def handle(self, request, organization, key_id):
        key = ApiKey.objects.get(organization=organization, id=key_id)

        form = ApiKeyForm(request.POST or None, instance=key)

        context = {
            'key': key,
            'form': form,
        }

        return self.respond('sentry/organization-api-key-settings.html', context)

from __future__ import absolute_import

from django import forms
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect

from sentry.models import OrganizationMember, OrganizationMemberType
from sentry.web.forms.fields import UserField
from sentry.web.frontend.base import OrganizationView


class EditOrganizationMemberForm(forms.ModelForm):
    user = UserField()

    class Meta:
        fields = ('type', 'user', 'has_global_access', 'teams')
        model = OrganizationMember


class OrganizationMemberSettingsView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get_form(self, request):
        initial = {
            'type': OrganizationMemberType.MEMBER,
            'has_global_access': True,
        }

        return EditOrganizationMemberForm(request.POST or None, initial=initial)

    def get(self, request, organization, member_id):
        try:
            member = OrganizationMember.objects.get(id=member_id)
        except OrganizationMember.DoesNotExist:
            return HttpResponseRedirect(reverse('sentry'))

        form = self.get_form(request)

        context = {
            'member': member,
            'form': form,
        }

        return self.respond('sentry/organization-member-settings.html', context)

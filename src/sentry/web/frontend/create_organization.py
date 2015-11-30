from __future__ import absolute_import

from django import forms
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry import features, roles
from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, Organization, OrganizationMember,
    OrganizationMemberTeam
)
from sentry.web.frontend.base import BaseView


class NewOrganizationForm(forms.ModelForm):
    name = forms.CharField(label=_('Organization Name'), max_length=200,
        widget=forms.TextInput(attrs={'placeholder': _('My Company')}))

    class Meta:
        fields = ('name',)
        model = Organization


class CreateOrganizationView(BaseView):
    def get_form(self, request):
        return NewOrganizationForm(request.POST or None)

    def has_permission(self, request):
        return features.has('organizations:create', actor=request.user)

    def handle(self, request):
        form = self.get_form(request)
        if form.is_valid():
            org = form.save()

            om = OrganizationMember.objects.create(
                organization=org,
                user=request.user,
                role=roles.get_top_dog().id,
            )

            team = org.team_set.create(
                name=org.name,
            )

            OrganizationMemberTeam.objects.create(
                team=team,
                organizationmember=om,
                is_active=True
            )

            AuditLogEntry.objects.create(
                organization=org,
                actor=request.user,
                ip_address=request.META['REMOTE_ADDR'],
                target_object=org.id,
                event=AuditLogEntryEvent.ORG_ADD,
                data=org.get_audit_log_data(),
            )

            url = reverse('sentry-create-project', args=[org.slug])

            return HttpResponseRedirect('{}?team={}'.format(url, team.slug))

        context = {
            'form': form,
        }

        return self.respond('sentry/create-organization.html', context)

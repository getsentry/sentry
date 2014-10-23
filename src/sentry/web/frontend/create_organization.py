from __future__ import absolute_import

from django import forms
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry.models import Organization, Team
from sentry.permissions import can_create_organizations
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
        if not can_create_organizations(request.user):
            return False
        return True

    def get(self, request):
        form = self.get_form(request)

        context = {
            'form': form,
        }

        return self.respond('sentry/create-organization.html', context)

    def post(self, request):
        form = self.get_form(request)
        if form.is_valid():
            org = form.save(commit=False)
            org.owner = request.user
            org.save()

            # create a default team for this org
            team = Team.objects.create(
                name=org.name,
                organization=org,
                owner=org.owner,
            )
            return HttpResponseRedirect(reverse('sentry-new-project', args=[team.slug]))

        context = {
            'form': form,
        }

        return self.respond('sentry/create-organization.html', context)

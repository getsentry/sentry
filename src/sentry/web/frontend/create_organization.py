from __future__ import absolute_import

from django import forms
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry import features
from sentry.api import client
from sentry.web.frontend.base import BaseView


class NewOrganizationForm(forms.Form):
    name = forms.CharField(label=_('Organization Name'), max_length=200,
        widget=forms.TextInput(attrs={'placeholder': _('My Company')}))


class CreateOrganizationView(BaseView):
    def get_form(self, request):
        return NewOrganizationForm(request.POST or None)

    def has_permission(self, request):
        return features.has('organizations:create', actor=request.user)

    def handle(self, request):
        form = self.get_form(request)
        if form.is_valid():
            resp = client.post('/organizations/', data={
                'name': form.cleaned_data['name'],
                'defaultTeam': True,
            }, request=request)

            url = reverse('sentry-create-project', args=[resp.data['slug']])

            return HttpResponseRedirect(url)

        context = {
            'form': form,
        }

        return self.respond('sentry/create-organization.html', context)

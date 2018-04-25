from __future__ import absolute_import

from django.db import IntegrityError, transaction
from django import forms

from .utils import get_integration_from_request, JiraValidationError
from sentry.models import OrganizationIntegration
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response


# TODO(jess): support linking a single JIRA instance to multiple orgs
class JiraConfigForm(forms.Form):
    organization = forms.ChoiceField(
        label='Sentry Organization',
        choices=tuple(),
        widget=forms.Select(attrs={'class': 'select'})
    )

    def __init__(self, organizations, *args, **kwargs):
        super(JiraConfigForm, self).__init__(*args, **kwargs)
        self.fields['organization'].choices = organizations


class JiraConfigureView(BaseView):

    def get_response(self, context):
        context['ac_js_src'] = '%s%s%s' % (
            self.request.GET['xdm_e'], self.request.GET.get('cp', ''),
            '/atlassian-connect/all.js'
        )
        res = render_to_response('sentry/jira-configure.html', context, self.request)
        res['X-Frame-Options'] = 'ALLOW-FROM %s' % self.request.GET['xdm_e']
        return res

    def handle(self, request):
        try:
            integration = get_integration_from_request(request)
        except JiraValidationError:
            return self.get_response({'error_message': 'Unable to verify installation.'})

        # TODO(jess): restrict to org owners?
        org_choices = [(o.id, o.name) for o in request.user.get_orgs()]

        if request.method == 'GET':
            form = JiraConfigForm(org_choices)
        else:
            form = JiraConfigForm(org_choices, request.POST)
            if form.is_valid():
                organization_id = form.cleaned_data['organization']
                try:
                    with transaction.atomic():
                        OrganizationIntegration.objects.create(
                            organization_id=organization_id,
                            integration=integration,
                        )
                except IntegrityError:
                    return self.get_response({
                        'error_message': 'That Sentry organization is already linked.',
                        'form': form,
                    })

        return self.get_response({'form': form})

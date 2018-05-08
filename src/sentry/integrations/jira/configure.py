from __future__ import absolute_import

from django import forms

from sentry.utils.atlassian_connect import get_integration_from_request, ConnectValidationError
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
        context['ac_js_src'] = '%(base_url)s%(context_path)s/atlassian-connect/all.js' % {
            'base_url': self.request.GET['xdm_e'],
            'context_path': self.request.GET.get('cp', ''),
        }
        res = render_to_response('sentry/jira-configure.html', context, self.request)
        res['X-Frame-Options'] = 'ALLOW-FROM %s' % self.request.GET['xdm_e']
        return res

    def handle(self, request):
        try:
            integration = get_integration_from_request(request)
        except ConnectValidationError:
            return self.get_response({'error_message': 'Unable to verify installation.'})

        # TODO(jess): restrict to org owners?
        org_choices = [(o.id, o.name) for o in request.user.get_orgs()]

        if request.method == 'GET':
            form = JiraConfigForm(org_choices)
        else:
            form = JiraConfigForm(org_choices, request.POST)
            if form.is_valid():
                organization_id = form.cleaned_data['organization']
                added = integration.add_organization(organization_id)
                if not added:
                    return self.get_response({
                        'error_message': 'That Sentry organization is already linked.',
                        'form': form,
                    })

        return self.get_response({'form': form})

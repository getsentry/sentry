from __future__ import absolute_import

from django import forms

from sentry.integrations.atlassian_connect import AtlassianConnectValidationError, get_integration_from_request
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response
from sentry.models import OrganizationIntegration, ProjectIntegration


class JiraConfigForm(forms.Form):
    organizations = forms.MultipleChoiceField(
        label='Enabled Sentry Organizations',
        help_text="Select which Sentry organizations the JIRA Integration is enabled for. Note, removing the integration from an organization will clear it's settings.",
        choices=tuple(),
        required=False,
        widget=forms.CheckboxSelectMultiple,
    )

    def __init__(self, organizations, *args, **kwargs):
        super(JiraConfigForm, self).__init__(*args, **kwargs)
        self.fields['organizations'].choices = [(o.id, o.slug) for o in organizations]


class JiraConfigureView(BaseView):

    def get_response(self, context):
        context['ac_js_src'] = '%(base_url)s%(context_path)s/atlassian-connect/all.js' % {
            'base_url': self.request.GET['xdm_e'],
            'context_path': self.request.GET.get('cp', ''),
        }
        res = render_to_response('sentry/integrations/jira-config.html', context, self.request)
        res['X-Frame-Options'] = 'ALLOW-FROM %s' % self.request.GET['xdm_e']
        return res

    def handle(self, request):
        try:
            integration = get_integration_from_request(request)
        except AtlassianConnectValidationError:
            return self.get_response({'error_message': 'Unable to verify installation.'})

        # TODO(jess): restrict to org owners?
        organizations = request.user.get_orgs()
        form = JiraConfigForm(organizations, request.POST)

        if request.method == 'GET' or not form.is_valid():
            form = JiraConfigForm(organizations)
            return self.get_response({'form': form})

        enabled_orgs = [int(o) for o in form.cleaned_data['organizations']]
        disabled_orgs = list(set(o.id for o in organizations) - set(enabled_orgs))

        # Remove organization and project JIRA integrations not in the set of
        # enabled organizations
        OrganizationIntegration.objects.filter(
            integration__provider='jira',
            organization__in=disabled_orgs,
        ).delete()
        ProjectIntegration.objects.filter(
            integration__provider='jira',
            integration__organizations__in=disabled_orgs,
        ).delete()

        # Ensure all enabled integrations.
        for org_id in enabled_orgs:
            integration.add_organization(org_id)

        return self.get_response({'form': form})

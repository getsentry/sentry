from __future__ import absolute_import

from django import forms

from sentry import roles
from sentry.integrations.atlassian_connect import AtlassianConnectValidationError, get_integration_from_request
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response
from sentry.models import OrganizationIntegration, OrganizationMember, ProjectIntegration


class JiraConfigForm(forms.Form):
    organizations = forms.TypedMultipleChoiceField(
        label='Enabled Sentry Organizations',
        help_text="Select which Sentry organizations the Jira Integration is enabled for. Note, removing the integration from an organization will clear its settings.",
        coerce=int,
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
            integration = get_integration_from_request(request, 'jira')
        except AtlassianConnectValidationError:
            return self.get_response({'error_message': 'Unable to verify installation.'})

        organizations = request.user.get_orgs().filter(
            id__in=OrganizationMember.objects.filter(
                role__in=[r.id for r in roles.get_all() if r.is_global],
            ),
        )
        form = JiraConfigForm(organizations, request.POST)

        if request.method == 'GET' or not form.is_valid():
            active_orgs = OrganizationIntegration.objects.filter(
                integration__provider='jira',
                integration=integration,
                organization__in=organizations
            ).values_list('organization_id', flat=True)

            form = JiraConfigForm(organizations, initial={'organizations': active_orgs})
            return self.get_response({'form': form})

        enabled_orgs = form.cleaned_data['organizations']
        disabled_orgs = list(set(o.id for o in organizations) - set(enabled_orgs))

        # Remove organization and project Jira integrations not in the set of
        # enabled organizations
        OrganizationIntegration.objects.filter(
            integration__provider='jira',
            integration=integration,
            organization__in=disabled_orgs,
        ).delete()
        ProjectIntegration.objects.filter(
            integration__provider='jira',
            integration=integration,
            integration__organizations__in=disabled_orgs,
        ).delete()

        # Ensure all enabled integrations.
        for org_id in enabled_orgs:
            integration.add_organization(org_id)

        return self.get_response({'form': form, 'completed': True})

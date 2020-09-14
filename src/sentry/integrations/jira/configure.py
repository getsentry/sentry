from __future__ import absolute_import


from ua_parser import user_agent_parser
from jwt import ExpiredSignatureError

from django import forms
from django.core.urlresolvers import reverse
from django.views.generic import View

from sentry import roles
from sentry.integrations.atlassian_connect import (
    AtlassianConnectValidationError,
    get_integration_from_request,
)
from sentry.utils.http import absolute_uri
from sentry.web.helpers import render_to_response
from sentry.models import OrganizationIntegration, OrganizationMember


class JiraConfigForm(forms.Form):
    organizations = forms.TypedMultipleChoiceField(
        label="Enabled Sentry Organizations",
        help_text="Select which Sentry organizations the Jira Integration is enabled for. Note, removing the integration from an organization will clear its settings.",
        coerce=int,
        choices=tuple(),
        required=False,
        widget=forms.CheckboxSelectMultiple,
    )

    def __init__(self, organizations, *args, **kwargs):
        super(JiraConfigForm, self).__init__(*args, **kwargs)
        self.fields["organizations"].choices = [(o.id, o.slug) for o in organizations]


class JiraConfigureView(View):
    def get_response(self, context):
        context["ac_js_src"] = "https://connect-cdn.atl-paas.net/all.js"
        res = render_to_response("sentry/integrations/jira-config.html", context, self.request)
        res["X-Frame-Options"] = "ALLOW-FROM %s" % self.request.GET["xdm_e"]
        return res

    def get(self, request, *args, **kwargs):
        return self.handle(request)

    def post(self, request, *args, **kwargs):
        return self.handle(request)

    def handle(self, request):
        try:
            integration = get_integration_from_request(request, "jira")
        except AtlassianConnectValidationError:
            return self.get_response({"error_message": "Unable to verify installation."})
        except ExpiredSignatureError:
            return self.get_response({"refresh_required": True})

        if not request.user.is_authenticated():
            parsed_user_agent = user_agent_parser.ParseUserAgent(
                request.META.get("HTTP_USER_AGENT", "")
            )
            # not enabling cross site cookies seems to be a common problem with Safari
            # as a result, there is a Safari specific link to instructions when is_safari=true
            is_safari = parsed_user_agent.get("family") == "Safari"
            return self.get_response(
                {
                    "login_required": True,
                    "is_safari": is_safari,
                    "login_url": absolute_uri(reverse("sentry-login")),
                }
            )

        organizations = list(
            request.user.get_orgs().filter(
                id__in=OrganizationMember.objects.filter(
                    role__in=[r.id for r in roles.get_all() if r.is_global], user=request.user
                ).values("organization")
            )
        )

        form = JiraConfigForm(organizations, request.POST)

        if request.method == "GET" or not form.is_valid():
            active_orgs = OrganizationIntegration.objects.filter(
                integration__provider="jira",
                integration=integration,
                organization__in=organizations,
            ).values_list("organization_id", flat=True)

            form = JiraConfigForm(organizations, initial={"organizations": active_orgs})
            return self.get_response({"form": form, "organizations": organizations})

        enabled_orgs = [o for o in organizations if o.id in form.cleaned_data["organizations"]]
        disabled_orgs = list(set(organizations) - set(enabled_orgs))

        # Remove Jira integrations not in the set of enabled organizations
        OrganizationIntegration.objects.filter(
            integration__provider="jira", integration=integration, organization__in=disabled_orgs
        ).delete()

        # Ensure all enabled integrations.
        for org in enabled_orgs:
            integration.add_organization(org, request.user)

        return self.get_response({"form": form, "completed": True})

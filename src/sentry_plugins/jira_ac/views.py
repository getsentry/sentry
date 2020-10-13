from __future__ import absolute_import

from six.moves.urllib.parse import urlparse

from django.forms.utils import ErrorList
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from django.core.urlresolvers import reverse
from django.utils.decorators import method_decorator

from sentry.utils import json
from sentry.models import Organization
from sentry.utils.http import absolute_uri
from sentry.web.helpers import render_to_response

from sentry_plugins.jira_ac.forms import JiraConfigForm
from sentry_plugins.jira_ac.models import JiraTenant
from sentry_plugins.jira_ac.utils import get_jira_auth_from_request, ApiError
from jwt.exceptions import ExpiredSignatureError

JIRA_KEY = "%s.jira_ac" % (urlparse(absolute_uri()).hostname,)


class BaseJiraWidgetView(View):
    jira_auth = None

    def get_jira_auth(self):
        if self.jira_auth is None:
            self.jira_auth = get_jira_auth_from_request(self.request)
        return self.jira_auth

    def get_context(self):
        return {
            "ac_js_src": "https://connect-cdn.atl-paas.net/all.js",
            "login_url": absolute_uri(reverse("sentry-login")),
            "body_class": "",
        }

    def get_response(self, template, context=None):
        context = context or self.get_context()
        res = render_to_response(template, context, self.request)
        res["X-Frame-Options"] = "ALLOW-FROM %s" % self.request.GET["xdm_e"]
        return res


class JiraUIWidgetView(BaseJiraWidgetView):
    def get(self, request, *args, **kwargs):
        try:
            # make sure this exists and is valid
            jira_auth = self.get_jira_auth()
        except (ApiError, JiraTenant.DoesNotExist, ExpiredSignatureError):
            return self.get_response("error.html")

        if request.user.is_anonymous():
            return self.get_response("signin.html")

        org = jira_auth.organization
        context = self.get_context()
        if org is None:
            context.update(
                {
                    "error_message": (
                        "You still need to configure this plugin, which "
                        "can be done from the Manage Add-ons page."
                    )
                }
            )
            return self.get_response("error.html", context)

        context.update(
            {
                "sentry_api_url": absolute_uri(
                    "/api/0/organizations/%s/users/issues/" % (org.slug,)
                ),
                "issue_key": self.request.GET.get("issueKey"),
            }
        )

        return self.get_response("widget.html", context)


class JiraConfigView(BaseJiraWidgetView):
    def get_context(self):
        context = super(JiraConfigView, self).get_context()
        context["body_class"] = "aui-page-focused aui-page-size-medium"
        return context

    def get(self, request, *args, **kwargs):
        try:
            jira_auth = self.get_jira_auth()
        except (ApiError, JiraTenant.DoesNotExist):
            return self.get_response("error.html")

        if request.user.is_anonymous():
            return self.get_response("signin.html")

        org = jira_auth.organization
        form_context = None
        if org:
            form_context = {"organization": org.id}

        form = JiraConfigForm([(o.id, o.name) for o in request.user.get_orgs()], form_context)
        context = self.get_context()
        context.update({"is_configured": jira_auth.is_configured(), "form": form})

        return self.get_response("config.html", context)

    def post(self, request, *args, **kwargs):
        try:
            jira_auth = get_jira_auth_from_request(request)
        except (ApiError, JiraTenant.DoesNotExist):
            self.get_response("error.html")

        if request.user.is_anonymous():
            return self.get_response("signin.html")

        orgs = self.request.user.get_orgs()

        form = JiraConfigForm([(o.id, o.name) for o in orgs], self.request.POST)

        if form.is_valid():
            try:
                org = orgs.get(id=form.cleaned_data["organization"])
            except Organization.DoesNotExist:
                errors = form._errors.setdefault("organization", ErrorList())
                errors.append("Invalid organization")
            else:
                jira_auth.update(organization=org)

        context = self.get_context()
        context.update({"is_configured": jira_auth.is_configured(), "form": form})

        return self.get_response("config.html", context)


class JiraDescriptorView(View):
    def get(self, request, *args, **kwargs):
        return HttpResponse(
            json.dumps(
                {
                    "name": "Sentry for JIRA",
                    "description": "Sentry add-on for JIRA",
                    "key": JIRA_KEY,
                    "baseUrl": absolute_uri(),
                    "vendor": {"name": "Sentry", "url": "https://sentry.io"},
                    "authentication": {"type": "jwt"},
                    "lifecycle": {"installed": "/plugins/jira-ac/installed"},
                    "apiVersion": 1,
                    "modules": {
                        "webPanels": [
                            {
                                "key": "sentry-issues",
                                "location": "atl.jira.view.issue.right.context",
                                "name": {"value": "Related Sentry Issues"},
                                "url": "/plugins/jira-ac/plugin?issueKey={issue.key}",
                            }
                        ],
                        "configurePage": {
                            "url": "/plugins/jira-ac/config",
                            "name": {"value": "Configure Sentry Add-on"},
                            "key": "configure-sentry",
                        },
                    },
                    "scopes": ["read"],
                }
            ),
            content_type="application/json",
        )


class JiraInstalledCallback(View):
    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        return super(JiraInstalledCallback, self).dispatch(request, *args, **kwargs)

    @method_decorator(csrf_exempt)
    def post(self, request, *args, **kwargs):
        registration_info = json.loads(request.body)
        JiraTenant.objects.create_or_update(
            client_key=registration_info["clientKey"],
            values={
                "secret": registration_info["sharedSecret"],
                "base_url": registration_info["baseUrl"],
                "public_key": registration_info["publicKey"],
            },
        )
        return HttpResponse(json.dumps({}), content_type="application/json")

from django.conf import settings
from django.urls import reverse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.utils.assets import get_frontend_app_asset_url
from sentry.utils.http import absolute_uri

from .. import JIRA_KEY

scopes = ["read", "write", "act_as_user"]
# For Jira, only approved apps can use the access_email_addresses scope
# This scope allows Sentry to use the email endpoint (https://developer.atlassian.com/cloud/jira/platform/rest/v3/#api-rest-api-3-user-email-get)
# We use the email with Jira 2-way sync in order to match the user
if settings.JIRA_USE_EMAIL_SCOPE:
    scopes.append("access_email_addresses")


@control_silo_endpoint
class JiraDescriptorEndpoint(Endpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    """
    Provides the metadata needed by Jira to setup an instance of the Sentry integration within Jira.
    Only used by on-prem orgs and devs setting up local instances of the integration. (Sentry SAAS
    already has an established, official instance of the Sentry integration registered with Jira.)
    """

    authentication_classes = ()
    permission_classes = ()

    def get(self, request: Request) -> Response:
        sentry_logo = absolute_uri(
            get_frontend_app_asset_url("sentry", "entrypoints/logo-sentry.svg")
        )
        return self.respond(
            {
                "name": "Sentry",
                "description": "Connect your Sentry organization to one or more of your Jira cloud instances. Get started streamlining your bug-squashing workflow by allowing your Sentry and Jira instances to work together.",
                "key": JIRA_KEY,
                "baseUrl": absolute_uri(),
                "vendor": {"name": "Sentry", "url": "https://sentry.io"},
                "authentication": {"type": "jwt"},
                "lifecycle": {
                    "installed": "/extensions/jira/installed/",
                    "uninstalled": "/extensions/jira/uninstalled/",
                },
                "apiVersion": 1,
                "modules": {
                    "postInstallPage": {
                        "url": "/extensions/jira/ui-hook/",
                        "name": {"value": "Configure Sentry Add-on"},
                        "key": "post-install-sentry",
                    },
                    "configurePage": {
                        "url": "/extensions/jira/ui-hook/",
                        "name": {"value": "Configure Sentry Add-on"},
                        "key": "configure-sentry",
                    },
                    "jiraIssueContexts": [
                        {
                            "icon": {"width": 24, "height": 24, "url": sentry_logo},
                            "content": {"type": "label", "label": {"value": "Linked Issues"}},
                            "target": {
                                "type": "web_panel",
                                "url": "/extensions/jira/issue/{issue.key}/",
                            },
                            "name": {"value": "Sentry "},
                            "key": "sentry-issues-glance",
                        }
                    ],
                    "webhooks": [
                        {
                            "event": "jira:issue_updated",
                            "url": reverse("sentry-extensions-jira-issue-updated"),
                            "excludeBody": False,
                        }
                    ],
                },
                "apiMigrations": {"gdpr": True, "context-qsh": True, "signed-install": True},
                "scopes": scopes,
            }
        )

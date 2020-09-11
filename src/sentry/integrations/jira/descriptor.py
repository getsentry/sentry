from __future__ import absolute_import

from django.conf import settings
from django.core.urlresolvers import reverse

from sentry.api.base import Endpoint
from sentry.utils.http import absolute_uri

from .client import JIRA_KEY

scopes = ["read", "write", "act_as_user"]
# For Jira, only approved apps can use the access_email_addresses scope
# This scope allows Sentry to use the email endpoint (https://developer.atlassian.com/cloud/jira/platform/rest/v3/#api-rest-api-3-user-email-get)
# We use the email with Jira 2-way sync in order to match the user
if settings.JIRA_USE_EMAIL_SCOPE:
    scopes.append("access_email_addresses")


class JiraDescriptorEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def get(self, request):
        return self.respond(
            {
                "name": "Sentry",
                "description": "Sentry",
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
                        "url": "/extensions/jira/ui-hook",
                        "name": {"value": "Configure Sentry Add-on"},
                        "key": "post-install-sentry",
                    },
                    "configurePage": {
                        "url": "/extensions/jira/ui-hook",
                        "name": {"value": "Link your Sentry Organization"},
                        "key": "configure-sentry",
                    },
                    "webhooks": [
                        {
                            "event": "jira:issue_updated",
                            "url": reverse("sentry-extensions-jira-issue-updated"),
                            "excludeBody": False,
                        }
                    ],
                },
                "apiMigrations": {"gdpr": True},
                "scopes": scopes,
            }
        )

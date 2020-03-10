from __future__ import absolute_import

from sentry_plugins.base import CorePluginMixin

from sentry.plugins.base import Plugin


class JiraACPlugin(CorePluginMixin, Plugin):
    description = "Add a Sentry UI Plugin to JIRA"
    slug = "jira-ac"
    title = "JIRA Atlassian Connect"
    conf_title = title
    conf_key = "jira-ac"

    def get_url_module(self):
        return "sentry_plugins.jira_ac.urls"

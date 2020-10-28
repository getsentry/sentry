from __future__ import absolute_import

from sentry.integrations.jira.search import JiraSearchEndpoint


class JiraServerSearchEndpoint(JiraSearchEndpoint):
    provider = "jira_server"

from sentry.integrations.jira.search import JiraSearchEndpoint


class JiraServerSearchEndpoint(JiraSearchEndpoint):
    provider = "jira_server"

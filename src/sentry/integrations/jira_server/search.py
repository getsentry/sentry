from sentry.integrations.jira.webhooks import JiraSearchEndpoint


class JiraServerSearchEndpoint(JiraSearchEndpoint):
    provider = "jira_server"

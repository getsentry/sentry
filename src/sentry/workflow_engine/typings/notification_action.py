from typing import Literal

from sentry.integrations.base import IntegrationProviderSlug

INTEGRATION_PROVIDER_2_RULE_REGISTRY_ID: dict[
    IntegrationProviderSlug | Literal["sentry_app", "email"], str
] = {
    IntegrationProviderSlug.SLACK: "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
    IntegrationProviderSlug.DISCORD: "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
    IntegrationProviderSlug.MSTEAMS: "sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction",
    IntegrationProviderSlug.PAGERDUTY: "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
    IntegrationProviderSlug.OPSGENIE: "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
    IntegrationProviderSlug.GITHUB: "sentry.integrations.github.notify_action.GitHubCreateTicketAction",
    IntegrationProviderSlug.GITHUB_ENTERPRISE: "sentry.integrations.github_enterprise.notify_action.GitHubEnterpriseCreateTicketAction",
    IntegrationProviderSlug.JIRA: "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
    IntegrationProviderSlug.JIRA_SERVER: "sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction",
    IntegrationProviderSlug.AZURE_DEVOPS: "sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction",
    "sentry_app": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
    "email": "sentry.mail.actions.NotifyEmailAction",
}

RULE_REGISTRY_ID_2_INTEGRATION_PROVIDER: dict[
    str, IntegrationProviderSlug | Literal["sentry_app", "email"]
] = {v: k for k, v in INTEGRATION_PROVIDER_2_RULE_REGISTRY_ID.items()}

ACTION_TYPE_2_INTEGRATION_ID_KEY: dict[IntegrationProviderSlug, str] = {
    IntegrationProviderSlug.SLACK: "workspace",
    IntegrationProviderSlug.DISCORD: "server",
    IntegrationProviderSlug.MSTEAMS: "team",
    IntegrationProviderSlug.PAGERDUTY: "account",
    IntegrationProviderSlug.OPSGENIE: "account",
    IntegrationProviderSlug.GITHUB: "integration",
    IntegrationProviderSlug.GITHUB_ENTERPRISE: "integration",
    IntegrationProviderSlug.JIRA: "integration",
    IntegrationProviderSlug.JIRA_SERVER: "integration",
    IntegrationProviderSlug.AZURE_DEVOPS: "integration",
}

INTEGRATION_ID_KEY_2_ACTION_TYPE: dict[str, IntegrationProviderSlug] = {
    v: k for k, v in ACTION_TYPE_2_INTEGRATION_ID_KEY.items()
}


ACTION_TYPE_2_TARGET_IDENTIFIER_KEY: dict[IntegrationProviderSlug, str] = {
    IntegrationProviderSlug.SLACK: "channel_id",
    IntegrationProviderSlug.DISCORD: "channel_id",
    IntegrationProviderSlug.MSTEAMS: "channel_id",
    IntegrationProviderSlug.PAGERDUTY: "service",
    IntegrationProviderSlug.OPSGENIE: "team",
}

TARGET_IDENTIFIER_KEY_2_ACTION_TYPE: dict[str, IntegrationProviderSlug] = {
    v: k for k, v in ACTION_TYPE_2_TARGET_IDENTIFIER_KEY.items()
}

ACTION_TYPE_2_TARGET_DISPLAY_KEY: dict[IntegrationProviderSlug, str] = {
    IntegrationProviderSlug.SLACK: "channel",
    IntegrationProviderSlug.MSTEAMS: "channel",
}

TARGET_DISPLAY_KEY_2_ACTION_TYPE: dict[str, IntegrationProviderSlug] = {
    v: k for k, v in ACTION_TYPE_2_TARGET_DISPLAY_KEY.items()
}

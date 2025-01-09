from dataclasses import dataclass

from sentry.notifications.models.notificationaction import ActionTarget
from sentry.workflow_engine.models.action import Action

"""
Keys that are excluded from the action data blob.
We don't want to save these keys because:
- uuid: maps to action id
- id: maps to action type
"""
EXCLUDED_ACTION_DATA_KEYS = ["uuid", "id"]

"""
Action types that are integrations
"""
INTEGRATION_ACTION_TYPES = [
    Action.Type.SLACK,
    Action.Type.DISCORD,
    Action.Type.MSTEAMS,
    Action.Type.PAGERDUTY,
    Action.Type.OPSGENIE,
    Action.Type.GITHUB,
    Action.Type.GITHUB_ENTERPRISE,
    Action.Type.JIRA,
    Action.Type.JIRA_SERVER,
    Action.Type.AZURE_DEVOPS,
]

ACTION_TYPE_TO_TARGET_TYPE_RULE_REGISTRY: dict[Action.Type, ActionTarget] = {
    Action.Type.SLACK: ActionTarget.SPECIFIC,
    Action.Type.DISCORD: ActionTarget.SPECIFIC,
    Action.Type.MSTEAMS: ActionTarget.SPECIFIC,
    Action.Type.PAGERDUTY: ActionTarget.SPECIFIC,
    Action.Type.OPSGENIE: ActionTarget.SPECIFIC,
    Action.Type.GITHUB: ActionTarget.SPECIFIC,
    Action.Type.GITHUB_ENTERPRISE: ActionTarget.SPECIFIC,
    Action.Type.JIRA: ActionTarget.SPECIFIC,
    Action.Type.JIRA_SERVER: ActionTarget.SPECIFIC,
    Action.Type.AZURE_DEVOPS: ActionTarget.SPECIFIC,
    Action.Type.SENTRY_APP: ActionTarget.SENTRY_APP,
    Action.Type.EMAIL: ActionTarget.USER,
    Action.Type.PLUGIN: ActionTarget.USER,
    Action.Type.WEBHOOK: ActionTarget.USER,
}

INTEGRATION_PROVIDER_TO_RULE_REGISTRY_ID: dict[Action.Type, str] = {
    Action.Type.SLACK: "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
    Action.Type.DISCORD: "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
    Action.Type.MSTEAMS: "sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction",
    Action.Type.PAGERDUTY: "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
    Action.Type.OPSGENIE: "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
    Action.Type.GITHUB: "sentry.integrations.github.notify_action.GitHubCreateTicketAction",
    Action.Type.GITHUB_ENTERPRISE: "sentry.integrations.github_enterprise.notify_action.GitHubEnterpriseCreateTicketAction",
    Action.Type.JIRA: "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
    Action.Type.JIRA_SERVER: "sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction",
    Action.Type.AZURE_DEVOPS: "sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction",
    Action.Type.SENTRY_APP: "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
    Action.Type.EMAIL: "sentry.mail.actions.NotifyEmailAction",
    Action.Type.PLUGIN: "sentry.rules.actions.notify_event.NotifyEventAction",
    Action.Type.WEBHOOK: "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
}

RULE_REGISTRY_ID_TO_INTEGRATION_PROVIDER: dict[str, Action.Type] = {
    v: k for k, v in INTEGRATION_PROVIDER_TO_RULE_REGISTRY_ID.items()
}

ACTION_TYPE_TO_INTEGRATION_ID_KEY: dict[Action.Type, str] = {
    Action.Type.SLACK: "workspace",
    Action.Type.DISCORD: "server",
    Action.Type.MSTEAMS: "team",
    Action.Type.PAGERDUTY: "account",
    Action.Type.OPSGENIE: "account",
    Action.Type.GITHUB: "integration",
    Action.Type.GITHUB_ENTERPRISE: "integration",
    Action.Type.JIRA: "integration",
    Action.Type.JIRA_SERVER: "integration",
    Action.Type.AZURE_DEVOPS: "integration",
}

INTEGRATION_ID_KEY_TO_ACTION_TYPE: dict[str, Action.Type] = {
    v: k for k, v in ACTION_TYPE_TO_INTEGRATION_ID_KEY.items()
}


ACTION_TYPE_TO_TARGET_IDENTIFIER_KEY: dict[Action.Type, str] = {
    Action.Type.SLACK: "channel_id",
    Action.Type.DISCORD: "channel_id",
    Action.Type.MSTEAMS: "channel_id",
    Action.Type.PAGERDUTY: "service",
    Action.Type.OPSGENIE: "team",
}

TARGET_IDENTIFIER_KEY_TO_ACTION_TYPE: dict[str, Action.Type] = {
    v: k for k, v in ACTION_TYPE_TO_TARGET_IDENTIFIER_KEY.items()
}

ACTION_TYPE_TO_TARGET_DISPLAY_KEY: dict[Action.Type, str] = {
    Action.Type.SLACK: "channel",
    Action.Type.MSTEAMS: "channel",
}

TARGET_DISPLAY_KEY_TO_ACTION_TYPE: dict[str, Action.Type] = {
    v: k for k, v in ACTION_TYPE_TO_TARGET_DISPLAY_KEY.items()
}


@dataclass
class DataBlob:
    """
    DataBlob is a generic type that represents the data blob for a notification action.
    """

    pass


@dataclass
class SlackDataBlob(DataBlob):
    """
    SlackDataBlob is a specific type that represents the data blob for a Slack notification action.
    """

    tags: str = ""
    notes: str = ""


ACTION_TYPE_2_BLOB_TYPE: dict[Action.Type, type[DataBlob]] = {
    Action.Type.SLACK: SlackDataBlob,
}

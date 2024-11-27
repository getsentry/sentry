from sentry.workflow_engine.models.action import Action

ACTION_TYPE_2_RULE_REGISTRY_ID: dict[Action.Type, str] = {
    Action.Type.NOTIFICATION_SLACK: "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
    Action.Type.NOTIFICATION_DISCORD: "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
    Action.Type.NOTIFICATION_MSTEAMS: "sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction",
    Action.Type.NOTIFICATION_PAGERDUTY: "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
    Action.Type.NOTIFICATION_OPSGENIE: "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
    Action.Type.NOTIFICATION_GITHUB: "sentry.integrations.github.notify_action.GitHubCreateTicketAction",
    Action.Type.NOTIFICATION_GITHUB_ENTERPRISE: "sentry.integrations.github_enterprise.notify_action.GitHubEnterpriseCreateTicketAction",
    Action.Type.NOTIFICATION_JIRA: "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
    Action.Type.NOTIFICATION_JIRA_SERVER: "sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction",
    Action.Type.NOTIFICATION_AZURE_DEVOPS: "sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction",
    Action.Type.NOTIFICATION_SENTRY_APP: "...",  # TODO(iamrajjoshi): Add the rule registry id
    Action.Type.NOTIFICATION_EMAIL: "...",  # TODO(iamrajjoshi): Add the rule registry id
}

RULE_REGISTRY_ID_2_ACTION_TYPE: dict[str, Action.Type] = {
    v: k for k, v in ACTION_TYPE_2_RULE_REGISTRY_ID.items()
}

ACTION_TYPE_2_INTEGRATION_ID_KEY: dict[Action.Type, str] = {
    Action.Type.NOTIFICATION_SLACK: "workspace",
    Action.Type.NOTIFICATION_DISCORD: "server",
    Action.Type.NOTIFICATION_MSTEAMS: "team",
    Action.Type.NOTIFICATION_PAGERDUTY: "account",
    Action.Type.NOTIFICATION_OPSGENIE: "account",
    Action.Type.NOTIFICATION_GITHUB: "integration",
    Action.Type.NOTIFICATION_GITHUB_ENTERPRISE: "integration",
    Action.Type.NOTIFICATION_JIRA: "integration",
    Action.Type.NOTIFICATION_JIRA_SERVER: "integration",
    Action.Type.NOTIFICATION_AZURE_DEVOPS: "integration",
}

INTEGRATION_ID_KEY_2_ACTION_TYPE: dict[str, Action.Type] = {
    v: k for k, v in ACTION_TYPE_2_INTEGRATION_ID_KEY.items()
}


ACTION_TYPE_2_TARGET_IDENTIFIER_KEY: dict[Action.Type, str] = {
    Action.Type.NOTIFICATION_SLACK: "channel_id",
    Action.Type.NOTIFICATION_DISCORD: "channel_id",
    Action.Type.NOTIFICATION_MSTEAMS: "channel_id",
    Action.Type.NOTIFICATION_PAGERDUTY: "service",
    Action.Type.NOTIFICATION_OPSGENIE: "team",
}

TARGET_IDENTIFIER_KEY_2_ACTION_TYPE: dict[str, Action.Type] = {
    v: k for k, v in ACTION_TYPE_2_TARGET_IDENTIFIER_KEY.items()
}

ACTION_TYPE_2_TARGET_DISPLAY_KEY: dict[Action.Type, str] = {
    Action.Type.NOTIFICATION_SLACK: "channel",
    Action.Type.NOTIFICATION_MSTEAMS: "channel",
}

TARGET_DISPLAY_KEY_2_ACTION_TYPE: dict[str, Action.Type] = {
    v: k for k, v in ACTION_TYPE_2_TARGET_DISPLAY_KEY.items()
}

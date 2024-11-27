from enum import StrEnum


class NotificationType(StrEnum):
    """
    Notification types for notification actions.
    Used in Action model type definition to determine the type of notification action.
    """

    Slack = "SLACK"
    Discord = "DISCORD"
    MSTeams = "MSTEAMS"
    PagerDuty = "PAGERDUTY"
    Opsgenie = "OPSGENIE"
    GitHub = "GITHUB"
    GithubEnterprise = "GITHUBENTERPRISE"
    Gitlab = "Gitlab"
    Jira = "JIRA"
    JiraServer = "JIRASERVER"
    AzureDevOps = "AZUREDEVOPS"
    SentryApp = "SENTRYAPP"
    Email = "EMAIL"

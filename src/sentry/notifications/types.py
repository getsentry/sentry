from enum import Enum
from typing import Optional

"""
TODO(postgres): We've encoded these enums as integers to facilitate
communication with the DB. We'd prefer to encode them as strings to facilitate
communication with the API and plan to do so as soon as we use native enums in
Postgres. In the meantime each enum has an adjacent object that maps the
integers to their string values.
"""


def get_notification_setting_type_name(value: int) -> Optional[str]:
    return NOTIFICATION_SETTING_TYPES.get(NotificationSettingTypes(value))


def get_notification_setting_value_name(value: int) -> Optional[str]:
    return NOTIFICATION_SETTING_OPTION_VALUES.get(NotificationSettingOptionValues(value))


def get_notification_scope_name(value: int) -> Optional[str]:
    return NOTIFICATION_SCOPE_TYPE.get(NotificationScopeType(value))


class NotificationSettingTypes(Enum):
    """
    Each of these categories of Notification settings has at least an option for
    "on" or "off". Workflow also includes SUBSCRIBE_ONLY and Deploy also
    includes COMMITTED_ONLY and both of these values are described below.
    """

    # Control all notification types. Currently unused.
    DEFAULT = 0

    # When Sentry sees there is a new code deploy.
    DEPLOY = 10

    # When Sentry sees and issue that triggers an Alert Rule.
    ISSUE_ALERTS = 20

    # Notifications for changes in assignment, resolution, comments, etc.
    WORKFLOW = 30


NOTIFICATION_SETTING_TYPES = {
    NotificationSettingTypes.DEFAULT: "default",
    NotificationSettingTypes.DEPLOY: "deploy",
    NotificationSettingTypes.ISSUE_ALERTS: "alerts",
    NotificationSettingTypes.WORKFLOW: "workflow",
}


class NotificationSettingOptionValues(Enum):
    """
    An empty row in the DB should be represented as
    NotificationSettingOptionValues.DEFAULT.
    """

    # Defer to a setting one level up.
    DEFAULT = 0

    # Mute this kind of notification.
    NEVER = 10

    # Un-mute this kind of notification.
    ALWAYS = 20

    # Workflow only. Only send notifications about Issues that the target has
    # explicitly or implicitly opted-into.
    SUBSCRIBE_ONLY = 30

    # Deploy only. Only send notifications when the set of changes in the deploy
    # included a commit authored by the target.
    COMMITTED_ONLY = 40


NOTIFICATION_SETTING_OPTION_VALUES = {
    NotificationSettingOptionValues.DEFAULT: "default",
    NotificationSettingOptionValues.NEVER: "never",
    NotificationSettingOptionValues.ALWAYS: "always",
    NotificationSettingOptionValues.SUBSCRIBE_ONLY: "subscribe_only",
    NotificationSettingOptionValues.COMMITTED_ONLY: "committed_only",
}


class NotificationScopeType(Enum):
    USER = 0
    ORGANIZATION = 10
    PROJECT = 20
    TEAM = 30


NOTIFICATION_SCOPE_TYPE = {
    NotificationScopeType.USER: "user",
    NotificationScopeType.ORGANIZATION: "organization",
    NotificationScopeType.PROJECT: "project",
    NotificationScopeType.TEAM: "team",
}


class FineTuningAPIKey(Enum):
    ALERTS = "alerts"
    DEPLOY = "deploy"
    EMAIL = "email"
    REPORTS = "reports"
    WORKFLOW = "workflow"


class UserOptionsSettingsKey(Enum):
    DEPLOY = "deployNotifications"
    SELF_ACTIVITY = "personalActivityNotifications"
    SELF_ASSIGN = "selfAssignOnResolve"
    SUBSCRIBE_BY_DEFAULT = "subscribeByDefault"
    WORKFLOW = "workflowNotifications"


VALID_VALUES_FOR_KEY = {
    NotificationSettingTypes.DEPLOY: {
        NotificationSettingOptionValues.ALWAYS,
        NotificationSettingOptionValues.COMMITTED_ONLY,
        NotificationSettingOptionValues.NEVER,
    },
    NotificationSettingTypes.ISSUE_ALERTS: {
        NotificationSettingOptionValues.ALWAYS,
        NotificationSettingOptionValues.NEVER,
    },
    NotificationSettingTypes.WORKFLOW: {
        NotificationSettingOptionValues.ALWAYS,
        NotificationSettingOptionValues.SUBSCRIBE_ONLY,
        NotificationSettingOptionValues.NEVER,
    },
}


class GroupSubscriptionReason:
    implicit = -1  # not for use as a persisted field value
    committed = -2  # not for use as a persisted field value
    processing_issue = -3  # not for use as a persisted field value

    unknown = 0
    comment = 1
    assigned = 2
    bookmark = 3
    status_change = 4
    deploy_setting = 5
    mentioned = 6
    team_mentioned = 7

    descriptions = {
        implicit: "have opted to receive updates for all issues within "
        "projects that you are a member of",
        committed: "were involved in a commit that is part of this release",
        processing_issue: "are subscribed to alerts for this project",
        comment: "have commented on this issue",
        assigned: "have been assigned to this issue",
        bookmark: "have bookmarked this issue",
        status_change: "have changed the resolution status of this issue",
        deploy_setting: "opted to receive all deploy notifications for this organization",
        mentioned: "have been mentioned in this issue",
        team_mentioned: "are a member of a team mentioned in this issue",
    }


SUBSCRIPTION_REASON_MAP = {
    GroupSubscriptionReason.comment: "commented",
    GroupSubscriptionReason.assigned: "assigned",
    GroupSubscriptionReason.bookmark: "bookmarked",
    GroupSubscriptionReason.status_change: "changed_status",
    GroupSubscriptionReason.mentioned: "mentioned",
}


class ActionTargetType(Enum):
    ISSUE_OWNERS = "IssueOwners"
    TEAM = "Team"
    MEMBER = "Member"


ACTION_CHOICES = [
    (ActionTargetType.ISSUE_OWNERS.value, "Issue Owners"),
    (ActionTargetType.TEAM.value, "Team"),
    (ActionTargetType.MEMBER.value, "Member"),
]


class AssigneeTargetType(Enum):
    UNASSIGNED = "Unassigned"
    TEAM = "Team"
    MEMBER = "Member"


ASSIGNEE_CHOICES = [
    (AssigneeTargetType.UNASSIGNED.value, "Unassigned"),
    (AssigneeTargetType.TEAM.value, "Team"),
    (AssigneeTargetType.MEMBER.value, "Member"),
]

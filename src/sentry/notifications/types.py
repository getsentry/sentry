from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING

from sentry.services.hybrid_cloud import ValueEqualityEnum

if TYPE_CHECKING:
    from sentry.models.organization import Organization


class NotificationSettingEnum(ValueEqualityEnum):
    DEPLOY = "deploy"
    ISSUE_ALERTS = "alerts"
    WORKFLOW = "workflow"
    APPROVAL = "approval"
    QUOTA = "quota"
    QUOTA_ERRORS = "quotaErrors"
    QUOTA_TRANSACTIONS = "quotaTransactions"
    QUOTA_ATTACHMENTS = "quotaAttachments"
    QUOTA_REPLAYS = "quotaReplays"
    QUOTA_WARNINGS = "quotaWarnings"
    QUOTA_SPEND_ALLOCATIONS = "quotaSpendAllocations"
    SPIKE_PROTECTION = "spikeProtection"
    MISSING_MEMBERS = "missingMembers"
    REPORTS = "reports"


class NotificationSettingsOptionEnum(ValueEqualityEnum):
    DEFAULT = "default"
    NEVER = "never"
    ALWAYS = "always"
    SUBSCRIBE_ONLY = "subscribe_only"
    COMMITTED_ONLY = "committed_only"


# default is not a choice anymore, we just delete the row if we want to the default
NOTIFICATION_SETTING_CHOICES = [
    NotificationSettingsOptionEnum.ALWAYS.value,
    NotificationSettingsOptionEnum.NEVER.value,
    NotificationSettingsOptionEnum.SUBSCRIBE_ONLY.value,
    NotificationSettingsOptionEnum.COMMITTED_ONLY.value,
]


class NotificationScopeEnum(ValueEqualityEnum):
    USER = "user"
    ORGANIZATION = "organization"
    PROJECT = "project"
    TEAM = "team"


class FineTuningAPIKey(Enum):
    ALERTS = "alerts"
    APPROVAL = "approval"
    DEPLOY = "deploy"
    EMAIL = "email"
    QUOTA = "quota"
    REPORTS = "reports"
    WORKFLOW = "workflow"
    SPIKE_PROTECTION = "spikeProtection"


class UserOptionsSettingsKey(Enum):
    SELF_ACTIVITY = "personalActivityNotifications"
    SELF_ASSIGN = "selfAssignOnResolve"


VALID_VALUES_FOR_KEY = {
    NotificationSettingEnum.APPROVAL: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.DEPLOY: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.COMMITTED_ONLY,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.ISSUE_ALERTS: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.QUOTA: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.QUOTA_ERRORS: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.QUOTA_TRANSACTIONS: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.QUOTA_ATTACHMENTS: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.QUOTA_REPLAYS: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.QUOTA_WARNINGS: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.QUOTA_SPEND_ALLOCATIONS: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.WORKFLOW: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.SPIKE_PROTECTION: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.REPORTS: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
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


class FallthroughChoiceType(Enum):
    ALL_MEMBERS = "AllMembers"
    ACTIVE_MEMBERS = "ActiveMembers"
    NO_ONE = "NoOne"


FALLTHROUGH_CHOICES = [
    (FallthroughChoiceType.ACTIVE_MEMBERS.value, "Recently Active Members"),
    (FallthroughChoiceType.ALL_MEMBERS.value, "All Project Members"),
    (FallthroughChoiceType.NO_ONE.value, "No One"),
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


@dataclass
class GroupSubscriptionStatus:
    is_disabled: bool
    is_active: bool
    has_only_inactive_subscriptions: bool


@dataclass
class UnsubscribeContext:
    organization: Organization
    resource_id: int
    key: str
    referrer: str | None = None

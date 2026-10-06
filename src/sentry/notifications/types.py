from __future__ import annotations

from dataclasses import dataclass
from enum import Enum, StrEnum
from typing import TYPE_CHECKING, Any, NamedTuple, TypedDict

from sentry.hybridcloud.rpc import ValueEqualityEnum

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.models.rule import Rule


class NotificationRuleData(TypedDict):
    """Configuration for legacy action instantiation, not notification identity."""

    actions: list[dict[str, Any]]


@dataclass(eq=False, frozen=True)
class NotificationRule:
    """Rule-like notification context for the legacy action registry.

    ``workflow_id`` and ``legacy_rule_id`` are the canonical notification identities.
    Notification code must not recover identity from ``data["actions"]``. Action data
    exists only to configure the legacy action registry. Parsing identity from action
    data is restricted to explicit compatibility boundaries for deprecated Rule rows
    and payloads serialized before these top-level fields existed.
    """

    action_id: int | None
    label: str
    data: NotificationRuleData
    project: Project
    environment_id: int | None
    workflow_id: int | None
    legacy_rule_id: int | None

    @classmethod
    def from_deprecated_legacy_rule(
        cls,
        rule: Rule,
        *,
        project: Project | None = None,
        workflow_id: int | None = None,
    ) -> NotificationRule:
        actions = rule.data.get("actions")
        if (
            not isinstance(actions, list)
            or not actions
            or not all(isinstance(action, dict) for action in actions)
        ):
            # Deprecated rules can reach render-only paths without action data.
            actions = [{}]

        first_action = actions[0]
        embedded_workflow_id = first_action.get("workflow_id")
        embedded_legacy_rule_id = first_action.get("legacy_rule_id")
        if embedded_workflow_id is not None:
            embedded_workflow_id = int(embedded_workflow_id)
        if embedded_legacy_rule_id is not None:
            embedded_legacy_rule_id = int(embedded_legacy_rule_id)
        if embedded_legacy_rule_id == TEST_NOTIFICATION_ID:
            effective_workflow_id = None
            legacy_rule_id = TEST_NOTIFICATION_ID
        elif workflow_id is not None:
            effective_workflow_id = workflow_id
            legacy_rule_id = rule.id
        elif embedded_legacy_rule_id is not None:
            effective_workflow_id = embedded_workflow_id
            legacy_rule_id = embedded_legacy_rule_id
        elif embedded_workflow_id is not None:
            effective_workflow_id = embedded_workflow_id
            legacy_rule_id = None
        else:
            effective_workflow_id = None
            legacy_rule_id = rule.id

        return cls(
            action_id=None,
            label=rule.label,
            data={"actions": [dict(action) for action in actions]},
            project=project or rule.project,
            environment_id=rule.environment_id,
            workflow_id=effective_workflow_id,
            legacy_rule_id=legacy_rule_id,
        )

    def __post_init__(self) -> None:
        if not self.data["actions"]:
            raise ValueError("NotificationRule requires at least one action")

        if self.legacy_rule_id == TEST_NOTIFICATION_ID:
            if self.workflow_id is not None:
                raise ValueError("Test notification cannot have a workflow ID")
        elif self.workflow_id == TEST_NOTIFICATION_ID:
            raise ValueError("Workflow ID cannot be the test notification ID")
        elif self.workflow_id is None and self.legacy_rule_id is None:
            raise ValueError("NotificationRule requires a workflow or legacy rule ID")

    @property
    def identifier(self) -> str:
        if self.is_test_notification and self.action_id is not None:
            return f"test:{self.action_id}"
        if self.workflow_id is not None:
            return f"workflow:{self.workflow_id}"
        assert self.legacy_rule_id is not None
        return f"legacy:{self.legacy_rule_id}"

    @property
    def broken_rule_id(self) -> int:
        """Preserve callers that historically treated several ID domains as Rule.id."""
        if self.action_id is not None:
            return self.action_id
        if self.legacy_rule_id is not None:
            return self.legacy_rule_id
        assert self.workflow_id is not None
        return self.workflow_id

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, NotificationRule):
            return NotImplemented
        return self.identifier == other.identifier

    def __hash__(self) -> int:
        return hash(self.identifier)

    @property
    def is_test_notification(self) -> bool:
        return self.legacy_rule_id == TEST_NOTIFICATION_ID

    @property
    def is_workflow_only(self) -> bool:
        return self.workflow_id is not None and self.legacy_rule_id is None

    @property
    def is_workflow_with_legacy_rule(self) -> bool:
        return self.workflow_id is not None and self.legacy_rule_id is not None

    @property
    def is_legacy_rule_only(self) -> bool:
        return self.workflow_id is None and self.legacy_rule_id not in (
            None,
            TEST_NOTIFICATION_ID,
        )

    @property
    def project_id(self) -> int:
        return self.project.id


class RuleFuture(NamedTuple):
    rule: NotificationRule
    kwargs: dict[str, Any]


class NotificationSettingEnum(ValueEqualityEnum):
    DEPLOY = "deploy"
    ISSUE_ALERTS = "alerts"
    WORKFLOW = "workflow"
    APPROVAL = "approval"
    # Notifications for when 100% reserved quota is reached
    QUOTA = "quota"
    # Notifications for when 80% reserved quota is reached
    QUOTA_WARNINGS = "quotaWarnings"
    # Notifications for when a specific threshold is reached
    # If set, this overrides any notification preferences for QUOTA and QUOTA_WARNINGS.
    QUOTA_THRESHOLDS = "quotaThresholds"
    QUOTA_ERRORS = "quotaErrors"
    QUOTA_TRANSACTIONS = "quotaTransactions"
    QUOTA_ATTACHMENTS = "quotaAttachments"
    QUOTA_REPLAYS = "quotaReplays"
    QUOTA_MONITOR_SEATS = "quotaMonitorSeats"
    QUTOA_UPTIME = "quotaUptime"
    QUOTA_SPANS = "quotaSpans"
    QUOTA_PROFILE_DURATION = "quotaProfileDuration"
    QUOTA_PROFILE_DURATION_UI = "quotaProfileDurationUI"
    QUOTA_SEER_BUDGET = "quotaSeerBudget"
    QUOTA_SPEND_ALLOCATIONS = "quotaSpendAllocations"
    QUOTA_LOG_BYTES = "quotaLogBytes"
    QUOTA_TRACE_METRIC_BYTES = "quotaTraceMetricBytes"
    QUOTA_SEER_USERS = "quotaSeerUsers"
    QUOTA_SIZE_ANALYSIS = "quotaSizeAnalyses"
    SPIKE_PROTECTION = "spikeProtection"
    MISSING_MEMBERS = "missingMembers"
    REPORTS = "reports"
    BROKEN_MONITORS = "brokenMonitors"


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


class FineTuningAPIKey(StrEnum):
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
    NotificationSettingEnum.QUOTA_MONITOR_SEATS: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.QUTOA_UPTIME: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.QUOTA_SPANS: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.QUOTA_PROFILE_DURATION: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.QUOTA_PROFILE_DURATION_UI: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.QUOTA_SEER_BUDGET: {
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
    NotificationSettingEnum.QUOTA_LOG_BYTES: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.QUOTA_TRACE_METRIC_BYTES: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.QUOTA_SEER_USERS: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.QUOTA_SIZE_ANALYSIS: {
        NotificationSettingsOptionEnum.ALWAYS,
        NotificationSettingsOptionEnum.NEVER,
    },
    NotificationSettingEnum.QUOTA_THRESHOLDS: {
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
    NotificationSettingEnum.BROKEN_MONITORS: {
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


class FallthroughChoiceType(StrEnum):
    ALL_MEMBERS = "AllMembers"
    ACTIVE_MEMBERS = "ActiveMembers"
    NO_ONE = "NoOne"


FALLTHROUGH_CHOICES = [
    (FallthroughChoiceType.ACTIVE_MEMBERS.value, "Recently Active Members"),
    (FallthroughChoiceType.ALL_MEMBERS.value, "All Project Members"),
    (FallthroughChoiceType.NO_ONE.value, "No One"),
]


class AssigneeTargetType(StrEnum):
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


"""
This is a special identifier that is used to indicate that the notification is a test notification.
It is used to set the ID of models that are required in order to send a test notification.

Note: This should eventually be deleted the test notification logic should instead utilize a notification platform
which should provide an API for sending test notifications without "hacking" the notification system.
"""
TEST_NOTIFICATION_ID = -1

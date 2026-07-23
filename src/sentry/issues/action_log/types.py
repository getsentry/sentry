"""
Types for the group action log. No Django dependencies — safe to import anywhere.
"""

from __future__ import annotations

import abc
import dataclasses
from enum import IntEnum, StrEnum
from typing import Any, ClassVar, Literal, NotRequired, Optional, TypedDict

from pydantic import BaseModel


class GroupActorType(IntEnum):
    SYSTEM = 0
    USER = 1
    # An integration (Sentry App) acting via its token; actor_id is the SentryApp id.
    # internal vs public is derived from SentryApp.status at read time, not a separate type.
    SENTRY_APP = 2
    # An organization-scoped token (OrgAuthToken, or legacy ApiKey); actor_id is the org id.
    ORG = 3


@dataclasses.dataclass(frozen=True)
class GroupActionActor:
    """
    Who initiated an action. Use the constructors: user(id) for a human, sentry_app(id) for
    an integration token, org(id) for an org-scoped token, or SYSTEM_ACTOR for Sentry itself.
    """

    actor_type: GroupActorType
    actor_id: int

    @classmethod
    def user(cls, user_id: int) -> GroupActionActor:
        return cls(actor_type=GroupActorType.USER, actor_id=user_id)

    @classmethod
    def sentry_app(cls, sentry_app_id: int) -> GroupActionActor:
        return cls(actor_type=GroupActorType.SENTRY_APP, actor_id=sentry_app_id)

    @classmethod
    def org(cls, organization_id: int) -> GroupActionActor:
        return cls(actor_type=GroupActorType.ORG, actor_id=organization_id)


# Default GroupActionActor for Sentry-initiated actions.
SYSTEM_ACTOR = GroupActionActor(actor_type=GroupActorType.SYSTEM, actor_id=0)


class GroupActionType(IntEnum):
    """
    Action kinds stored in GroupActionLogEntry.type.

    To add a new kind: add a value here, then add a corresponding
    GroupAction subclass below. Values need not be contiguous.
    """

    VIEW = 0
    MERGE_INTO_OTHER = 7
    DELETE = 9
    BOOKMARK = 10
    COMMENT_EDIT = 12
    COMMENT_DELETE = 13
    SUBSCRIBE = 14
    UNSUBSCRIBE = 15
    TRIGGER_AUTOFIX = 17
    CREATE_EXTERNAL_ISSUE = 18
    LINK_EXTERNAL_ISSUE = 19
    UNLINK_EXTERNAL_ISSUE = 20
    CREATE_PLATFORM_EXTERNAL_ISSUE = 21
    LINK_PLATFORM_EXTERNAL_ISSUE = 22
    UNLINK_PLATFORM_EXTERNAL_ISSUE = 23
    AUTOFIX_PR_CREATED = 24
    ROOT_CAUSE_IDENTIFIED = 26
    AUTOFIX_CODING_COMPLETE = 27
    PULL_REQUEST_CLOSED = 29
    RECONCILE_STATUS = 30
    PULL_REQUEST_REOPENED = 31
    PULL_REQUEST_MERGED = 32
    PULL_REQUEST_UNLINKED = 33

    # Certain GroupActions are mirrors of Activity records.
    # (See ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE for the mapping.)
    # By convention, those GroupActionTypes are set to 1000 + the ActivityType value.

    RESOLVE = 1001
    UNRESOLVE = 1002
    ARCHIVE = 1003
    SET_PUBLIC = 1004
    SET_PRIVATE = 1005
    SET_REGRESSED = 1006
    CREATE_ISSUE = 1007
    COMMENT = 1008
    # Note that ActivityTypes 9 & 10 are not Group-level, so they are not carried here.
    ASSIGN = 1011
    UNASSIGN = 1012
    SET_RESOLVED_IN_RELEASE = 1013
    MERGE_FROM_OTHER = 1014
    SET_RESOLVED_BY_AGE = 1015
    SET_RESOLVED_IN_COMMIT = 1016
    DEPLOY = 1017
    NEW_PROCESSING_ISSUES = 1018
    UNMERGE_SOURCE = 1019
    UNMERGE_DESTINATION = 1020
    RESOLVED_IN_PULL_REQUEST = 1021
    REPROCESS = 1022
    MARK_REVIEWED = 1023
    AUTO_SET_ONGOING = 1024
    SET_ESCALATING = 1025
    SET_PRIORITY = 1026
    DELETED_ATTACHMENT = 1027
    REFERENCED_IN_COMMIT = 1028
    SEER_RCA_STARTED = 1029
    SEER_RCA_COMPLETED = 1030
    SEER_SOLUTION_STARTED = 1031
    SEER_SOLUTION_COMPLETED = 1032
    SEER_CODING_STARTED = 1033
    SEER_CODING_COMPLETED = 1034
    SEER_PR_CREATED = 1035
    SEER_ITERATION_STARTED = 1036
    SEER_ITERATION_COMPLETED = 1037


class ActionSource(StrEnum):
    WEB = "web"
    SENTRY_CLI = "sentry-cli"
    API = "api"
    SYSTEM = "system"
    MCP = "mcp"
    SEER_EXPLORER = "seer:explorer"
    SEER_SLACK = "seer:slack"
    SLACK = "slack"
    SLACK_STAGING = "slack_staging"
    DISCORD = "discord"
    MSTEAMS = "msteams"
    GITHUB = "github"
    GITHUB_ENTERPRISE = "github_enterprise"
    GITLAB = "gitlab"
    JIRA = "jira"
    JIRA_SERVER = "jira_server"
    AZURE_DEVOPS = "vsts"
    BITBUCKET = "bitbucket"
    BITBUCKET_SERVER = "bitbucket_server"
    PAGERDUTY = "pagerduty"
    OPSGENIE = "opsgenie"
    PERFORCE = "perforce"
    UNKNOWN = (
        "unknown"  # fallback when ActionContext is missing; indicates a gap in instrumentation
    )


COMMIT_ACTION_TYPES = {
    GroupActionType.SET_RESOLVED_IN_COMMIT.value,
    GroupActionType.REFERENCED_IN_COMMIT.value,
}

ACTION_TYPES_WITH_COMMIT_DATA = {
    *COMMIT_ACTION_TYPES,
    GroupActionType.SET_RESOLVED_IN_RELEASE.value,
}

PULL_REQUEST_ACTION_TYPES = {
    GroupActionType.RESOLVED_IN_PULL_REQUEST.value,
    GroupActionType.PULL_REQUEST_CLOSED.value,
    GroupActionType.PULL_REQUEST_REOPENED.value,
    GroupActionType.PULL_REQUEST_MERGED.value,
    GroupActionType.PULL_REQUEST_UNLINKED.value,
}


class GroupAction(BaseModel, abc.ABC):
    """Typed payload for a group action log entry. Frozen after construction."""

    _registry: ClassVar[dict[GroupActionType, type[GroupAction]]] = {}
    _user_visible_types: ClassVar[set[GroupActionType]] = set()

    user_visible: ClassVar[bool] = False

    class Config:
        frozen = True

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        if not getattr(cls.get_type, "__isabstractmethod__", False):
            action_type = cls.get_type()
            existing = cls._registry.get(action_type)
            if existing is not None:
                raise TypeError(
                    f"Duplicate GroupAction registration for {action_type!r}: "
                    f"{cls.__name__} conflicts with {existing.__name__}"
                )
            cls._registry[action_type] = cls
            if cls.user_visible:
                cls._user_visible_types.add(action_type)

    @classmethod
    @abc.abstractmethod
    def get_type(cls) -> GroupActionType: ...

    @classmethod
    def by_type(cls, action_type: GroupActionType) -> type[GroupAction] | None:
        return cls._registry.get(action_type)

    @classmethod
    def get_user_visible_types(cls) -> frozenset[GroupActionType]:
        return frozenset(cls._user_visible_types)


class ViewAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.VIEW


class ResolveAction(GroupAction):
    user_visible = True

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.RESOLVE


class UnresolveAction(GroupAction):
    user_visible = True
    event_id: Optional[str] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.UNRESOLVE


class ArchiveAction(GroupAction):
    user_visible = True
    ignore_count: Optional[int] = None
    ignore_duration: Optional[int] = None
    ignore_until: Optional[str] = None
    ignore_user_count: Optional[int] = None
    ignore_user_window: Optional[int] = None
    ignore_window: Optional[int] = None
    ignore_until_escalating: Optional[bool] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ARCHIVE


class AssignAction(GroupAction):
    user_visible = True
    assignee: Optional[str] = None
    assignee_email: Optional[str] = None
    assignee_name: Optional[str] = None
    assignee_type: Optional[str] = None
    integration: Optional[str] = None
    rule: Optional[str] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ASSIGN


class UnassignAction(GroupAction):
    user_visible = True

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.UNASSIGN


class SetPriorityAction(GroupAction):
    user_visible = True
    priority: str
    reason: Optional[str] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SET_PRIORITY


class MergeIntoOtherAction(GroupAction):
    user_visible = True
    counterpart_group_id: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.MERGE_INTO_OTHER


class MergeFromOtherAction(GroupAction):
    user_visible = True
    counterpart_group_ids: list[int]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.MERGE_FROM_OTHER


class DeleteAction(GroupAction):
    user_visible = True

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.DELETE


class BookmarkAction(GroupAction):
    user_visible = True

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.BOOKMARK


class SentryActorRef(BaseModel):
    id: int
    actor_type: Literal["User", "Team"]
    slug: str | None


class CommentAction(GroupAction):
    user_visible = True
    comment_id: int
    text: Optional[str] = None
    mentions: Optional[list[SentryActorRef]] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.COMMENT


class CommentEditAction(GroupAction):
    user_visible = True
    comment_id: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.COMMENT_EDIT


class CommentDeleteAction(GroupAction):
    user_visible = True
    comment_id: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.COMMENT_DELETE


class SubscribeAction(GroupAction):
    user_visible = True

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SUBSCRIBE


class UnsubscribeAction(GroupAction):
    user_visible = True

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.UNSUBSCRIBE


class MarkReviewedAction(GroupAction):
    user_visible = True

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.MARK_REVIEWED


class TriggerAutofixAction(GroupAction):
    user_visible = True
    referrer: Optional[str] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.TRIGGER_AUTOFIX


class CreateExternalIssueAction(GroupAction):
    user_visible = True
    provider: str
    external_issue_key: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.CREATE_EXTERNAL_ISSUE


class LinkExternalIssueAction(GroupAction):
    user_visible = True
    provider: str
    external_issue_key: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.LINK_EXTERNAL_ISSUE


class UnlinkExternalIssueAction(GroupAction):
    user_visible = True
    provider: str
    external_issue_key: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.UNLINK_EXTERNAL_ISSUE


class CreatePlatformExternalIssueAction(GroupAction):
    user_visible = True
    service_type: str
    display_name: str
    web_url: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.CREATE_PLATFORM_EXTERNAL_ISSUE


class LinkPlatformExternalIssueAction(GroupAction):
    user_visible = True
    service_type: str
    display_name: str
    web_url: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.LINK_PLATFORM_EXTERNAL_ISSUE


class UnlinkPlatformExternalIssueAction(GroupAction):
    user_visible = True
    service_type: str
    display_name: str
    web_url: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.UNLINK_PLATFORM_EXTERNAL_ISSUE


class AutofixPrCreatedAction(GroupAction):
    user_visible = True
    run_id: str | None = None
    pull_requests: list[dict[str, object]]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.AUTOFIX_PR_CREATED


class ResolvedInPullRequestAction(GroupAction):
    user_visible = True
    pull_request: Optional[int] = None  # PullRequest model ID

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.RESOLVED_IN_PULL_REQUEST


class RootCauseIdentifiedAction(GroupAction):
    """Seer (or a human) identified the root cause of an issue."""

    user_visible = True

    run_id: str | None = None
    summary: str | None = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ROOT_CAUSE_IDENTIFIED


class AutofixCodingCompleteAction(GroupAction):
    """Seer finished writing a fix (code ready, PR not yet created)."""

    user_visible = True

    run_id: str | None = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.AUTOFIX_CODING_COMPLETE


class SetRegressedAction(GroupAction):
    user_visible = True
    event_id: Optional[str] = None
    version: Optional[str] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SET_REGRESSED


class PullRequestClosedAction(GroupAction):
    user_visible = True
    pull_request: Optional[int | str] = None  # PullRequest model ID
    # Whether the issue has other linked PRs still open when this one closed
    has_other_open_prs: Optional[bool] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.PULL_REQUEST_CLOSED


class PullRequestReopenedAction(GroupAction):
    user_visible = True
    pull_request: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.PULL_REQUEST_REOPENED


class PullRequestMergedAction(GroupAction):
    user_visible = True
    pull_request: int
    has_other_open_prs: Optional[bool] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.PULL_REQUEST_MERGED


class PullRequestUnlinkedAction(GroupAction):
    user_visible = True
    pull_request: int
    has_other_open_prs: Optional[bool] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.PULL_REQUEST_UNLINKED


class GroupActionLogPayload(TypedDict):
    """Outbox payload for GROUP_ACTION_LOG_EVENT. Shared by producer and receiver."""

    group_id: int
    project_id: int
    type: int
    actor_type: int
    actor_id: int
    source: str
    data: dict[str, Any]
    force_async_derived: bool
    idempotency_key: NotRequired[str]


class SetPublicAction(GroupAction):
    user_visible = True
    # No activity data.

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SET_PUBLIC


class SetPrivateAction(GroupAction):
    user_visible = True
    # No activity data.

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SET_PRIVATE


class CreateIssueAction(GroupAction):
    user_visible = True
    title: str
    provider: str
    location: str
    label: str
    new: Optional[bool] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.CREATE_ISSUE


class SetResolvedInReleaseAction(GroupAction):
    user_visible = True
    version: Optional[str] = None
    current_release_version: Optional[str] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SET_RESOLVED_IN_RELEASE


class SetResolvedByAgeAction(GroupAction):
    user_visible = True
    auto_resolve_age_threshold: Optional[int] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SET_RESOLVED_BY_AGE


class SetResolvedInCommitAction(GroupAction):
    user_visible = True
    commit: Optional[int] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SET_RESOLVED_IN_COMMIT


class DeployAction(GroupAction):
    user_visible = True
    deploy_id: int
    version: str
    environment: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.DEPLOY


class NewProcessingIssuesAction(GroupAction):
    user_visible = True
    reprocessing_active: bool
    # TODO Break out as separate model?
    issues: list[dict[str, str | dict[str, str]]]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.NEW_PROCESSING_ISSUES


class UnmergeSourceAction(GroupAction):
    user_visible = True
    destination_id: int
    fingerprints: list[str]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.UNMERGE_SOURCE


class UnmergeDestinationAction(GroupAction):
    user_visible = True
    source_id: int
    fingerprints: list[str]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.UNMERGE_DESTINATION


class ReprocessAction(GroupAction):
    user_visible = True
    event_count: Optional[int] = None
    old_group_id: Optional[int] = None
    new_group_id: Optional[int] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.REPROCESS


class AutoSetOngoingAction(GroupAction):
    user_visible = True
    after_days: Optional[int] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.AUTO_SET_ONGOING


class SetEscalatingAction(GroupAction):
    user_visible = True
    event_id: Optional[str] = None
    forecast: Optional[int] = None
    expired_snooze: Optional[dict[str, int | str | None]] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SET_ESCALATING


class DeletedAttachmentAction(GroupAction):
    user_visible = True
    # No activity data.

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.DELETED_ATTACHMENT


class ReferencedInCommitAction(GroupAction):
    user_visible = True
    commit: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.REFERENCED_IN_COMMIT


class SeerRCAStartedAction(GroupAction):
    user_visible = True
    run_id: Optional[int] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SEER_RCA_STARTED


class SeerRCACompletedAction(GroupAction):
    user_visible = True
    run_id: Optional[int | str] = None
    summary: Optional[str] = None
    # TODO Break out as separate model?
    root_cause: Optional[dict[str, str | list[str]]] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SEER_RCA_COMPLETED


class SeerSolutionStartedAction(GroupAction):
    user_visible = True
    run_id: Optional[int] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SEER_SOLUTION_STARTED


class SeerSolutionCompletedAction(GroupAction):
    user_visible = True
    run_id: Optional[int] = None
    # TODO Break out as separate model?
    solution: Optional[dict[str, str | list[dict[str, str]]]] = None
    summary: Optional[str] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SEER_SOLUTION_COMPLETED


class SeerCodingStartedAction(GroupAction):
    user_visible = True
    run_id: Optional[int] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SEER_CODING_STARTED


class SeerCodingCompletedAction(GroupAction):
    user_visible = True
    run_id: Optional[int] = None
    changes: Optional[list[dict[str, str | int]]] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SEER_CODING_COMPLETED


class SeerPRCreatedAction(GroupAction):
    user_visible = True
    run_id: Optional[int] = None
    # TODO Break out as separate model?
    pull_requests: Optional[list[dict[str, str | dict[str, str | int]]]] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SEER_PR_CREATED


class SeerIterationStartedAction(GroupAction):
    user_visible = True

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SEER_ITERATION_STARTED


class SeerIterationCompletedAction(GroupAction):
    user_visible = True

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SEER_ITERATION_COMPLETED


class ReconcileStatusAction(GroupAction):
    """Force-set the derived status to a known-correct value.

    Used when out-of-log information (e.g. the Group model) disagrees with
    the derived status computed from the action log.
    """

    # Must stay in sync with IssueStatus in sentry.issues.derived.features.
    status: Literal["open", "closed"]
    reason: Optional[str] = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.RECONCILE_STATUS

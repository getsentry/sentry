"""
Types for the group action log. No Django dependencies — safe to import anywhere.
"""

from __future__ import annotations

import abc
import dataclasses
from enum import IntEnum
from typing import Any, Optional

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
    RESOLVE = 1
    UNRESOLVE = 2
    ARCHIVE = 3
    ASSIGN = 4
    UNASSIGN = 5
    SET_PRIORITY = 6
    MERGE_INTO_OTHER = 7
    MERGE_FROM_OTHER = 8
    DELETE = 9
    BOOKMARK = 10
    COMMENT = 11
    COMMENT_EDIT = 12
    COMMENT_DELETE = 13
    SUBSCRIBE = 14
    UNSUBSCRIBE = 15
    MARK_REVIEWED = 16
    TRIGGER_AUTOFIX = 17
    CREATE_EXTERNAL_ISSUE = 18
    LINK_EXTERNAL_ISSUE = 19
    UNLINK_EXTERNAL_ISSUE = 20
    CREATE_PLATFORM_EXTERNAL_ISSUE = 21
    LINK_PLATFORM_EXTERNAL_ISSUE = 22
    UNLINK_PLATFORM_EXTERNAL_ISSUE = 23

    # ACTIVITY_SET_RESOLVED = 1001 Duplicative with 1
    # ACTIVITY_SET_UNRESOLVED = 1002 Duplicative with 2
    ACTIVITY_SET_IGNORED = 1003
    ACTIVITY_SET_PUBLIC = 1004
    ACTIVITY_SET_PRIVATE = 1005
    ACTIVITY_SET_REGRESSION = 1006
    ACTIVITY_CREATE_ISSUE = 1007
    ACTIVITY_NOTE = 1008
    # ACTIVITY_FIRST_SEEN = 1009 # Not a real activity (weird story)
    ACTIVITY_RELEASE = 1010
    # ACTIVITY_ASSIGNED = 1011 Duplicative with 4
    # ACTIVITY_UNASSIGNED = 1012 Duplicative with 5
    ACTIVITY_SET_RESOLVED_IN_RELEASE = 1013
    # ACTIVITY_MERGE = 1014  # Duplicative with 8
    ACTIVITY_SET_RESOLVED_BY_AGE = 1015
    ACTIVITY_SET_RESOLVED_IN_COMMIT = 1016
    ACTIVITY_DEPLOY = 1017
    ACTIVITY_NEW_PROCESSING_ISSUES = 1018
    ACTIVITY_UNMERGE_SOURCE = 1019
    ACTIVITY_UNMERGE_DESTINATION = 1020
    ACTIVITY_SET_RESOLVED_IN_PULL_REQUEST = 1021
    ACTIVITY_REPROCESS = 1022
    # ACTIVITY_MARK_REVIEWED = 1023 Duplicative with 16
    ACTIVITY_AUTO_SET_ONGOING = 1024
    ACTIVITY_SET_ESCALATING = 1025
    # ACTIVITY_SET_PRIORITY = 1026 Duplicative with 6
    ACTIVITY_DELETED_ATTACHMENT = 1027
    ACTIVITY_REFERENCED_IN_COMMIT = 1028
    ACTIVITY_SEER_RCA_STARTED = 1029
    ACTIVITY_SEER_RCA_COMPLETED = 1030
    ACTIVITY_SEER_SOLUTION_STARTED = 1031
    ACTIVITY_SEER_SOLUTION_COMPLETED = 1032
    ACTIVITY_SEER_CODING_STARTED = 1033
    ACTIVITY_SEER_CODING_COMPLETED = 1034
    ACTIVITY_SEER_PR_CREATED = 1035
    ACTIVITY_SEER_ITERATION_STARTED = 1036
    ACTIVITY_SEER_ITERATION_COMPLETED = 1037


class GroupAction(BaseModel, abc.ABC):
    """
    Typed payload for a GroupActionLogEntry. Subclasses define the schema
    for a specific action kind's ``data`` column. Frozen after construction.
    """

    class Config:
        frozen = True

    @classmethod
    @abc.abstractmethod
    def get_type(cls) -> GroupActionType: ...


class ViewAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.VIEW


class ResolveAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.RESOLVE


class UnresolveAction(GroupAction):
    event_id: Optional[str]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.UNRESOLVE


class ArchiveAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ARCHIVE


class AssignAction(GroupAction):
    assignee: Optional[str]
    assigneeEmail: Optional[str]
    assigneeName: Optional[str]
    assigneeType: Optional[str]
    integration: Optional[str]
    rule: Optional[str]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ASSIGN


class UnassignAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.UNASSIGN


class SetPriorityAction(GroupAction):
    priority: str
    reason: Optional[str]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SET_PRIORITY


class MergeIntoOtherAction(GroupAction):
    counterpart_group_id: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.MERGE_INTO_OTHER


class MergeFromOtherAction(GroupAction):
    counterpart_group_ids: list[int]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.MERGE_FROM_OTHER


class DeleteAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.DELETE


class BookmarkAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.BOOKMARK


class CommentAction(GroupAction):
    comment_id: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.COMMENT


class CommentEditAction(GroupAction):
    comment_id: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.COMMENT_EDIT


class CommentDeleteAction(GroupAction):
    comment_id: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.COMMENT_DELETE


class SubscribeAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SUBSCRIBE


class UnsubscribeAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.UNSUBSCRIBE


class MarkReviewedAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.MARK_REVIEWED


class TriggerAutofixAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.TRIGGER_AUTOFIX


class CreateExternalIssueAction(GroupAction):
    provider: str
    external_issue_key: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.CREATE_EXTERNAL_ISSUE


class LinkExternalIssueAction(GroupAction):
    provider: str
    external_issue_key: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.LINK_EXTERNAL_ISSUE


class UnlinkExternalIssueAction(GroupAction):
    provider: str
    external_issue_key: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.UNLINK_EXTERNAL_ISSUE


class CreatePlatformExternalIssueAction(GroupAction):
    service_type: str
    display_name: str
    web_url: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.CREATE_PLATFORM_EXTERNAL_ISSUE


class LinkPlatformExternalIssueAction(GroupAction):
    service_type: str
    display_name: str
    web_url: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.LINK_PLATFORM_EXTERNAL_ISSUE


class UnlinkPlatformExternalIssueAction(GroupAction):
    service_type: str
    display_name: str
    web_url: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.UNLINK_PLATFORM_EXTERNAL_ISSUE


class SetIgnoredActivityAction(GroupAction):
    ignoreCount: Optional[int]
    ignoreDuration: Optional[int]
    ignoreUntil: Optional[str]
    ignoreUserCount: Optional[int]
    ignoreUserWindow: Optional[int]
    ignoreWindow: Optional[int]
    ignoreUntilEscalating: Optional[bool]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SET_IGNORED


class SetPublicActivityAction(GroupAction):
    # No activity data.

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SET_PUBLIC


class SetPrivateActivityAction(GroupAction):
    # No activity data.

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SET_PRIVATE


class SetRegressionActivityAction(GroupAction):
    event_id: str
    version: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SET_REGRESSION


class CreateIssueActivityAction(GroupAction):
    title: str
    provider: str
    location: str
    label: str
    new: Optional[bool]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_CREATE_ISSUE


class NoteActivityAction(GroupAction):
    text: str
    mentions: Optional[list[Any]]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_NOTE


class ReleaseActivityAction(GroupAction):
    version: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_RELEASE


class SetResolvedInReleaseActivityAction(GroupAction):
    version: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SET_RESOLVED_IN_RELEASE


class SetResolvedByAgeActivityAction(GroupAction):
    age: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SET_RESOLVED_BY_AGE


class SetResolvedInCommitActivityAction(GroupAction):
    commit: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SET_RESOLVED_IN_COMMIT


class DeployActivityAction(GroupAction):
    deploy_id: int
    version: str
    environment: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_DEPLOY


class NewProcessingIssuesActivityAction(GroupAction):
    reprocessing_active: bool
    # TODO Break out as separate model?
    issues: list[dict[str, str | dict[str, str]]]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_NEW_PROCESSING_ISSUES


class UnmergeSourceActivityAction(GroupAction):
    destination_id: int
    fingerprints: list[str]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_UNMERGE_SOURCE


class UnmergeDestinationActivityAction(GroupAction):
    source_id: int
    fingerprints: list[str]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_UNMERGE_DESTINATION


class SetResolvedInPullRequestActivityAction(GroupAction):
    pull_request: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SET_RESOLVED_IN_PULL_REQUEST


class ReprocessActivityAction(GroupAction):
    # Yes, the CamelCase is odd here. We're using it to match pre-existing reprocessing
    # activities. Legacy code strikes again.
    eventCount: int
    oldGroupId: int
    newGroupId: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_REPROCESS


class AutoSetOngoingActivityAction(GroupAction):
    after_days: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_AUTO_SET_ONGOING


class SetEscalatingActivityAction(GroupAction):
    event_id: str
    forecast: Optional[int]
    expired_snooze: Optional[dict[str, int | str]]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SET_ESCALATING


class DeletedAttachmentActivityAction(GroupAction):
    # No activity data.

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_DELETED_ATTACHMENT


class ReferencedInCommitActivityAction(GroupAction):
    commit: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_REFERENCED_IN_COMMIT


class SeerRCAStartedActivityAction(GroupAction):
    run_id: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SEER_RCA_STARTED


class SeerRCACompletedActivityAction(GroupAction):
    run_id: int
    summary: Optional[str]
    # TODO Break out as separate model?
    root_cause: Optional[dict[str, str | list[str]]]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SEER_RCA_COMPLETED


class SeerSolutionStartedActivityAction(GroupAction):
    run_id: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SEER_SOLUTION_STARTED


class SeerSolutionCompletedActivityAction(GroupAction):
    run_id: int
    # TODO Break out as separate model?
    solution: Optional[dict[str, str | list[dict[str, str]]]]
    summary: Optional[str]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SEER_SOLUTION_COMPLETED


class SeerCodingStartedActivityAction(GroupAction):
    run_id: int

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SEER_CODING_STARTED


class SeerCodingCompletedActivityAction(GroupAction):
    run_id: int
    changes: Optional[list[dict[str, str | int]]]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SEER_CODING_COMPLETED


class SeerPRCreatedActivityAction(GroupAction):
    run_id: int
    # TODO Break out as separate model?
    pull_requests: list[dict[str, str | dict[str, str | int]]]

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SEER_PR_CREATED


class SeerIterationStartedActivityAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SEER_ITERATION_STARTED


class SeerIterationCompletedActivityAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ACTIVITY_SEER_ITERATION_COMPLETED

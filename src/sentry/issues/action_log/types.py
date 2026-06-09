"""
Types for the group action log. No Django dependencies — safe to import anywhere.
"""

from __future__ import annotations

import abc
import dataclasses
from enum import IntEnum

from pydantic import BaseModel


class GroupActorType(IntEnum):
    SYSTEM = 0
    USER = 1


@dataclasses.dataclass(frozen=True)
class GroupActionActor:
    """
    Use GroupActionActor.user(id) for user-initiated actions,
    or SYSTEM_ACTOR for system-initiated actions.
    """

    actor_type: GroupActorType
    actor_id: int

    @classmethod
    def user(cls, user_id: int) -> GroupActionActor:
        return cls(actor_type=GroupActorType.USER, actor_id=user_id)


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
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.UNRESOLVE


class ArchiveAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ARCHIVE


class AssignAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.ASSIGN


class UnassignAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.UNASSIGN


class SetPriorityAction(GroupAction):
    priority: str

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

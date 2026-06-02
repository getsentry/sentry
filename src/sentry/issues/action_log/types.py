"""
Types for the group action log. No Django dependencies — safe to import anywhere.
"""

from __future__ import annotations

import abc
import dataclasses
from enum import IntEnum
from typing import ClassVar

from pydantic import BaseModel


class GroupActorType(IntEnum):
    SYSTEM = 0
    USER = 1


@dataclasses.dataclass(frozen=True)
class GroupActionActor:
    """
    Use GroupActionActor.user(id) for user-initiated actions,
    or GroupActionActor.SYSTEM for system-initiated actions.
    """

    actor_type: GroupActorType
    actor_id: int

    SYSTEM: ClassVar[GroupActionActor]

    @classmethod
    def user(cls, user_id: int) -> GroupActionActor:
        return cls(actor_type=GroupActorType.USER, actor_id=user_id)


GroupActionActor.SYSTEM = GroupActionActor(actor_type=GroupActorType.SYSTEM, actor_id=0)


class GroupActionType(IntEnum):
    """
    Action kinds stored in GroupActionLogEntry.type.

    To add a new kind: add a value here, then add a corresponding
    GroupAction subclass below. Values need not be contiguous.
    """

    VIEW = 0
    COMMENT = 2
    FETCH = 3
    SET_RESOLVED = 4
    SET_UNRESOLVED = 5
    SET_ASSIGNED = 6
    SET_UNASSIGNED = 7
    AUTOFIX_PR_CREATED = 8
    RESOLVED_IN_PULL_REQUEST = 9


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


class FetchAction(GroupAction):
    """An agent or automated tool fetching issue data."""

    tool: str | None = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.FETCH


class CommentAction(GroupAction):
    message: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.COMMENT


class SetResolvedAction(GroupAction):
    resolution_type: str | None = None

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SET_RESOLVED


class SetUnresolvedAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SET_UNRESOLVED


class SetAssignedAction(GroupAction):
    """Mirrors GroupAssignee: assignee_id + assignee_type ('User' or 'Team')."""

    assignee_id: int
    assignee_type: str  # ActorType value: "User" or "Team"

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SET_ASSIGNED


class SetUnassignedAction(GroupAction):
    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.SET_UNASSIGNED


class AutofixPrCreatedAction(GroupAction):
    pr_id: str
    agent: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.AUTOFIX_PR_CREATED


class ResolvedInPullRequestAction(GroupAction):
    pr_id: str

    @classmethod
    def get_type(cls) -> GroupActionType:
        return GroupActionType.RESOLVED_IN_PULL_REQUEST

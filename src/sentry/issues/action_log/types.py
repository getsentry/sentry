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

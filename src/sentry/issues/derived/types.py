"""
Types for the issue action log. No Django dependencies — safe to import anywhere.
"""

from __future__ import annotations

import abc
import dataclasses
from enum import IntEnum
from typing import ClassVar

from pydantic import BaseModel


class ActorType(IntEnum):
    SYSTEM = 0
    USER = 1


@dataclasses.dataclass(frozen=True)
class ActionActor:
    """
    Use ActionActor.user(id) for user-initiated actions,
    or ActionActor.SYSTEM for system-initiated actions.
    """

    actor_type: ActorType
    actor_id: int

    SYSTEM: ClassVar[ActionActor]

    @classmethod
    def user(cls, user_id: int) -> ActionActor:
        return cls(actor_type=ActorType.USER, actor_id=user_id)


ActionActor.SYSTEM = ActionActor(actor_type=ActorType.SYSTEM, actor_id=0)


class IssueActionType(IntEnum):
    """
    Action kinds stored in IssueActionLogEntry.type.

    To add a new kind: add a value here, then add a corresponding
    IssueAction subclass below. Values need not be contiguous.
    """

    VIEW = 0


class IssueAction(BaseModel, abc.ABC):
    """
    Typed payload for an IssueActionLogEntry. Subclasses define the schema
    for a specific action kind's ``data`` column. Frozen after construction.
    """

    class Config:
        frozen = True

    @classmethod
    @abc.abstractmethod
    def get_type(cls) -> IssueActionType: ...


class ViewAction(IssueAction):
    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.VIEW

"""
Action type enum and Action model hierarchy for IssueActionLog.

This module has no Django model dependencies so it can be imported by both
the IssueActionLog model (for choices) and recording.py (for record()).
"""

from __future__ import annotations

import abc
from enum import Enum

from pydantic import BaseModel


class IssueActionType(Enum):
    """
    The set of action kinds that can be recorded in IssueActionLog.

    Each value is an integer stored in IssueActionLog.type. This enum is
    the source of truth for what kinds of actions exist. Adding a new kind
    starts here, then requires a corresponding Action subclass below.

    Values are not contiguous — gaps are fine, and values must never be
    reused once assigned.
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


class Action(BaseModel, abc.ABC):
    """
    Base class for action payloads recorded to IssueActionLog.

    Subclasses define the typed, validated payload for a specific action kind.
    Each subclass must implement get_type() to map to its IssueActionType.

    Actions are frozen Pydantic models — immutable after construction.
    Their fields are serialized to the IssueActionLog.data JSON column
    via record(). The Action is the sole source of the data schema;
    there is no way to inject unvalidated data into the log.
    """

    class Config:
        frozen = True

    @classmethod
    @abc.abstractmethod
    def get_type(cls) -> IssueActionType: ...


class ViewAction(Action):
    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.VIEW


class FetchAction(Action):
    """An agent or automated tool fetching issue data."""

    tool: str | None = None

    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.FETCH


class CommentAction(Action):
    message: str

    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.COMMENT


class SetResolvedAction(Action):
    resolution_type: str | None = None

    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.SET_RESOLVED


class SetUnresolvedAction(Action):
    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.SET_UNRESOLVED


class SetAssignedAction(Action):
    """Mirrors GroupAssignee: assignee_id + assignee_type ('User' or 'Team')."""

    assignee_id: int
    assignee_type: str  # ActorType value: "User" or "Team"

    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.SET_ASSIGNED


class SetUnassignedAction(Action):
    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.SET_UNASSIGNED


class AutofixPrCreatedAction(Action):
    pr_id: str
    agent: str

    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.AUTOFIX_PR_CREATED


class ResolvedInPullRequestAction(Action):
    pr_id: str

    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.RESOLVED_IN_PULL_REQUEST

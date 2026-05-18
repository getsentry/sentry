"""
IssueAction type enum and IssueAction model hierarchy for IssueActionLogEntry.

This module has no Django model dependencies so it can be imported by both
the IssueActionLogEntry model (for choices) and recording.py (for record()).
"""

from __future__ import annotations

import abc
from enum import IntEnum

from pydantic import BaseModel


class IssueActionType(IntEnum):
    """
    The set of action kinds that can be recorded in IssueActionLogEntry.

    Each value is an integer stored in IssueActionLogEntry.type. This enum is
    the source of truth for what kinds of actions exist. Adding a new kind
    starts here, then requires a corresponding IssueAction subclass below.

    Values are not contiguous — gaps are fine.
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


class IssueAction(BaseModel, abc.ABC):
    """
    Base class for action payloads recorded to IssueActionLogEntry.

    Subclasses define the typed, validated payload for a specific action kind.
    Each subclass must implement get_type() to map to its IssueActionType.

    Actions are frozen Pydantic models — immutable after construction.
    Their fields are serialized to the IssueActionLogEntry.data JSON column
    via record(). The IssueAction is the sole source of the data schema;
    there is no way to inject unvalidated data into the log.
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


class FetchAction(IssueAction):
    """An agent or automated tool fetching issue data."""

    tool: str | None = None

    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.FETCH


class CommentAction(IssueAction):
    message: str

    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.COMMENT


class SetResolvedAction(IssueAction):
    resolution_type: str | None = None

    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.SET_RESOLVED


class SetUnresolvedAction(IssueAction):
    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.SET_UNRESOLVED


class SetAssignedAction(IssueAction):
    """Mirrors GroupAssignee: assignee_id + assignee_type ('User' or 'Team')."""

    assignee_id: int
    assignee_type: str  # ActorType value: "User" or "Team"

    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.SET_ASSIGNED


class SetUnassignedAction(IssueAction):
    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.SET_UNASSIGNED


class AutofixPrCreatedAction(IssueAction):
    pr_id: str
    agent: str

    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.AUTOFIX_PR_CREATED


class ResolvedInPullRequestAction(IssueAction):
    pr_id: str

    @classmethod
    def get_type(cls) -> IssueActionType:
        return IssueActionType.RESOLVED_IN_PULL_REQUEST

import logging
from typing import TYPE_CHECKING, Any, Mapping

import orjson
from pydantic.error_wrappers import ValidationError

from sentry.issues.action_log.types import (
    ArchiveAction,
    AssignAction,
    AutoSetOngoingAction,
    CommentAction,
    CreateIssueAction,
    DeletedAttachmentAction,
    DeployAction,
    GroupAction,
    MarkReviewedAction,
    MergeFromOtherAction,
    NewProcessingIssuesAction,
    PullRequestClosedAction,
    PullRequestMergedAction,
    PullRequestReopenedAction,
    PullRequestUnlinkedAction,
    ReferencedInCommitAction,
    ReprocessAction,
    ResolveAction,
    ResolvedInPullRequestAction,
    SeerCodingCompletedAction,
    SeerCodingStartedAction,
    SeerIterationCompletedAction,
    SeerIterationStartedAction,
    SeerPRCreatedAction,
    SeerPRReadyForReviewAction,
    SeerRCACompletedAction,
    SeerRCAStartedAction,
    SeerSolutionCompletedAction,
    SeerSolutionStartedAction,
    SetEscalatingAction,
    SetPriorityAction,
    SetPrivateAction,
    SetPublicAction,
    SetRegressedAction,
    SetResolvedByAgeAction,
    SetResolvedInCommitAction,
    SetResolvedInReleaseAction,
    TriggerAutofixAction,
    UnassignAction,
    UnmergeDestinationAction,
    UnmergeSourceAction,
    UnresolveAction,
)
from sentry.types.activity import ActivityType
from sentry.utils.env import in_test_environment
from sentry.utils.strings import strip_lone_surrogates

if TYPE_CHECKING:
    from sentry.models.activity import Activity


ACTIVITY_TYPES_WITH_NO_ACTION: frozenset[int] = frozenset(
    (
        ActivityType.FIRST_SEEN.value,
        ActivityType.RELEASE.value,
        # Internal signal that drives smart-assignment scoring/auto-assign off a
        # workflow activity handler; not a user-facing group action.
        ActivityType.SMART_ASSIGNMENT_COMPLETED.value,
    )
)

ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE: Mapping[int, type[GroupAction]] = {
    ActivityType.SET_RESOLVED.value: ResolveAction,
    ActivityType.SET_UNRESOLVED.value: UnresolveAction,
    ActivityType.SET_IGNORED.value: ArchiveAction,
    ActivityType.SET_PUBLIC.value: SetPublicAction,
    ActivityType.SET_PRIVATE.value: SetPrivateAction,
    ActivityType.SET_REGRESSION.value: SetRegressedAction,
    ActivityType.CREATE_ISSUE.value: CreateIssueAction,
    ActivityType.NOTE.value: CommentAction,
    ActivityType.ASSIGNED.value: AssignAction,
    ActivityType.UNASSIGNED.value: UnassignAction,
    ActivityType.SET_RESOLVED_IN_RELEASE.value: SetResolvedInReleaseAction,
    ActivityType.MERGE.value: MergeFromOtherAction,
    ActivityType.SET_RESOLVED_BY_AGE.value: SetResolvedByAgeAction,
    ActivityType.SET_RESOLVED_IN_COMMIT.value: SetResolvedInCommitAction,
    ActivityType.DEPLOY.value: DeployAction,
    ActivityType.NEW_PROCESSING_ISSUES.value: NewProcessingIssuesAction,
    ActivityType.UNMERGE_SOURCE.value: UnmergeSourceAction,
    ActivityType.UNMERGE_DESTINATION.value: UnmergeDestinationAction,
    ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value: ResolvedInPullRequestAction,
    ActivityType.REPROCESS.value: ReprocessAction,
    ActivityType.MARK_REVIEWED.value: MarkReviewedAction,
    ActivityType.AUTO_SET_ONGOING.value: AutoSetOngoingAction,
    ActivityType.SET_ESCALATING.value: SetEscalatingAction,
    ActivityType.SET_PRIORITY.value: SetPriorityAction,
    ActivityType.DELETED_ATTACHMENT.value: DeletedAttachmentAction,
    ActivityType.REFERENCED_IN_COMMIT.value: ReferencedInCommitAction,
    ActivityType.SEER_RCA_STARTED.value: SeerRCAStartedAction,
    ActivityType.SEER_RCA_COMPLETED.value: SeerRCACompletedAction,
    ActivityType.SEER_SOLUTION_STARTED.value: SeerSolutionStartedAction,
    ActivityType.SEER_SOLUTION_COMPLETED.value: SeerSolutionCompletedAction,
    ActivityType.SEER_CODING_STARTED.value: SeerCodingStartedAction,
    ActivityType.SEER_CODING_COMPLETED.value: SeerCodingCompletedAction,
    ActivityType.SEER_PR_CREATED.value: SeerPRCreatedAction,
    ActivityType.SEER_PR_READY_FOR_REVIEW.value: SeerPRReadyForReviewAction,
    ActivityType.SEER_ITERATION_STARTED.value: SeerIterationStartedAction,
    ActivityType.SEER_ITERATION_COMPLETED.value: SeerIterationCompletedAction,
    ActivityType.PULL_REQUEST_CLOSED.value: PullRequestClosedAction,
    ActivityType.PULL_REQUEST_REOPENED.value: PullRequestReopenedAction,
    ActivityType.PULL_REQUEST_MERGED.value: PullRequestMergedAction,
    ActivityType.PULL_REQUEST_UNLINKED.value: PullRequestUnlinkedAction,
    ActivityType.TRIGGER_AUTOFIX.value: TriggerAutofixAction,
}

ACTIVITY_TYPE_TO_ARG_TRANSLATIONS: Mapping[int, Mapping[str, str]] = {
    ActivityType.SET_IGNORED.value: {
        "ignoreCount": "ignore_count",
        "ignoreDuration": "ignore_duration",
        "ignoreUntil": "ignore_until",
        "ignoreUserCount": "ignore_user_count",
        "ignoreUserWindow": "ignore_user_window",
        "ignoreWindow": "ignore_window",
        "ignoreUntilEscalating": "ignore_until_escalating",
    },
    ActivityType.ASSIGNED.value: {
        "assigneeEmail": "assignee_email",
        "assigneeName": "assignee_name",
        "assigneeType": "assignee_type",
    },
    ActivityType.SET_RESOLVED_BY_AGE.value: {"age": "auto_resolve_age_threshold"},
    ActivityType.REPROCESS.value: {
        "eventCount": "event_count",
        "oldGroupId": "old_group_id",
        "newGroupId": "new_group_id",
    },
}

# GroupActionTypes are serialized with the same `type` string as their
# equivalent Activity so the frontend can consume both identically
GROUP_ACTION_TYPE_TO_ACTIVITY_TYPE = {
    action_cls.get_type().value: activity_type
    for activity_type, action_cls in ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE.items()
}

# GALE payloads are stored with the snake_case GroupAction field names, but the
# frontend consumes the Activity `data` shape. Reverse the camelCase -> snake_case
# renames that activity_translator applies when mirroring Activities into
# GroupActions, keyed by GroupActionType value.
GROUP_ACTION_TYPE_TO_ACTIVITY_KEYS = {
    action_cls.get_type().value: {
        gale_key: activity_key
        for activity_key, gale_key in ACTIVITY_TYPE_TO_ARG_TRANSLATIONS[activity_type].items()
    }
    for activity_type, action_cls in ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE.items()
    if activity_type in ACTIVITY_TYPE_TO_ARG_TRANSLATIONS
}


logger = logging.getLogger(__name__)


def _needs_jsonb_sanitize(value: Any) -> bool:
    """
    Return True if ``value`` contains any character that Postgres ``jsonb`` (or
    psycopg2's UTF-8 param encoding) refuses.

    Uses orjson to walk the tree in native code: serializing a JSON-shaped
    Python object is dramatically faster than a pure-Python recursive scan,
    and orjson conveniently distinguishes the two failure modes for us —
    it raises ``TypeError`` on lone UTF-16 surrogates, and escapes ``\\x00``
    as the six-byte sequence ``\\u0000`` which we detect with a bytes search.
    """
    try:
        blob = orjson.dumps(value)
    except TypeError:
        # orjson refuses lone surrogates ("str is not valid UTF-8"). That's
        # exactly the shape jsonb refuses, so treat as dirty.
        return True
    return b"\\u0000" in blob


def _sanitize_for_jsonb(value: Any) -> Any:
    """
    Recursively scrub string values so they can safely be written to a Postgres
    ``jsonb`` column.

    Activity ``data`` is stored in a text-based JSON column (and originates from
    permissive sources like webhook payloads and user input), so it can contain
    two shapes that ``jsonb`` refuses:

    * ``NUL`` (``\\x00``) bytes — ``jsonb`` rejects the ``\\u0000`` escape.
    * Lone UTF-16 surrogates (``\\uD800``–``\\uDFFF``) — Python ``str`` tolerates
      them, but they are not valid UTF-8 and both psycopg2's parameter encoding
      and ``jsonb`` refuse them.

    Callers should gate this on :func:`_needs_jsonb_sanitize` so the common
    "clean data" path avoids rebuilding the object tree.
    """
    if isinstance(value, str):
        cleaned = strip_lone_surrogates(value)
        if "\x00" in cleaned:
            cleaned = cleaned.replace("\x00", "")
        return cleaned
    if isinstance(value, dict):
        return {_sanitize_for_jsonb(k): _sanitize_for_jsonb(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_for_jsonb(v) for v in value]
    if isinstance(value, tuple):
        return tuple(_sanitize_for_jsonb(v) for v in value)
    return value


def activity_to_action(activity: "Activity") -> GroupAction | None:
    """
    Translates an Activity to a GroupAction. None is returned in the error case.
    Does not publish the GroupAction to a GroupActionLogEntry.
    """

    # Ignore certain Activities that don't make sense to translate to GroupActions.
    if activity.type in ACTIVITY_TYPES_WITH_NO_ACTION:
        return None

    # Get the related type[GroupAction]
    group_action_type = ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE.get(activity.type)

    if group_action_type is None:
        message = f"Failed to find group action type equivalent of activity type {activity.type}"
        if in_test_environment():
            raise Exception(message)
        logger.warning(message)
        return None

    # Instantiate & return
    kwargs = activity.data or {}  # Sometimes None

    # Activity data is stored in a text JSON column that tolerates NUL bytes
    # and lone surrogates, but the resulting action payload is written to a
    # jsonb column (outbox payload and GroupActionLogEntry.data) which rejects
    # both. Scan the tree first — only rewrite when we actually find something
    # to strip, so the common clean-data path avoids the extra allocations.
    if _needs_jsonb_sanitize(kwargs):
        kwargs = _sanitize_for_jsonb(kwargs)

    if activity.type in ACTIVITY_TYPE_TO_ARG_TRANSLATIONS.keys():
        kwargs = {
            ACTIVITY_TYPE_TO_ARG_TRANSLATIONS[activity.type].get(k, k): v for k, v in kwargs.items()
        }

    if activity.type == ActivityType.MERGE.value:
        # Translate from Activity data structure to GroupAction data structure.
        kwargs = kwargs.copy()  # Avoid mutating existing dict
        kwargs["counterpart_group_ids"] = [datum["id"] for datum in kwargs.get("issues", [])]

    if activity.type == ActivityType.NOTE.value:
        kwargs = kwargs.copy()  # Avoid mutating existing dict
        kwargs["comment_id"] = activity.id

    # Pydantic lets you pass in whatever kwargs you want. If a kwarg matches some field,
    # Pydantic will set it - else Pydantic just ignores it.
    # The only risk is missing a required field, which throws a ValidationError.
    try:
        return group_action_type(**kwargs)
    except ValidationError:
        logger.exception(
            "Failed to create group action in activity_translator.",
            extra={"group_action_type": group_action_type, "activity_type": activity.type},
        )
        if in_test_environment():
            raise
        return None


def activity_action_idempotency_key(activity: "Activity") -> str:
    return f"activity:{activity.id}"

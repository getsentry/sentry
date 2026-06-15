import logging

from pydantic.error_wrappers import ValidationError

from sentry.issues.action_log.types import (
    AssignAction,
    AutoSetOngoingActivityAction,
    CreateIssueActivityAction,
    DeletedAttachmentActivityAction,
    DeployActivityAction,
    GroupAction,
    MarkReviewedAction,
    MergeFromOtherAction,
    NewProcessingIssuesActivityAction,
    NoteActivityAction,
    ReferencedInCommitActivityAction,
    ReleaseActivityAction,
    ReprocessActivityAction,
    ResolveAction,
    SeerCodingCompletedActivityAction,
    SeerCodingStartedActivityAction,
    SeerIterationCompletedActivityAction,
    SeerIterationStartedActivityAction,
    SeerPRCreatedActivityAction,
    SeerRCACompletedActivityAction,
    SeerRCAStartedActivityAction,
    SeerSolutionCompletedActivityAction,
    SeerSolutionStartedActivityAction,
    SetEscalatingActivityAction,
    SetIgnoredActivityAction,
    SetPriorityAction,
    SetPrivateActivityAction,
    SetPublicActivityAction,
    SetRegressionActivityAction,
    SetResolvedByAgeActivityAction,
    SetResolvedInCommitActivityAction,
    SetResolvedInPullRequestActivityAction,
    SetResolvedInReleaseActivityAction,
    UnassignAction,
    UnmergeDestinationActivityAction,
    UnmergeSourceActivityAction,
    UnresolveAction,
)
from sentry.models.activity import Activity
from sentry.types.activity import ActivityType

ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE: dict[int, type[GroupAction]] = {
    ActivityType.SET_RESOLVED.value: ResolveAction,
    ActivityType.SET_UNRESOLVED.value: UnresolveAction,
    ActivityType.SET_IGNORED.value: SetIgnoredActivityAction,
    ActivityType.SET_PUBLIC.value: SetPublicActivityAction,
    ActivityType.SET_PRIVATE.value: SetPrivateActivityAction,
    ActivityType.SET_REGRESSION.value: SetRegressionActivityAction,
    ActivityType.CREATE_ISSUE.value: CreateIssueActivityAction,
    ActivityType.NOTE.value: NoteActivityAction,
    ActivityType.RELEASE.value: ReleaseActivityAction,
    ActivityType.ASSIGNED.value: AssignAction,
    ActivityType.UNASSIGNED.value: UnassignAction,
    ActivityType.SET_RESOLVED_IN_RELEASE.value: SetResolvedInReleaseActivityAction,
    ActivityType.MERGE.value: MergeFromOtherAction,
    ActivityType.SET_RESOLVED_BY_AGE.value: SetResolvedByAgeActivityAction,
    ActivityType.SET_RESOLVED_IN_COMMIT.value: SetResolvedInCommitActivityAction,
    ActivityType.DEPLOY.value: DeployActivityAction,
    ActivityType.NEW_PROCESSING_ISSUES.value: NewProcessingIssuesActivityAction,
    ActivityType.UNMERGE_SOURCE.value: UnmergeSourceActivityAction,
    ActivityType.UNMERGE_DESTINATION.value: UnmergeDestinationActivityAction,
    ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value: SetResolvedInPullRequestActivityAction,
    ActivityType.REPROCESS.value: ReprocessActivityAction,
    ActivityType.MARK_REVIEWED.value: MarkReviewedAction,
    ActivityType.AUTO_SET_ONGOING.value: AutoSetOngoingActivityAction,
    ActivityType.SET_ESCALATING.value: SetEscalatingActivityAction,
    ActivityType.SET_PRIORITY.value: SetPriorityAction,
    ActivityType.DELETED_ATTACHMENT.value: DeletedAttachmentActivityAction,
    ActivityType.REFERENCED_IN_COMMIT.value: ReferencedInCommitActivityAction,
    ActivityType.SEER_RCA_STARTED.value: SeerRCAStartedActivityAction,
    ActivityType.SEER_RCA_COMPLETED.value: SeerRCACompletedActivityAction,
    ActivityType.SEER_SOLUTION_STARTED.value: SeerSolutionStartedActivityAction,
    ActivityType.SEER_SOLUTION_COMPLETED.value: SeerSolutionCompletedActivityAction,
    ActivityType.SEER_CODING_STARTED.value: SeerCodingStartedActivityAction,
    ActivityType.SEER_CODING_COMPLETED.value: SeerCodingCompletedActivityAction,
    ActivityType.SEER_PR_CREATED.value: SeerPRCreatedActivityAction,
    ActivityType.SEER_ITERATION_STARTED.value: SeerIterationStartedActivityAction,
    ActivityType.SEER_ITERATION_COMPLETED.value: SeerIterationCompletedActivityAction,
}

logger = logging.getLogger(__name__)


def activity_to_action(activity: Activity) -> GroupAction | None:
    """
    Translates an Activity to a GroupAction. None is returned in the error case.
    Does not publish the GroupAction to a GroupActionLogEntry.
    """

    if activity.type == ActivityType.FIRST_SEEN.value:
        # This is a very weird case where FIRST_SEEN isn't a real ActivityType but is
        # virtually created on read.
        return None

    # Pydantic lets you pass in whatever kwargs you want. If a kwarg matches some field,
    # Pydantic will set it - else Pydantic just ignores it.
    # The only risk is missing a required field, which throws a ValidationError.

    # Get the related type[GroupAction]
    group_action_type = ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE.get(activity.type)

    if group_action_type is None:
        logger.info(
            "Failed to find group action type equivalent of activity type %s", activity.type
        )
        return None

    # Instantiate & return
    kwargs = activity.data or {}  # Sometimes None

    if activity.type == ActivityType.MERGE.value:
        # Translate from Activity data structure to GroupAction data structure.
        kwargs = kwargs.copy()  # Avoid mutating existing dict
        kwargs["counterpart_group_ids"] = [datum["id"] for datum in kwargs.get("issues", [])]

    try:
        return group_action_type(**kwargs)
    except ValidationError:
        logger.exception(
            "Failed to create group action in activity_translator.",
            extra={"group_action_type": group_action_type, "activity_type": activity.type},
        )
        return None

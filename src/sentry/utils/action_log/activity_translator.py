import logging

from pydantic.error_wrappers import ValidationError

from sentry.issues.action_log.types import (
    AssignAction,
    AutoSetOngoingActivityAction,
    CreateIssueActivityAction,
    DeletedAttachmentActivityAction,
    DeployActivityAction,
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
from sentry.models.group import GroupAction
from sentry.types.activity import ActivityType

ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE: dict[ActivityType, type[GroupAction]] = {
    ActivityType.SET_RESOLVED: ResolveAction,
    ActivityType.SET_UNRESOLVED: UnresolveAction,
    ActivityType.SET_IGNORED: SetIgnoredActivityAction,
    ActivityType.SET_PUBLIC: SetPublicActivityAction,
    ActivityType.SET_PRIVATE: SetPrivateActivityAction,
    ActivityType.SET_REGRESSION: SetRegressionActivityAction,
    ActivityType.CREATE_ISSUE: CreateIssueActivityAction,
    ActivityType.NOTE: NoteActivityAction,
    ActivityType.RELEASE: ReleaseActivityAction,
    ActivityType.ASSIGNED: AssignAction,
    ActivityType.UNASSIGNED: UnassignAction,
    ActivityType.SET_RESOLVED_IN_RELEASE: SetResolvedInReleaseActivityAction,
    ActivityType.MERGE: MergeFromOtherAction,
    ActivityType.SET_RESOLVED_BY_AGE: SetResolvedByAgeActivityAction,
    ActivityType.SET_RESOLVED_IN_COMMIT: SetResolvedInCommitActivityAction,
    ActivityType.DEPLOY: DeployActivityAction,
    ActivityType.NEW_PROCESSING_ISSUES: NewProcessingIssuesActivityAction,
    ActivityType.UNMERGE_SOURCE: UnmergeSourceActivityAction,
    ActivityType.UNMERGE_DESTINATION: UnmergeDestinationActivityAction,
    ActivityType.SET_RESOLVED_IN_PULL_REQUEST: SetResolvedInPullRequestActivityAction,
    ActivityType.REPROCESS: ReprocessActivityAction,
    ActivityType.MARK_REVIEWED: MarkReviewedAction,
    ActivityType.AUTO_SET_ONGOING: AutoSetOngoingActivityAction,
    ActivityType.SET_ESCALATING: SetEscalatingActivityAction,
    ActivityType.SET_PRIORITY: SetPriorityAction,
    ActivityType.DELETED_ATTACHMENT: DeletedAttachmentActivityAction,
    ActivityType.REFERENCED_IN_COMMIT: ReferencedInCommitActivityAction,
    ActivityType.SEER_RCA_STARTED: SeerRCAStartedActivityAction,
    ActivityType.SEER_RCA_COMPLETED: SeerRCACompletedActivityAction,
    ActivityType.SEER_SOLUTION_STARTED: SeerSolutionStartedActivityAction,
    ActivityType.SEER_SOLUTION_COMPLETED: SeerSolutionCompletedActivityAction,
    ActivityType.SEER_CODING_STARTED: SeerCodingStartedActivityAction,
    ActivityType.SEER_CODING_COMPLETED: SeerCodingCompletedActivityAction,
    ActivityType.SEER_PR_CREATED: SeerPRCreatedActivityAction,
    ActivityType.SEER_ITERATION_STARTED: SeerIterationStartedActivityAction,
    ActivityType.SEER_ITERATION_COMPLETED: SeerIterationCompletedActivityAction,
}

logger = logging.getLogger(__name__)


def activity_to_action(activity: Activity) -> GroupAction | None:
    """
    Translates an Activity to a GroupAction. None is returned in the error case.
    Does not publish the GroupAction to a GroupActionLogEntry.
    """

    if activity.type == ActivityType.FIRST_SEEN:
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
    kwargs = activity.data
    if activity.type == ActivityType.MERGE:
        # Translate from Activity data structure to GroupAction data structure.
        kwargs["counterpart_group_ids"] = [datum["id"] for datum in kwargs["issues"]]

    try:
        return group_action_type(**kwargs)
    except ValidationError:
        logger.exception(
            "Failed to create group action ",
            extra={"group_action_type": group_action_type, "activity_type": activity.type},
        )
        return None

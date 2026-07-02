from enum import Enum
from typing import Literal, cast

ActivityTypeStr = Literal[
    "set_resolved",
    "set_unresolved",
    "set_ignored",
    "set_public",
    "set_private",
    "set_regression",
    "create_issue",
    "note",
    "first_seen",
    "release",
    "assigned",
    "unassigned",
    "set_resolved_in_release",
    "merge",
    "set_resolved_by_age",
    "set_resolved_in_commit",
    "deploy",
    "new_processing_issues",
    "unmerge_source",
    "unmerge_destination",
    "set_resolved_in_pull_request",
    "reprocess",
    "mark_reviewed",
    "auto_set_ongoing",
    "set_escalating",
    "set_priority",
    "deleted_attachment",
    "referenced_in_commit",
    "seer_rca_started",
    "seer_rca_completed",
    "seer_solution_started",
    "seer_solution_completed",
    "seer_coding_started",
    "seer_coding_completed",
    "seer_pr_created",
    "seer_iteration_started",
    "seer_iteration_completed",
    "pull_request_closed",
]


class ActivityType(Enum):
    SET_RESOLVED = 1
    SET_UNRESOLVED = 2
    SET_IGNORED = 3
    SET_PUBLIC = 4
    SET_PRIVATE = 5
    SET_REGRESSION = 6
    CREATE_ISSUE = 7
    NOTE = 8
    FIRST_SEEN = 9
    RELEASE = 10
    ASSIGNED = 11
    UNASSIGNED = 12
    SET_RESOLVED_IN_RELEASE = 13
    MERGE = 14
    SET_RESOLVED_BY_AGE = 15
    SET_RESOLVED_IN_COMMIT = 16
    DEPLOY = 17
    NEW_PROCESSING_ISSUES = 18
    UNMERGE_SOURCE = 19
    UNMERGE_DESTINATION = 20
    SET_RESOLVED_IN_PULL_REQUEST = 21

    # The user has reprocessed the group, so events may have moved to new groups
    REPROCESS = 22
    MARK_REVIEWED = 23
    AUTO_SET_ONGOING = 24
    SET_ESCALATING = 25

    SET_PRIORITY = 26
    DELETED_ATTACHMENT = 27
    REFERENCED_IN_COMMIT = 28

    SEER_RCA_STARTED = 29
    SEER_RCA_COMPLETED = 30
    SEER_SOLUTION_STARTED = 31
    SEER_SOLUTION_COMPLETED = 32
    SEER_CODING_STARTED = 33
    SEER_CODING_COMPLETED = 34
    SEER_PR_CREATED = 35
    SEER_ITERATION_STARTED = 36
    SEER_ITERATION_COMPLETED = 37

    # A pull request linked to the group was closed without merging
    PULL_REQUEST_CLOSED = 38


def activity_type_to_str(value: int) -> ActivityTypeStr:
    # Cast is safe: a test asserts ActivityTypeStr matches the enum names exactly.
    return cast(ActivityTypeStr, ActivityType(value).name.lower())


# Warning: This must remain in this EXACT order.
CHOICES = tuple(
    (i.value, i.name.lower())
    for i in [
        ActivityType.SET_RESOLVED,  # 1
        ActivityType.SET_RESOLVED_BY_AGE,  # 15
        ActivityType.SET_RESOLVED_IN_RELEASE,  # 13
        ActivityType.SET_RESOLVED_IN_COMMIT,  # 16
        ActivityType.SET_RESOLVED_IN_PULL_REQUEST,  # 21
        ActivityType.SET_UNRESOLVED,  # 2
        ActivityType.SET_IGNORED,  # 3
        ActivityType.SET_PUBLIC,  # 4
        ActivityType.SET_PRIVATE,  # 5
        ActivityType.SET_REGRESSION,  # 6
        ActivityType.CREATE_ISSUE,  # 7
        ActivityType.NOTE,  # 8
        ActivityType.FIRST_SEEN,  # 9
        ActivityType.RELEASE,  # 10
        ActivityType.ASSIGNED,  # 11
        ActivityType.UNASSIGNED,  # 12
        ActivityType.MERGE,  # 14
        ActivityType.DEPLOY,  # 17
        ActivityType.NEW_PROCESSING_ISSUES,  # 18
        ActivityType.UNMERGE_SOURCE,  # 19
        ActivityType.UNMERGE_DESTINATION,  # 20
        ActivityType.REPROCESS,  # 22
        ActivityType.MARK_REVIEWED,  # 23
        ActivityType.AUTO_SET_ONGOING,  # 24
        ActivityType.SET_ESCALATING,  # 25
        ActivityType.SET_PRIORITY,  # 26
        ActivityType.DELETED_ATTACHMENT,  # 27
        ActivityType.REFERENCED_IN_COMMIT,  # 28
        ActivityType.SEER_RCA_STARTED,  # 29
        ActivityType.SEER_RCA_COMPLETED,  # 30
        ActivityType.SEER_SOLUTION_STARTED,  # 31
        ActivityType.SEER_SOLUTION_COMPLETED,  # 32
        ActivityType.SEER_CODING_STARTED,  # 33
        ActivityType.SEER_CODING_COMPLETED,  # 34
        ActivityType.SEER_PR_CREATED,  # 35
        ActivityType.SEER_ITERATION_STARTED,  # 36
        ActivityType.SEER_ITERATION_COMPLETED,  # 37
        ActivityType.PULL_REQUEST_CLOSED,  # 38
    ]
)

SEER_ACTIVITY_TYPES = (
    ActivityType.SEER_RCA_STARTED,
    ActivityType.SEER_RCA_COMPLETED,
    ActivityType.SEER_SOLUTION_STARTED,
    ActivityType.SEER_SOLUTION_COMPLETED,
    ActivityType.SEER_CODING_STARTED,
    ActivityType.SEER_CODING_COMPLETED,
    ActivityType.SEER_PR_CREATED,
    ActivityType.SEER_ITERATION_STARTED,
    ActivityType.SEER_ITERATION_COMPLETED,
)


STATUS_CHANGE_ACTIVITY_TYPES = (
    ActivityType.SET_RESOLVED,
    ActivityType.SET_UNRESOLVED,
    ActivityType.SET_IGNORED,
    ActivityType.SET_REGRESSION,
    ActivityType.SET_RESOLVED_IN_RELEASE,
    ActivityType.SET_RESOLVED_BY_AGE,
    ActivityType.SET_RESOLVED_IN_COMMIT,
    ActivityType.SET_RESOLVED_IN_PULL_REQUEST,
    ActivityType.SET_ESCALATING,
)

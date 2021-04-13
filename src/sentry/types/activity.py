from enum import Enum


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
    REPROCESS = 22
    MARK_REVIEWED = 23


ACTIVITY_VERB_SLUGS = {
    ActivityType.ASSIGNED: "assigned",
    ActivityType.CREATE_ISSUE: "create_issue",
    ActivityType.DEPLOY: "deploy",
    ActivityType.FIRST_SEEN: "first_seen",
    ActivityType.MARK_REVIEWED: "mark_reviewed",
    ActivityType.MERGE: "merge",
    ActivityType.NEW_PROCESSING_ISSUES: "new_processing_issues",
    ActivityType.NOTE: "note",
    ActivityType.RELEASE: "release",
    # The user has reprocessed the group, so events may have moved to new groups
    ActivityType.REPROCESS: "reprocess",
    ActivityType.SET_IGNORED: "set_ignored",
    ActivityType.SET_PRIVATE: "set_private",
    ActivityType.SET_PUBLIC: "set_public",
    ActivityType.SET_REGRESSION: "set_regression",
    ActivityType.SET_RESOLVED: "set_resolved",
    ActivityType.SET_RESOLVED_BY_AGE: "set_resolved_by_age",
    ActivityType.SET_RESOLVED_IN_COMMIT: "set_resolved_in_commit",
    ActivityType.SET_RESOLVED_IN_PULL_REQUEST: "set_resolved_in_pull_request",
    ActivityType.SET_RESOLVED_IN_RELEASE: "set_resolved_in_release",
    ActivityType.SET_UNRESOLVED: "set_unresolved",
    ActivityType.UNASSIGNED: "unassigned",
    ActivityType.UNMERGE_DESTINATION: "unmerge_destination",
    ActivityType.UNMERGE_SOURCE: "unmerge_source",
}

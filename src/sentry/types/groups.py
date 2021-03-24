from enum import Enum


# TODO(dcramer): pull in enum library
class GroupStatus:
    UNRESOLVED = 0
    RESOLVED = 1
    IGNORED = 2
    PENDING_DELETION = 3
    DELETION_IN_PROGRESS = 4
    PENDING_MERGE = 5

    # The group's events are being re-processed and after that the group will
    # be deleted. In this state no new events shall be added to the group.
    REPROCESSING = 6

    # TODO(dcramer): remove in 9.0
    MUTED = IGNORED


# Statuses that can be queried/searched for
STATUS_QUERY_CHOICES = {
    "resolved": GroupStatus.RESOLVED,
    "unresolved": GroupStatus.UNRESOLVED,
    "ignored": GroupStatus.IGNORED,
    # TODO(dcramer): remove in 9.0
    "muted": GroupStatus.IGNORED,
    "reprocessing": GroupStatus.REPROCESSING,
}

# Statuses that can be updated from the regular "update group" API
#
# Differences over STATUS_QUERY_CHOICES:
#
# reprocessing is missing as it is its own endpoint and requires extra input
# resolvedInNextRelease is added as that is an action that can be taken, but at
# the same time it can't be queried for
STATUS_UPDATE_CHOICES = {
    "resolved": GroupStatus.RESOLVED,
    "unresolved": GroupStatus.UNRESOLVED,
    "ignored": GroupStatus.IGNORED,
    "resolvedInNextRelease": GroupStatus.UNRESOLVED,
    # TODO(dcramer): remove in 9.0
    "muted": GroupStatus.IGNORED,
}

INBOX_REASON_DETAILS = {
    "type": ["object", "null"],
    "properties": {
        "until": {"type": ["string", "null"], "format": "date-time"},
        "count": {"type": ["integer", "null"]},
        "window": {"type": ["integer", "null"]},
        "user_count": {"type": ["integer", "null"]},
        "user_window": {"type": ["integer", "null"]},
    },
    "required": [],
    "additionalProperties": False,
}


class GroupInboxReason(Enum):
    NEW = 0
    UNIGNORED = 1
    REGRESSION = 2
    MANUAL = 3
    REPROCESSED = 4


class GroupInboxRemoveAction(Enum):
    RESOLVED = "resolved"
    IGNORED = "ignored"
    MARK_REVIEWED = "mark_reviewed"


class GroupSubscriptionReason:
    implicit = -1  # not for use as a persisted field value
    committed = -2  # not for use as a persisted field value
    processing_issue = -3  # not for use as a persisted field value

    unknown = 0
    comment = 1
    assigned = 2
    bookmark = 3
    status_change = 4
    deploy_setting = 5
    mentioned = 6
    team_mentioned = 7

    descriptions = {
        implicit: "have opted to receive updates for all issues within "
        "projects that you are a member of",
        committed: "were involved in a commit that is part of this release",
        processing_issue: "are subscribed to alerts for this project",
        comment: "have commented on this issue",
        assigned: "have been assigned to this issue",
        bookmark: "have bookmarked this issue",
        status_change: "have changed the resolution status of this issue",
        deploy_setting: "opted to receive all deploy notifications for this organization",
        mentioned: "have been mentioned in this issue",
        team_mentioned: "are a member of a team mentioned in this issue",
    }


SUBSCRIPTION_REASON_MAP = {
    GroupSubscriptionReason.comment: "commented",
    GroupSubscriptionReason.assigned: "assigned",
    GroupSubscriptionReason.bookmark: "bookmarked",
    GroupSubscriptionReason.status_change: "changed_status",
    GroupSubscriptionReason.mentioned: "mentioned",
}


class GroupResolutionType:
    in_release = 0
    in_next_release = 1


class GroupResolutionStatus:
    pending = 0
    resolved = 1

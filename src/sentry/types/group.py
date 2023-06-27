from typing import Mapping

from sentry.models.group import GroupStatus

# TODO(dcramer): pull in enum library
# Statuses that can be queried/searched for
STATUS_QUERY_CHOICES: Mapping[str, int] = {
    "resolved": GroupStatus.RESOLVED,
    "unresolved": GroupStatus.UNRESOLVED,
    "ignored": GroupStatus.IGNORED,
    "archived": GroupStatus.IGNORED,
    # TODO(dcramer): remove in 9.0
    "muted": GroupStatus.IGNORED,
    "reprocessing": GroupStatus.REPROCESSING,
}
QUERY_STATUS_LOOKUP = {
    status: query for query, status in STATUS_QUERY_CHOICES.items() if query != "muted"
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


class GroupSubStatus:
    # GroupStatus.IGNORED
    UNTIL_ESCALATING = 1
    # Group is ignored/archived for a count/user count/duration
    UNTIL_CONDITION_MET = 4
    # Group is ignored/archived forever
    FOREVER = 5

    # GroupStatus.UNRESOLVED
    ESCALATING = 2
    ONGOING = 3
    REGRESSED = 6
    NEW = 7


UNRESOLVED_SUBSTATUS_CHOICES = {
    GroupSubStatus.ONGOING,
    GroupSubStatus.ESCALATING,
    GroupSubStatus.REGRESSED,
    GroupSubStatus.NEW,
}

IGNORED_SUBSTATUS_CHOICES = {
    GroupSubStatus.UNTIL_ESCALATING,
    GroupSubStatus.FOREVER,
    GroupSubStatus.UNTIL_CONDITION_MET,
    # IGNORED groups may have no substatus for now. Remove this once the migration is complete.
    None,
}

SUBSTATUS_UPDATE_CHOICES: Mapping[str, int] = {
    "archived_until_escalating": GroupSubStatus.UNTIL_ESCALATING,
    "archived_until_condition_met": GroupSubStatus.UNTIL_CONDITION_MET,
    "archived_forever": GroupSubStatus.FOREVER,
    "escalating": GroupSubStatus.ESCALATING,
    "ongoing": GroupSubStatus.ONGOING,
    "regressed": GroupSubStatus.REGRESSED,
    "new": GroupSubStatus.NEW,
    # Deprecated
    "until_escalating": GroupSubStatus.UNTIL_ESCALATING,
    # Deprecated
    "until_condition_met": GroupSubStatus.UNTIL_CONDITION_MET,
    # Deprecated
    "forever": GroupSubStatus.FOREVER,
}

SUBSTATUS_TO_STR: Mapping[int, str] = {
    GroupSubStatus.UNTIL_ESCALATING: "archived_until_escalating",
    GroupSubStatus.UNTIL_CONDITION_MET: "archived_until_condition_met",
    GroupSubStatus.FOREVER: "archived_forever",
    GroupSubStatus.ESCALATING: "escalating",
    GroupSubStatus.ONGOING: "ongoing",
    GroupSubStatus.REGRESSED: "regressed",
    GroupSubStatus.NEW: "new",
}

GROUP_SUBSTATUS_TO_GROUP_HISTORY_STATUS = {
    GroupSubStatus.ESCALATING: "escalating",
    GroupSubStatus.REGRESSED: "regressed",
    GroupSubStatus.ONGOING: "unresolved",
    GroupSubStatus.UNTIL_ESCALATING: "archived_until_escalating",
    GroupSubStatus.FOREVER: "archived_forever",
    GroupSubStatus.UNTIL_CONDITION_MET: "archived_until_condition_met",
}

GROUP_SUBSTATUS_TO_STATUS_MAP = {
    GroupSubStatus.ESCALATING: GroupStatus.UNRESOLVED,
    GroupSubStatus.REGRESSED: GroupStatus.UNRESOLVED,
    GroupSubStatus.ONGOING: GroupStatus.UNRESOLVED,
    GroupSubStatus.NEW: GroupStatus.UNRESOLVED,
    GroupSubStatus.UNTIL_ESCALATING: GroupStatus.IGNORED,
    GroupSubStatus.FOREVER: GroupStatus.IGNORED,
    GroupSubStatus.UNTIL_CONDITION_MET: GroupStatus.IGNORED,
}


class State:
    status: GroupStatus = GroupStatus.UNRESOLVED
    substatus: GroupSubStatus = None

    def __eq__(self, other):
        return self.status == other.status and self.substatus == other.substatus


class IssueState:
    NEW = State(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.NEW)
    ONGOING = State(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING)
    ESCALATING = State(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ESCALATING)
    REGRESSED = State(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.REGRESSED)

    ARCHIVED_UNTIL_ESCALATING = State(
        status=GroupStatus.IGNORED, substatus=GroupSubStatus.UNTIL_ESCALATING
    )
    ARCHIVED_UNTIL_CONDITION_MET = State(
        status=GroupStatus.IGNORED, substatus=GroupSubStatus.UNTIL_CONDITION_MET
    )
    ARCHIVED_FOREVER = State(status=GroupStatus.IGNORED, substatus=GroupSubStatus.FOREVER)

    RESOLVED = State(status=GroupStatus.RESOLVED)
    PENDING_DELETION = State(status=GroupStatus.PENDING_DELETION)
    DELETION_IN_PROGRESS = State(status=GroupStatus.DELETION_IN_PROGRESS)
    PENDING_MERGE = State(status=GroupStatus.PENDING_MERGE)
    REPROCESSING = State(status=GroupStatus.REPROCESSING)

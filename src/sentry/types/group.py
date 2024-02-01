from typing import Mapping


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

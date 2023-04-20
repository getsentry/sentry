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
    # IGNORED groups may have no substatus for now. We will be adding two more substatuses in the future to simplify this.
    None,
}

SUBSTATUS_UPDATE_CHOICES = {
    "until_escalating": GroupSubStatus.UNTIL_ESCALATING,
    "escalating": GroupSubStatus.ESCALATING,
    "ongoing": GroupSubStatus.ONGOING,
    "forever": GroupSubStatus.FOREVER,
    "until_condition_met": GroupSubStatus.UNTIL_CONDITION_MET,
    "regressed": GroupSubStatus.REGRESSED,
    "new": GroupSubStatus.NEW,
}

GROUP_SUBSTATUS_TO_GROUP_HISTORY_STATUS = {
    GroupSubStatus.ESCALATING: "escalating",
    GroupSubStatus.REGRESSED: "regressed",
    GroupSubStatus.ONGOING: "unresolved",
    GroupSubStatus.UNTIL_ESCALATING: "archived_until_escalating",
}

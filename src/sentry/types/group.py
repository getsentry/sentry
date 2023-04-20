class GroupSubStatus:
    # GroupStatus.IGNORED
    UNTIL_ESCALATING = 1
    FOREVER = 6
    UNTIL_CONDITION_MET = 7

    # GroupStatus.UNRESOLVED
    ESCALATING = 2
    ONGOING = 3
    REGRESSED = 4
    NEW = 5


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

SUBSTATUS_UPDATE_CHOICES = {
    "until_escalating": GroupSubStatus.UNTIL_ESCALATING,
    "escalating": GroupSubStatus.ESCALATING,
    "ongoing": GroupSubStatus.ONGOING,
    "regressed": GroupSubStatus.REGRESSED,
    "new": GroupSubStatus.NEW,
    "forever": GroupSubStatus.FOREVER,
    "until_condition_met": GroupSubStatus.UNTIL_CONDITION_MET,
}

GROUP_SUBSTATUS_TO_GROUP_HISTORY_STATUS = {
    GroupSubStatus.ESCALATING: "escalating",
    GroupSubStatus.REGRESSED: "regressed",
    GroupSubStatus.ONGOING: "unresolved",
    GroupSubStatus.UNTIL_ESCALATING: "archived_until_escalating",
    GroupSubStatus.FOREVER: "archived_forever",
    GroupSubStatus.UNTIL_CONDITION_MET: "archived_until_condition_met",
}

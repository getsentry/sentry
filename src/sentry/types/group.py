class GroupSubStatus:
    # GroupStatus.IGNORED
    UNTIL_ESCALATING = 1

    # GroupStatus.UNRESOLVED
    ESCALATING = 2
    ONGOING = 3


UNRESOLVED_SUBSTATUS_CHOICES = {
    GroupSubStatus.ONGOING,
    GroupSubStatus.ESCALATING,
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
}

GROUP_SUBSTATUS_TO_GROUP_HISTORY_STATUS = {
    GroupSubStatus.ESCALATING: "escalating",
    GroupSubStatus.UNTIL_ESCALATING: "archived_until_escalating",
}

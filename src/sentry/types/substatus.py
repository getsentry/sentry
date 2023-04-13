class GroupSubStatus:
    UNTIL_ESCALATING = 1
    ESCALATING = 2
    ONGOING = 3


SUBSTATUS_UPDATE_CHOICES = {
    "until_escalating": GroupSubStatus.UNTIL_ESCALATING,
    "escalating": GroupSubStatus.ESCALATING,
    "ongoing": GroupSubStatus.ONGOING,
}

GROUP_SUBSTATUS_TO_GROUP_HISTORY_STATUS = {
    GroupSubStatus.ESCALATING: "escalating",
    GroupSubStatus.UNTIL_ESCALATING: "archived_until_escalating",
}

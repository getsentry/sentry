from collections.abc import Mapping
from enum import IntEnum


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
}

SUBSTATUS_UPDATE_CHOICES: Mapping[str, int] = {
    "archived_until_escalating": GroupSubStatus.UNTIL_ESCALATING,
    "archived_until_condition_met": GroupSubStatus.UNTIL_CONDITION_MET,
    "archived_forever": GroupSubStatus.FOREVER,
    "escalating": GroupSubStatus.ESCALATING,
    "ongoing": GroupSubStatus.ONGOING,
    "regressed": GroupSubStatus.REGRESSED,
    "new": GroupSubStatus.NEW,
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


class PriorityLevel(IntEnum):
    LOW = 25
    MEDIUM = 50
    HIGH = 75

    def to_str(self) -> str:
        """
        Return the string representation of the priority level.
        """
        return self.name.lower()

    @classmethod
    def from_str(self, name: str) -> "PriorityLevel | None":
        """
        Return the priority level from a string representation.
        """
        name = name.upper()
        return self[name] if name in self.__members__ else None

from enum import IntEnum


class SearchType(IntEnum):
    ISSUE = 0
    EVENT = 1
    SESSION = 2
    REPLAY = 3
    METRIC = 4
    SPAN = 5
    ERROR = 6
    TRANSACTION = 7
    LOG = 8
    TRACEMETRIC = 9
    PREPROD_APP_SIZE = 10


# This and static/app/types/group.tsx must be updated together.

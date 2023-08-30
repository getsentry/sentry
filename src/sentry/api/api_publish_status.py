from enum import Enum


class ApiPublishStatus(Enum):
    """
    Used to track if an API is publicly documented
    """

    UNKNOWN = "unknown"
    PUBLIC = "public"
    PRIVATE = "private"
    EXPERIMENTAL = "experimental"

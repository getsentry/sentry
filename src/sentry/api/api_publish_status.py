from enum import Enum


class ApiPublishStatus(Enum):
    """
    Used to track if an API is publicly documented
    """

    UNKNOWN = "unknown"

    PUBLIC = "public"  # stable API that is visible in public documentation
    PRIVATE = "private"  # any API that will not be published at any point
    EXPERIMENTAL = "experimental"  # API in development and will be published at some point

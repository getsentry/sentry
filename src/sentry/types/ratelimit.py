from dataclasses import dataclass
from enum import Enum


# Fixed set of rate limit categories
class RateLimitCategory(str, Enum):
    IP = "ip"
    USER = "user"
    ORGANIZATION = "org"


@dataclass
class RateLimit:
    """Dataclass for defining a rate limit

    Attributes:
        limit (int): Max number of hits allowed within the window
        window (int): Period of time in seconds that the rate limit applies for

    """

    limit: int
    window: int

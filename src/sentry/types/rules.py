from typing import int
from collections import namedtuple
from dataclasses import dataclass

RuleFuture = namedtuple("RuleFuture", ["rule", "kwargs"])


@dataclass
class NotificationRuleDetails:
    """
    Dataclass to pass around rule details.
    """

    id: int
    label: str
    url: str
    status_url: str

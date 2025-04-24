from collections import namedtuple
from dataclasses import dataclass

RuleFuture = namedtuple("RuleFuture", ["rule", "kwargs"])


@dataclass
class NotificationRuleDetails:
    id: int
    label: str
    url: str
    status_url: str

from dataclasses import dataclass
from typing import Any, NamedTuple

from sentry.models.rule import Rule


class RuleFuture(NamedTuple):
    rule: Rule
    kwargs: dict[str, Any]


@dataclass
class NotificationRuleDetails:
    """
    Dataclass to pass around rule details.
    """

    id: int
    label: str
    url: str
    status_url: str

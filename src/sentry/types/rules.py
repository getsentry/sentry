from dataclasses import dataclass

from sentry.notifications.types import RuleFuture as RuleFuture

@dataclass
class NotificationRuleDetails:
    """
    Dataclass to pass around rule details.
    """

    id: int
    label: str
    status_url: str

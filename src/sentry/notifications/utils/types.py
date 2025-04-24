from dataclasses import dataclass


@dataclass
class NotificationRuleDetails:
    id: int
    label: str
    url: str
    status_url: str

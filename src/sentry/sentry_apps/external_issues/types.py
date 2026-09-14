from typing import Literal, TypedDict


class ExternalIssueTrigger(TypedDict):
    type: Literal["issue_alert", "workflow"]
    id: str
    name: str

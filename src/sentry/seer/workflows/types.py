from typing import Literal, TypedDict


class MessageLink(TypedDict):
    url: str
    link_type: Literal["issues", "metric_alert", "discover"]
    args: dict[str, str]


class ThreadMessage(TypedDict):
    id: str
    timestamp: str
    thread_id: str
    channel_id: str
    text: str
    links: list[MessageLink]


class WorkflowContext(TypedDict):
    message_id: str
    channel_id: str
    issue_link: MessageLink
    integration_id: int
    logging_ctx: dict[str, str | int | None]

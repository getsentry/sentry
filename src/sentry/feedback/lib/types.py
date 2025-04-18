from typing import NotRequired, TypedDict


class UserReportDict(TypedDict):
    event_id: str
    project_id: int
    comments: str
    name: NotRequired[str]
    email: NotRequired[str]
    environment_id: NotRequired[int]
    group_id: NotRequired[int]
    level: NotRequired[str]

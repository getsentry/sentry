from typing import NotRequired, TypedDict


class UserReportDict(TypedDict):
    """Use for weak type checking of user report data. Keys correspond to fields of the UserReport model."""

    event_id: str
    comments: str
    # required for the model, but functions usually infer this from an explicit Project argument.
    project_id: NotRequired[int]
    name: NotRequired[str]
    email: NotRequired[str]
    environment_id: NotRequired[int]  # defaults to "production".
    group_id: NotRequired[int]
    level: NotRequired[str]  # defaults to "info".

from typing import NotRequired, TypedDict, int


class UserReportDict(TypedDict):
    """Use for weak type checking of user report data. Keys correspond to fields of the UserReport model."""

    event_id: str
    comments: str
    name: NotRequired[str]  # defaults to ""
    email: NotRequired[str]  # defaults to ""
    # required for the model, but functions usually infer this from an explicit Project argument.
    project_id: NotRequired[int]
    environment_id: NotRequired[int]  # defaults to "production".
    group_id: NotRequired[int]
    level: NotRequired[str]  # defaults to "info".
